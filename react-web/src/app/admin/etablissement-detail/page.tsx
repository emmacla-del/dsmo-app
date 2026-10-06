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

// Account statuses with a label under adminEtablissementPage.accountStatus.
const ACCOUNT_STATUS_CODES = new Set(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "COMPLEMENTS_REQUESTED"]);

// GET /companies is restricted to DIRECTORY_ROLES server-side
// (NATIONAL_ROLES); the check here fails closed, so a role that has not
// loaded yet is not treated as authorised. Account management is SUPER_ADMIN
// alone (SETTINGS_ROLES membership).

const CARD: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 24,
};

const KEY: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#6b7280",
  letterSpacing: "0.04em",
};

const VAL: React.CSSProperties = { fontSize: 14, color: "#111827", marginTop: 2 };

/** One label/value pair; absent values print the neutral marker. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={KEY}>{label}</div>
      <div style={VAL}>{fact(value)}</div>
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
  if (!company) {
    return (
      <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
        <Link href="/admin/etablissements" style={{ fontSize: 13, fontWeight: 600, color: "#004d3d", textDecoration: "none" }}>
          {t("backLink")}
        </Link>
        <div style={{ marginTop: 20, maxWidth: 820 }}>
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
      </div>
    );
  }

  const respondent = [company.respondentFirstName, company.respondentLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const isSuspended = !!linkedAccount && !linkedAccount.isActive;
  const shortName = company.name?.split("—")[0].trim() || null;

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      <AdminPageHeader
        backHref="/admin/etablissements"
        breadcrumb={[
          { label: tRoot("adminNav.hubs.declarants") },
          { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements" },
          { label: shortName ?? NOT_PROVIDED },
        ]}
        title={shortName ?? t("titleFallback")}
        subtitle={t("subtitle")}
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
      />


      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" aria-label={t("closeAriaLabel")} onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
        </div>
      )}

      {actionError && (
        <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {/* ── Hero: every value is this establishment's own stored field ── */}
      <section style={{ ...CARD, padding: "24px 28px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
                {fact(company.name)}
              </h1>
              {company.entityType && (
                <span style={{ fontSize: 11, background: "rgba(0, 122, 94, 0.08)", color: "#004d3d", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                  {typeDisplay(company.entityType)}
                </span>
              )}
              {/* Account state, or an explicit "no linked account". */}
              <span
                style={{
                  fontSize: 11,
                  background: !linkedAccount ? "#f3f4f6" : isSuspended ? "#fee2e2" : "#dcfce7",
                  color: !linkedAccount ? "#6b7280" : isSuspended ? "#b91c1c" : "#15803d",
                  padding: "3px 10px",
                  borderRadius: 9999,
                  fontWeight: 600,
                }}
              >
                {!linkedAccount ? t("badgeNoAccount") : isSuspended ? t("badgeSuspended") : t("badgeActive")}
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
              {t("idLabel")} <strong style={{ color: "#111827", fontFamily: "ui-monospace, monospace" }}>{fact(company.establishmentId)}</strong>
              {" | "}
              {t("mainActivityLabel")} <strong style={{ color: "#111827" }}>{fact(company.mainActivity)}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Shown only when there is a real account to act on and the role
                may act on it. The button performs the real call. */}
            {linkedAccount && canManageAccount && (
              <button
                type="button"
                disabled={suspendMutation.isPending || activateMutation.isPending}
                onClick={() => (isSuspended ? activateMutation.mutate() : suspendMutation.mutate())}
                style={{ padding: "8px 18px", background: "#ffffff", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#b91c1c", cursor: "pointer" }}
              >
                {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
              </button>
            )}
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "flex-start" }}>
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Identification: Company model fields only. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              {t("generalInfoTitle")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
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
            </div>
          </section>

          {/* Workforce as last declared on the Company record. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              {t("workforceTitle")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div>
                <div style={KEY}>{t("workforceTotal")}</div>
                <div style={VAL}>{count(company.totalEmployees, locale)}</div>
              </div>
              <div>
                <div style={KEY}>{t("men")}</div>
                <div style={VAL}>{count(company.menCount, locale)}</div>
              </div>
              <div>
                <div style={KEY}>{t("women")}</div>
                <div style={VAL}>{count(company.womenCount, locale)}</div>
              </div>
              <div>
                <div style={KEY}>{t("workforceLastYear")}</div>
                <div style={VAL}>{count(company.lastYearTotal, locale)}</div>
              </div>
            </div>
          </section>

          {/* Submission history for this company */}
          <section style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                {t("submissionHistoryTitle")}{submissionsQuery.data?.total !== undefined ? ` (${count(submissionsQuery.data.total, locale)})` : ""}
              </h2>
              {company && (
                <Link
                  href={`/admin/dossiers?companyId=${encodeURIComponent(company.id)}`}
                  style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("allFilesLink")}
                </Link>
              )}
            </div>

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
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {submissionsQuery.data?.items.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      border: "1px solid #f1f5f9",
                      borderRadius: 6,
                      background: "#f8fafc",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {sub.submissionId || sub.id}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {t("receivedLine", { date: stamp(sub.submissionDate || sub.createdAt, true, locale), type: typeDisplay(sub.formType) })}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            sub.status === "APPROVED"
                              ? "#dcfce7"
                              : sub.status === "PENDING_REVIEW"
                                ? "#fef3c7"
                                : sub.status === "REJECTED"
                                  ? "#fee2e2"
                                  : "#f1f5f9",
                          color:
                            sub.status === "APPROVED"
                              ? "#15803d"
                              : sub.status === "PENDING_REVIEW"
                                ? "#b45309"
                                : sub.status === "REJECTED"
                                  ? "#b91c1c"
                                  : "#475569",
                        }}
                      >
                        {SUBMISSION_STATUS_KEYS[sub.status] ? tRoot(SUBMISSION_STATUS_KEYS[sub.status]) : sub.status}
                      </span>
                      <Link
                        href={`/admin/dossiers/${encodeURIComponent(sub.id)}`}
                        style={{
                          fontSize: 12,
                          color: "#004d3d",
                          fontWeight: 600,
                          textDecoration: "none",
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        {t("openLink")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Exactly one account can be linked: Company.user is singular. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              {t("linkedAccountTitle")}
            </h2>
            {!linkedAccount ? (
              <DataState
                dense
                state="empty"
                resource={t("linkedAccountResource")}
                title={t("noLinkedAccountTitle")}
                hint={t("noLinkedAccountHint")}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div>
                  {/* The account's own email. No display name is invented:
                      /companies returns only id, email, status and
                      isActive for the linked user. */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{fact(linkedAccount.email)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {t("accountStatusLine", {
                      status: ACCOUNT_STATUS_CODES.has(linkedAccount.status ?? "")
                        ? t(`accountStatus.${linkedAccount.status}`)
                        : fact(linkedAccount.status),
                    })}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    background: linkedAccount.isActive ? "#dcfce7" : "#f3f4f6",
                    color: linkedAccount.isActive ? "#15803d" : "#6b7280",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontWeight: 700,
                  }}
                >
                  {linkedAccount.isActive ? t("activeBadge") : t("inactiveBadge")}
                </span>
              </button>
            )}
          </section>

          {/* Registration metadata.
              `createdAt` is the only field the Company model records here. The
              Figma frame also shows the creating agent, the registration mode,
              the registration IP, a geolocation, a last-modified stamp and a
              document-verification status; none of those is stored anywhere,
              so none is shown. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              {t("accountInfoTitle")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <Field label={t("registrationDate")} value={stamp(company.createdAt, false, locale)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <DataState
                dense
                state="unavailable"
                resource={t("metadataResource")}
                title={t("metadataTitle")}
                hint={t("metadataHint")}
              />
            </div>
          </section>

          {/* Real audit entries for the linked account. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              {t("auditTitle")}
            </h2>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
                {(auditQuery.data?.items ?? []).map((e) => (
                  <div key={e.id}>
                    <div style={{ color: "#6b7280" }}>{stamp(e.timestamp, true, locale)}</div>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{auditActorName(e, locale)}</div>
                    <div style={{ color: "#4b5563" }}>{auditActionLabel(e.action, locale)}</div>
                    <div style={{ color: "#6b7280" }}>{auditDetailsSummary(e, locale)}</div>
                    {auditTransition(e, locale) && (
                      <div style={{ color: "#6b7280", fontStyle: "italic" }}>{auditTransition(e, locale)}</div>
                    )}
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
                  <Link
                    href={`/admin/journal-audit?resourceId=${encodeURIComponent(linkedAccount.id)}`}
                    style={{ fontSize: 13, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}
                  >
                    {t("fullLogLink")}
                  </Link>
                </div>
              </div>
            )}
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
        eyebrow={
          <div style={{ color: "#4b5563", textTransform: "none", fontWeight: 500, fontSize: 13, marginBottom: 4, letterSpacing: "normal" }}>
            <span style={{ fontWeight: 600, color: "#111827" }}>{fact(linkedAccount?.email)}</span>
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
              {t("registeredOn", { name: fact(shortName), date: stamp(company.createdAt, false, locale) })}
            </div>
          </div>
        }
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {t("actionsLogged")}
            </span>
            <button type="button" className="cam-button cam-button-secondary" onClick={() => setAccountOpen(false)} style={{ padding: "8px 18px", borderRadius: 6 }}>
              {t("closeButton")}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {actionError && (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>
              {actionError}
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
                <div style={{ ...KEY, marginBottom: 12 }}>{t("accountActions")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {isSuspended ? t("reactivateAccount") : t("suspendAccount")}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {isSuspended
                        ? t("reactivateHint")
                        : t("suspendHint")}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={suspendMutation.isPending || activateMutation.isPending}
                    onClick={() => (isSuspended ? activateMutation.mutate() : suspendMutation.mutate())}
                    style={{ padding: "6px 14px", background: isSuspended ? "#004d3d" : "#d97706", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {suspendMutation.isPending || activateMutation.isPending
                      ? t("saving")
                      : isSuspended
                        ? t("reactivate")
                        : t("suspend")}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ ...KEY, marginBottom: 8 }}>{t("signInHistory")}</div>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("signInResource")}
                  title={t("signInTitle")}
                  hint={t("signInHint")}
                />
              </div>

              <div style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 14, background: "#fff5f5" }}>
                <div style={{ ...KEY, color: "#dc2626", marginBottom: 10 }}>{t("dangerZone")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t("deleteAccount")}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {t("deleteHint")}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    style={{ padding: "6px 14px", background: "#ffffff", color: "#b91c1c", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
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
