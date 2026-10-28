"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { activateUser, deleteUser, suspendUser } from "@/lib/user-directory";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel, hasRealNiu, listCompanies, type Company } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { respondentFunctionLabel, sectorLabel } from "@/lib/display-labels";
import { listAdminQuestionnaires } from "@/lib/api-client";
import {
  auditActionLabel,
  auditActorName,
  auditDetailsSummary,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { formatApiError } from "@/lib/pilotage-targets";
import {
  NOT_PROVIDED,
  count,
  fact,
  resolveDataState,
  stamp,
  shortRecordId,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, DIRECTORY_READ_ROLES, SETTINGS_ROLES, hasRole } from "@/lib/roles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Submission statuses render with the file-detail labels (adminDossierPage);
// an unknown status shows as stored.
const SUBMISSION_STATUS_KEYS: Record<string, string> = {
  PENDING_REVIEW: "adminDossierPage.statusPending",
  APPROVED: "adminDossierPage.statusEndorsed",
  CORRECTION_REQUESTED: "adminDossierPage.statusCorrection",
  REJECTED: "adminDossierPage.statusRejected",
  SUPERSEDED: "adminDossierPage.statusSuperseded",
};

// The stored submission status decides the badge tone; anything else is neutral.
const SUBMISSION_STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  APPROVED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
};

// Account statuses with a label under adminEtablissementPage.accountStatus.
const ACCOUNT_STATUS_CODES = new Set(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "COMPLEMENTS_REQUESTED"]);

// GET /companies is restricted to DIRECTORY_ROLES server-side
// (NATIONAL_ROLES); the check here fails closed, so a role that has not
// loaded yet is not treated as authorised. Account management is SUPER_ADMIN
// alone (SETTINGS_ROLES membership).

/** One label/value pair inside a definition list; absent values print the neutral marker. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{fact(value)}</dd>
    </div>
  );
}

export default function EtablissementDetailPage() {
  return (
    <Suspense fallback={null}>
      <EtablissementDetail />
    </Suspense>
  );
}

function EtablissementDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // No default identifier: without one there is no establishment to show, and
  // substituting a known RCCM would load an unrelated real company.
  const id = searchParams.get("id")?.trim() ?? "";

  const role = useAuthStore((s) => s.user?.role);
  // Establishment registration staff need direct detail access too; survey
  // specialists should not reach the registration directory by URL.
  const canRead = hasRole(role, DIRECTORY_READ_ROLES);
  const canManageAccount = hasRole(role, SETTINGS_ROLES);
  const canReadAudit = hasRole(role, AUDIT_ROLES);

  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminEtablissementPage");
  const locale = asUiLocale(useLocale());
  const typeDisplay = (type: string) =>
    ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
  const [accountOpen, setAccountOpen] = useState(searchParams.get("manage") === "true");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setActionError(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  /**
   * Source: GET /companies?search=<id> (DsmoService.listCompanies), then
   * the row whose establishmentId or registrationNumber matches exactly.
   *
   * `null` means the search returned no matching establishment. There is no
   * template record: a company is rendered from its own fields or not at all,
   * so a missing field can never inherit another company's value.
   */
  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return (
        res.companies.find((c) => c.establishmentId === id || c.registrationNumber === id) ?? null
      );
    },
    enabled: canRead && !!id,
  });

  const company: Company | null = companyQuery.data ?? null;
  const linkedAccount = company?.user ?? null;
  useEffect(() => {
    const title = company?.name?.split("—")[0].trim() || t("titleFallback");
    document.title = `${title} | CAMLEAP`;
  }, [company?.name, t]);

  const pageState = resolveDataState({
    roleAllowed: canRead,
    isLoading: companyQuery.isLoading,
    isError: companyQuery.isError,
    error: companyQuery.error,
  });

  /**
   * Audit trail for this establishment's linked account.
   *
   * Source: GET /audit/reports?resourceId=<User.id>. Only events the system
   * actually recorded for that account; there is no reconstructed history.
   */
  const auditQuery = useQuery({
    queryKey: ["audit", "by-resource", linkedAccount?.id],
    queryFn: () => listAuditLog({ resourceId: linkedAccount!.id, limit: 8, offset: 0 }),
    enabled: canReadAudit && !!linkedAccount?.id,
  });

  const auditState = resolveDataState({
    roleAllowed: canReadAudit,
    isLoading: auditQuery.isLoading,
    isError: auditQuery.isError,
    error: auditQuery.error,
    rowCount: auditQuery.data?.items.length ?? null,
  });

  const submissionsQuery = useQuery({
    queryKey: ["admin", "questionnaires", "by-company", company?.id],
    queryFn: () => listAdminQuestionnaires({ companyId: company!.id, limit: 10 }),
    enabled: canRead && !!company?.id,
  });

  const submissionsState = resolveDataState({
    roleAllowed: canRead,
    isLoading: submissionsQuery.isLoading,
    isError: submissionsQuery.isError,
    error: submissionsQuery.error,
    rowCount: submissionsQuery.data?.items.length ?? null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
    queryClient.invalidateQueries({ queryKey: ["audit", "by-resource"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires", "by-company"] });
  };

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      showToast(t("accountSuspended"));
    },
    onError: (e: unknown) => setActionError(formatApiError(e, locale)),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      showToast(t("accountReactivated"));
    },
    onError: (e: unknown) => setActionError(formatApiError(e, locale)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      setAccountOpen(false);
      showToast(t("accountDeleted"));
      router.push("/admin/etablissements");
    },
    onError: (e: unknown) => setActionError(formatApiError(e, locale)),
  });

  // ── Nothing renders without an authoritative record ─────────────────────
  // The chrome still does: the reader keeps the breadcrumb and the way back.
  if (!company) {
    return (
      <div className="cam-admin-page">
        <AdminPageHeader
          backHref="/admin/etablissements"
          breadcrumb={[
            { label: tRoot("adminNav.hubs.inscriptions") },
            { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements" },
          ]}
          title={t("titleFallback")}
          subtitle={t("subtitle")}
          hideTabs={true}
        />
        <DataState
          state={!id ? "notFound" : pageState === "ready" ? "notFound" : pageState}
          resource={t("resource")}
          error={companyQuery.error}
          onRetry={() => companyQuery.refetch()}
          title={
            !id
              ? t("noIdTitle")
              : pageState === "forbidden"
                ? t("accessDenied")
                : pageState === "error"
                  ? undefined
                  : t("notFoundTitle")
          }
          hint={
            !id
              ? t("noIdHint")
              : pageState === "forbidden"
                ? t("accessDeniedHint")
                : pageState === "error"
                  ? undefined
                  : t("notFoundHint")
          }
        />
      </div>
    );
  }

  const respondent = [company.respondentFirstName, company.respondentLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const isSuspended = !!linkedAccount && !linkedAccount.isActive;
  const shortName = company.name?.split("—")[0].trim() || null;
  const accountPending = suspendMutation.isPending || activateMutation.isPending;
  const toggleAccount = () => (isSuspended ? activateMutation.mutate() : suspendMutation.mutate());

  return (
    <div className="cam-admin-page">
      {/* The header carries what the hero card used to: the name as the
          title, the account state as the badge, and the one account action. */}
      <AdminPageHeader
        backHref="/admin/etablissements"
        breadcrumb={[
          { label: tRoot("adminNav.hubs.inscriptions") },
          { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements" },
          { label: shortName ?? NOT_PROVIDED },
        ]}
        title={shortName ?? t("titleFallback")}
        subtitle={t("subtitle")}
        statusBadge={
          !linkedAccount
            ? { label: t("badgeNoAccount"), variant: "neutral" }
            : isSuspended
              ? { label: t("badgeSuspended"), variant: "rejected" }
              : { label: t("badgeActive"), variant: "active" }
        }
        hideTabs={true}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Shown only when there is a real account to act on and the role
                may act on it. The button performs the real call. Secondary,
                not primary: a header action is not this view's main task. */}
            {linkedAccount && canManageAccount && (
              <Button
                type="button"
                size="sm"
                variant={isSuspended ? "outline" : "destructive"}
                disabled={accountPending}
                onClick={toggleAccount}
              >
                {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
              </Button>
            )}
          </div>
        }
      />

      {/* Every value is this establishment's own stored field. */}
      <p className="text-sm text-muted-foreground">
        {company.entityType && <>{typeDisplay(company.entityType)} · </>}
        {t("idLabel")} <span className="font-mono font-medium text-foreground">{fact(company.establishmentId)}</span>
        {" · "}
        {t("mainActivityLabel")} <span className="font-medium text-foreground">{fact(company.mainActivity)}</span>
      </p>

      {toastMessage && (
        <Alert variant="success" role="status" className="mb-4 flex items-center justify-between gap-4"><AlertDescription>{toastMessage}</AlertDescription><Button type="button" variant="ghost" size="icon-sm" aria-label={t("closeAriaLabel")} onClick={() => setToastMessage(null)}>×</Button></Alert>
      )}

      {actionError && (
        <Alert variant="destructive" className="mb-4"><AlertDescription>{actionError}</AlertDescription></Alert>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        {/* ── Left column ── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Identification: Company model fields only. */}
          <Card><CardHeader><CardTitle id="etab-general-title" className="text-base">{t("generalInfoTitle")}</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dd]:font-medium [&_dt]:text-sm [&_dt]:text-muted-foreground">
              <Field label={t("field.name")} value={company.name} />
              <Field label={t("field.entityType")} value={company.entityType ? typeDisplay(company.entityType) : null} />
              <Field label={t("field.registrationNumber")} value={company.registrationNumber} />
              <Field label={t("field.taxNumber")} value={hasRealNiu(company.taxNumber) ? company.taxNumber : null} />
              <Field label={t("field.cnpsNumber")} value={company.cnpsNumber} />
              <Field label={t("field.establishmentId")} value={company.establishmentId} />
              <Field label={t("field.yearOfCreation")} value={company.yearOfCreation} />
              <Field label={t("field.legalStatus")} value={company.legalStatus} />
              <Field label={t("field.size")} value={company.enterpriseSize} />
              <Field label={t("field.mainActivity")} value={company.mainActivity} />
              <Field label={t("field.sector")} value={sectorLabel(company.sector, locale)} />
              <Field label={t("field.phone")} value={company.phone} />
              <Field label={t("field.address")} value={company.address} />
              <Field label={t("field.region")} value={company.region} />
              <Field label={t("field.department")} value={company.department} />
              <Field label={t("field.subdivision")} value={company.subdivision} />
              <Field
                label={t("field.contactPerson")}
                value={respondent ? `${respondent}${company.respondentFunction ? ` — ${respondentFunctionLabel(company.respondentFunction, locale)}` : ""}` : null}
              />
              <Field label={t("field.contactPhone")} value={company.respondentPhone} />
            </dl></CardContent>
          </Card>

          {/* Workforce as last declared on the Company record. */}
          <Card><CardHeader><CardTitle id="etab-workforce-title" className="text-base">{t("workforceTitle")}</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dd]:font-medium [&_dt]:text-sm [&_dt]:text-muted-foreground">
              <Field label={t("workforceTotal")} value={count(company.totalEmployees, locale)} />
              <Field label={t("men")} value={count(company.menCount, locale)} />
              <Field label={t("women")} value={count(company.womenCount, locale)} />
              <Field label={t("workforceLastYear")} value={count(company.lastYearTotal, locale)} />
            </dl></CardContent>
          </Card>

          {/* Submission history for this company */}
          <AdminTablePanel
            title={`${t("submissionHistoryTitle")}${submissionsQuery.data?.total !== undefined ? ` (${count(submissionsQuery.data.total, locale)})` : ""}`}
            headingId="etab-submissions-title"
            actions={<Button asChild variant="link" size="sm"><Link href={`/admin/dossiers?companyId=${encodeURIComponent(company.id)}`}>{t("allFilesLink")}</Link></Button>}
          >
            <Table>
                <TableHeader><TableRow>
                    <TableHead scope="col">{t("submissionColumn.reference")}</TableHead>
                    <TableHead scope="col">{t("submissionColumn.type")}</TableHead>
                    <TableHead scope="col">{t("submissionColumn.received")}</TableHead>
                    <TableHead scope="col">{t("submissionColumn.status")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("submissionColumn.actions")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <DataStateRow
                    colSpan={5}
                    state={submissionsState}
                    resource={t("submissionsResource")}
                    error={submissionsQuery.error}
                    onRetry={() => submissionsQuery.refetch()}
                    title={submissionsState === "empty" ? t("noSubmissionTitle") : undefined}
                    hint={submissionsState === "empty" ? t("noSubmissionHint") : undefined}
                  />
                  {submissionsState === "ready" &&
                    submissionsQuery.data?.items.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono font-medium" title={sub.submissionId || sub.id}>{shortRecordId(sub.submissionId || sub.id)}</TableCell>
                        <TableCell>{typeDisplay(sub.formType)}</TableCell>
                        <TableCell>{stamp(sub.submissionDate || sub.createdAt, true, locale)}</TableCell>
                        <TableCell>
                          <Badge variant={SUBMISSION_STATUS_BADGE[sub.status] ?? "neutral"}>
                            {SUBMISSION_STATUS_KEYS[sub.status] ? tRoot(SUBMISSION_STATUS_KEYS[sub.status]) : sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm"><Link href={`/admin/dossiers/${encodeURIComponent(sub.id)}`}>
                            {t("openLink")}
                          </Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
            </Table>
          </AdminTablePanel>
        </div>

        {/* ── Right column ── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Exactly one account can be linked: Company.user is singular. */}
          <Card><CardHeader><CardTitle id="etab-account-title" className="text-base">{t("linkedAccountTitle")}</CardTitle></CardHeader>
            <CardContent>
              {!linkedAccount ? (
                <DataState
                  dense
                  state="empty"
                  resource={t("linkedAccountResource")}
                  title={t("noLinkedAccountTitle")}
                  hint={t("noLinkedAccountHint")}
                />
              ) : (
                <div className="min-w-0">
                  {/* The account's own email. No display name is invented:
                      /companies returns only id, email, status and
                      isActive for the linked user. Active / suspended is the
                      header badge; the approval status is shown here only
                      when it says more than that (pending, rejected,
                      further information requested). */}
                  <div className="break-all font-medium">{fact(linkedAccount.email)}</div>
                  {linkedAccount.status !== "ACTIVE" && (
                    <div className="text-sm text-muted-foreground">
                      {t("accountStatusLine", {
                        status: ACCOUNT_STATUS_CODES.has(linkedAccount.status ?? "")
                          ? t(`accountStatus.${linkedAccount.status}`)
                          : fact(linkedAccount.status),
                      })}
                    </div>
                  )}
                  <Button type="button" variant="link" className="h-auto px-0" onClick={() => setAccountOpen(true)}>
                    {t("manageTitle")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registration metadata.
              `createdAt` is the only field the Company model records here. The
              Figma frame also shows the creating agent, the registration mode,
              the registration IP, a geolocation, a last-modified stamp and a
              document-verification status; none of those is stored anywhere,
              so none is shown. */}
          <Card><CardHeader><CardTitle id="etab-registration-title" className="text-base">{t("accountInfoTitle")}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 [&_dd]:mt-1 [&_dd]:font-medium [&_dt]:text-sm [&_dt]:text-muted-foreground">
                <Field label={t("registrationDate")} value={stamp(company.createdAt, true, locale)} />
              </dl>
              <div className="mt-4">
                <DataState
                  dense
                  state="unavailable"
                  resource={t("metadataResource")}
                  title={t("metadataTitle")}
                  hint={t("metadataHint")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Real audit entries for the linked account. */}
          <Card><CardHeader><CardTitle id="etab-audit-title" className="text-base">{t("auditTitle")}</CardTitle></CardHeader>
            <CardContent>
              {!linkedAccount ? (
                <DataState
                  dense
                  state="empty"
                  resource={t("auditResource")}
                  title={t("noLinkedAccountTitle")}
                  hint={t("auditNoAccountHint")}
                />
              ) : auditState !== "ready" ? (
                <DataState
                  dense
                  state={auditState}
                  resource={t("auditResource")}
                  error={auditQuery.error}
                  onRetry={() => auditQuery.refetch()}
                  title={
                    auditState === "empty"
                      ? t("auditEmptyTitle")
                      : auditState === "forbidden"
                        ? t("auditForbiddenTitle")
                        : undefined
                  }
                  hint={auditState === "empty" ? t("auditEmptyHint") : undefined}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {(auditQuery.data?.items ?? []).map((e) => (
                    <div key={e.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="text-xs text-muted-foreground">{stamp(e.timestamp, true, locale)}</div>
                      <div className="font-medium">{auditActorName(e, locale)}</div>
                      <div>{auditActionLabel(e.action, locale)}</div>
                      <div className="text-sm text-muted-foreground">{auditDetailsSummary(e, locale)}</div>
                      {auditTransition(e, locale) && (
                        <div className="text-sm text-muted-foreground">{auditTransition(e, locale)}</div>
                      )}
                    </div>
                  ))}
                  <Link
                    href={`/admin/journal-audit?resourceId=${encodeURIComponent(linkedAccount.id)}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {t("fullLogLink")}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Account management.
          Only actions with a real endpoint are offered. The Figma frame also
          shows "unlock account", "resend verification email", "reset session",
          a role selector and a recent-login table; none of those has a backend
          operation or a stored source, and the previous version reported each
          as done after merely showing a toast. ── */}
      <AdminDialog
        open={accountOpen && !!linkedAccount}
        onClose={() => setAccountOpen(false)}
        wide
        title={t("manageTitle")}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("actionsLogged")}</span>
            <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>
              {t("closeButton")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Whose account this is. Was an inline-restyled eyebrow; the
              eyebrow slot is an uppercase label, not a place for an email. */}
          <div>
            <div className="break-all font-medium">{fact(linkedAccount?.email)}</div>
            <div className="text-sm text-muted-foreground">
              {t("registeredOn", { name: fact(shortName), date: stamp(company.createdAt, true, locale) })}
            </div>
          </div>

          {actionError && (
            <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>
          )}

          {!canManageAccount ? (
            <DataState
              dense
              state="forbidden"
              resource={t("manageResource")}
              title={t("manageForbidden")}
            />
          ) : (
            <>
              <div>
                <div className="mb-2 text-sm font-medium">{t("accountActions")}</div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isSuspended ? t("reactivateHint") : t("suspendHint")}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSuspended ? "default" : "destructive"}
                    disabled={accountPending}
                    onClick={toggleAccount}
                  >
                    {accountPending ? t("saving") : isSuspended ? t("reactivate") : t("suspend")}
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">{t("signInHistory")}</div>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("signInResource")}
                  title={t("signInTitle")}
                  hint={t("signInHint")}
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">{t("dangerZone")}</div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t("deleteAccount")}</div>
                    <div className="text-sm text-muted-foreground">{t("deleteHint")}</div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? t("deleting") : t("delete")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminDialog>
    </div>
  );
}
