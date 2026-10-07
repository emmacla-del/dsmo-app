"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { activateUser, deleteUser, suspendUser } from "@/lib/user-directory";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel, hasRealNiu, listCompanies, type Company } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { listAdminQuestionnaires } from "@/lib/api-client";
import {
  auditActionLabel,
  auditActorName,
  auditDetailsSummary,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  fact,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, NATIONAL_ROLES, SETTINGS_ROLES, hasRole } from "@/lib/roles";

// Submission statuses render with the file-detail labels (adminDossierPage);
// an unknown status shows as stored.
const SUBMISSION_STATUS_KEYS: Record<string, string> = {
  PENDING_REVIEW: "adminDossierPage.statusPending",
  APPROVED: "adminDossierPage.statusEndorsed",
  CORRECTION_REQUESTED: "adminDossierPage.statusCorrection",
  REJECTED: "adminDossierPage.statusRejected",
};

// The stored submission status decides the badge class; anything else is neutral.
const SUBMISSION_STATUS_BADGE: Record<string, string> = {
  APPROVED: "cam-badge-success",
  PENDING_REVIEW: "cam-badge-warning",
  REJECTED: "cam-badge-error",
};

// Account statuses with a label under adminEtablissementPage.accountStatus.
const ACCOUNT_STATUS_CODES = new Set(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "COMPLEMENTS_REQUESTED"]);

// GET /companies is restricted to DIRECTORY_ROLES server-side
// (NATIONAL_ROLES); the check here fails closed, so a role that has not
// loaded yet is not treated as authorised. Account management is SUPER_ADMIN
// alone (SETTINGS_ROLES membership).

/** One label/value pair inside a .cam-admin-kv list; absent values print the neutral marker. */
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
  const canRead = hasRole(role, NATIONAL_ROLES);
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
    onError: (e: Error) => setActionError(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      showToast(t("accountReactivated"));
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      setAccountOpen(false);
      showToast(t("accountDeleted"));
      router.push("/admin/etablissements");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  // ── Nothing renders without an authoritative record ─────────────────────
  // The chrome still does: the reader keeps the breadcrumb and the way back.
  if (!company) {
    return (
      <div className="cam-admin-page">
        <AdminPageHeader
          backHref="/admin/etablissements"
          breadcrumb={[
            { label: tRoot("adminNav.hubs.declarants") },
            { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements" },
          ]}
          title={t("titleFallback")}
          subtitle={t("subtitle")}
          hideTabs={true}
          actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
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
          { label: tRoot("adminNav.hubs.declarants") },
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
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <AdminHeaderActions showCampaignPill={false} showBell={false} />
            {/* Shown only when there is a real account to act on and the role
                may act on it. The button performs the real call. */}
            {linkedAccount && canManageAccount && (
              <button
                type="button"
                className={`cam-button cam-button-sm ${isSuspended ? "cam-button-primary" : "cam-button-danger"}`}
                disabled={accountPending}
                onClick={toggleAccount}
              >
                {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
              </button>
            )}
          </div>
        }
      />

      {/* Every value is this establishment's own stored field. */}
      <p className="cam-admin-meta" style={{ margin: 0 }}>
        {company.entityType && <>{typeDisplay(company.entityType)} · </>}
        {t("idLabel")} <span className="cam-admin-code cam-admin-strong">{fact(company.establishmentId)}</span>
        {" · "}
        {t("mainActivityLabel")} <span className="cam-admin-strong">{fact(company.mainActivity)}</span>
      </p>

      {toastMessage && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{toastMessage}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setToastMessage(null)}>×</button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{actionError}</span>
        </div>
      )}

      <div className="cam-admin-grid">
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)", minWidth: 0 }}>
          {/* Identification: Company model fields only. */}
          <section className="cam-admin-section" aria-labelledby="etab-general-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-general-title" className="cam-admin-h2">{t("generalInfoTitle")}</h2>
            </div>
            <dl className="cam-admin-kv cam-admin-section-body">
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
              <Field label={t("field.sector")} value={company.sector?.name} />
              <Field label={t("field.phone")} value={company.phone} />
              <Field label={t("field.address")} value={company.address} />
              <Field label={t("field.region")} value={company.region} />
              <Field label={t("field.department")} value={company.department} />
              <Field label={t("field.subdivision")} value={company.subdivision} />
              <Field
                label={t("field.contactPerson")}
                value={respondent ? `${respondent}${company.respondentFunction ? ` — ${company.respondentFunction}` : ""}` : null}
              />
              <Field label={t("field.contactPhone")} value={company.respondentPhone} />
            </dl>
          </section>

          {/* Workforce as last declared on the Company record. */}
          <section className="cam-admin-section" aria-labelledby="etab-workforce-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-workforce-title" className="cam-admin-h2">{t("workforceTitle")}</h2>
            </div>
            <dl className="cam-admin-kv cam-admin-section-body">
              <Field label={t("workforceTotal")} value={count(company.totalEmployees, locale)} />
              <Field label={t("men")} value={count(company.menCount, locale)} />
              <Field label={t("women")} value={count(company.womenCount, locale)} />
              <Field label={t("workforceLastYear")} value={count(company.lastYearTotal, locale)} />
            </dl>
          </section>

          {/* Submission history for this company */}
          <section className="cam-admin-section" aria-labelledby="etab-submissions-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-submissions-title" className="cam-admin-h2">
                {t("submissionHistoryTitle")}{submissionsQuery.data?.total !== undefined ? ` (${count(submissionsQuery.data.total, locale)})` : ""}
              </h2>
              <Link href={`/admin/dossiers?companyId=${encodeURIComponent(company.id)}`} className="cam-text-button">
                {t("allFilesLink")}
              </Link>
            </div>

            <div className="cam-admin-section-body">
              {submissionsState !== "ready" ? (
                <DataState
                  dense
                  state={submissionsState}
                  resource={t("submissionsResource")}
                  error={submissionsQuery.error}
                  onRetry={() => submissionsQuery.refetch()}
                  title={submissionsState === "empty" ? t("noSubmissionTitle") : undefined}
                  hint={submissionsState === "empty" ? t("noSubmissionHint") : undefined}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
                  {submissionsQuery.data?.items.map((sub) => (
                    <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
                      <div>
                        <div className="cam-admin-strong">{sub.submissionId || sub.id}</div>
                        <div className="cam-admin-meta">
                          {t("receivedLine", { date: stamp(sub.submissionDate || sub.createdAt, true, locale), type: typeDisplay(sub.formType) })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
                        <span className={`cam-badge ${SUBMISSION_STATUS_BADGE[sub.status] ?? "cam-badge-neutral"}`}>
                          {SUBMISSION_STATUS_KEYS[sub.status] ? tRoot(SUBMISSION_STATUS_KEYS[sub.status]) : sub.status}
                        </span>
                        <Link href={`/admin/dossiers/${encodeURIComponent(sub.id)}`} className="cam-button cam-button-secondary cam-button-sm">
                          {t("openLink")}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)", minWidth: 0 }}>
          {/* Exactly one account can be linked: Company.user is singular. */}
          <section className="cam-admin-section" aria-labelledby="etab-account-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-account-title" className="cam-admin-h2">{t("linkedAccountTitle")}</h2>
            </div>
            <div className="cam-admin-section-body">
              {!linkedAccount ? (
                <DataState
                  dense
                  state="empty"
                  resource={t("linkedAccountResource")}
                  title={t("noLinkedAccountTitle")}
                  hint={t("noLinkedAccountHint")}
                />
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--cam-space-3)" }}>
                  <div style={{ minWidth: 0 }}>
                    {/* The account's own email. No display name is invented:
                        /companies returns only id, email, status and
                        isActive for the linked user. */}
                    <div className="cam-admin-strong">{fact(linkedAccount.email)}</div>
                    <div className="cam-admin-meta">
                      {t("accountStatusLine", {
                        status: ACCOUNT_STATUS_CODES.has(linkedAccount.status ?? "")
                          ? t(`accountStatus.${linkedAccount.status}`)
                          : fact(linkedAccount.status),
                      })}
                    </div>
                    <button type="button" className="cam-text-button" onClick={() => setAccountOpen(true)}>
                      {t("manageTitle")}
                    </button>
                  </div>
                  <span className={`cam-badge ${linkedAccount.isActive ? "cam-badge-success" : "cam-badge-neutral"}`}>
                    {linkedAccount.isActive ? t("activeBadge") : t("inactiveBadge")}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Registration metadata.
              `createdAt` is the only field the Company model records here. The
              Figma frame also shows the creating agent, the registration mode,
              the registration IP, a geolocation, a last-modified stamp and a
              document-verification status; none of those is stored anywhere,
              so none is shown. */}
          <section className="cam-admin-section" aria-labelledby="etab-registration-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-registration-title" className="cam-admin-h2">{t("accountInfoTitle")}</h2>
            </div>
            <div className="cam-admin-section-body">
              <dl className="cam-admin-kv">
                <Field label={t("registrationDate")} value={stamp(company.createdAt, false, locale)} />
              </dl>
              <div style={{ marginTop: "var(--cam-space-4)" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("metadataResource")}
                  title={t("metadataTitle")}
                  hint={t("metadataHint")}
                />
              </div>
            </div>
          </section>

          {/* Real audit entries for the linked account. */}
          <section className="cam-admin-section" aria-labelledby="etab-audit-title">
            <div className="cam-admin-section-head">
              <h2 id="etab-audit-title" className="cam-admin-h2">{t("auditTitle")}</h2>
            </div>
            <div className="cam-admin-section-body">
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
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
                  {(auditQuery.data?.items ?? []).map((e) => (
                    <div key={e.id}>
                      <div className="cam-admin-meta">{stamp(e.timestamp, true, locale)}</div>
                      <div className="cam-admin-strong">{auditActorName(e, locale)}</div>
                      <div>{auditActionLabel(e.action, locale)}</div>
                      <div className="cam-admin-meta">{auditDetailsSummary(e, locale)}</div>
                      {auditTransition(e, locale) && (
                        <div className="cam-admin-meta">{auditTransition(e, locale)}</div>
                      )}
                    </div>
                  ))}
                  <Link
                    href={`/admin/journal-audit?resourceId=${encodeURIComponent(linkedAccount.id)}`}
                    className="cam-text-button"
                  >
                    {t("fullLogLink")}
                  </Link>
                </div>
              )}
            </div>
          </section>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)", width: "100%" }}>
            <span className="cam-admin-meta">{t("actionsLogged")}</span>
            <button type="button" className="cam-button cam-button-secondary" onClick={() => setAccountOpen(false)}>
              {t("closeButton")}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
          {/* Whose account this is. Was an inline-restyled eyebrow; the
              eyebrow slot is an uppercase label, not a place for an email. */}
          <div>
            <div className="cam-admin-strong">{fact(linkedAccount?.email)}</div>
            <div className="cam-admin-meta">
              {t("registeredOn", { name: fact(shortName), date: stamp(company.createdAt, false, locale) })}
            </div>
          </div>

          {actionError && (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error">
              <span>{actionError}</span>
            </div>
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
                <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>{t("accountActions")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
                  <div>
                    <div className="cam-admin-strong">
                      {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
                    </div>
                    <div className="cam-admin-meta">
                      {isSuspended ? t("reactivateHint") : t("suspendHint")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`cam-button cam-button-sm ${isSuspended ? "cam-button-primary" : "cam-button-danger"}`}
                    disabled={accountPending}
                    onClick={toggleAccount}
                  >
                    {accountPending ? t("saving") : isSuspended ? t("reactivate") : t("suspend")}
                  </button>
                </div>
              </div>

              <div>
                <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>{t("signInHistory")}</div>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("signInResource")}
                  title={t("signInTitle")}
                  hint={t("signInHint")}
                />
              </div>

              <div>
                <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>{t("dangerZone")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
                  <div>
                    <div className="cam-admin-strong">{t("deleteAccount")}</div>
                    <div className="cam-admin-meta">{t("deleteHint")}</div>
                  </div>
                  <button
                    type="button"
                    className="cam-button cam-button-danger cam-button-sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? t("deleting") : t("delete")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminDialog>
    </div>
  );
}
