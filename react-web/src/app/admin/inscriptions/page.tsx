"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import {
  approveUser,
  listCompanyRegistrations,
  rejectUser,
  requestComplements,
  type ApproveUserOptions,
  type CompanyRegistrationItem,
} from "@/lib/user-directory";
import { ENTITY_TYPE_OPTION_KEYS, formatDate, hasRealNiu } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { APPROVAL_ROLES, DIRECTORY_ROLES } from "@/lib/roles";
import {
  approvalGate,
  inscriptionsHref,
  registrationMethodLabel,
  registrationMethodTone,
  verificationFlags,
  verificationRows,
  type VerificationMarks,
} from "@/lib/inscriptions";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { CoveragePanel } from "@/components/admin/CoveragePanel";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { doualaCalendarYear, parseYearParam } from "@/lib/pilotage-targets";

const PAGE_SIZE = 8;

// API entity types, labelled through ENTITY_TYPE_OPTION_KEYS (the public
// wizard's labels, no administrative codes).
const ENTITY_TYPE_VALUES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];

// Company column names as the correction form presents them, so a reviewer
// reads the diff in the applicant's own words: keys under
// adminInscriptionsPage.field. An unmapped key falls back to itself rather
// than being hidden.
const FIELD_KEYS = new Set([
  "name", "taxNumber", "mainActivity", "secondaryActivity", "parentCompany", "address", "phone", "email",
  "cnpsNumber", "fax", "socialCapital", "entityType", "region", "department", "subdivision",
  "regionId", "departmentId", "subdivisionId",
]);

// `textKey` is under adminInscriptionsPage; an unknown status shows as itself.
function statusLabel(status: string): { textKey: string | null; text: string; bg: string; color: string } {
  if (status === "PENDING_APPROVAL") return { textKey: "badgePending", text: status, bg: "#fef3c7", color: "#b45309" };
  if (status === "COMPLEMENTS_REQUESTED") return { textKey: "badgeComplements", text: status, bg: "#eff6ff", color: "#1d4ed8" };
  if (status === "ACTIVE") return { textKey: "badgeApproved", text: status, bg: "#004d3d", color: "#ffffff" };
  if (status === "REJECTED") return { textKey: "badgeRejected", text: status, bg: "#fee2e2", color: "#b91c1c" };
  return { textKey: null, text: status, bg: "#f1f5f9", color: "#475569" };
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// Suspense because useSearchParams() requires it in the app router.
export default function InscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionsContent />
    </Suspense>
  );
}

function InscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // /admin/equipe's "Voir les inscriptions" arrives with ?createdBy=<userId>:
  // every file that agent registered, so the status filter starts at "ALL"
  // rather than the review queue — the équipe card counts every status.
  const createdBy = searchParams.get("createdBy")?.trim() ?? "";
  // Two views of registrations: the review queue, and coverage against the
  // registration-campaign targets (moved here from /admin/cibles, which
  // forwards its old ?vue=couverture links). Both live in the URL, so a
  // reload keeps the view and the year.
  const vue: "file" | "couverture" = searchParams.get("vue") === "couverture" ? "couverture" : "file";
  const year = parseYearParam(searchParams.get("annee")) ?? doualaCalendarYear();
  const currentQuery = searchParams.toString();
  const role = useAuthStore((s) => s.user?.role);
  const canReadQueue = !!role && APPROVAL_ROLES.includes(role);
  // Same four roles the backend's POST /auth/admin/register-company accepts.
  const canRegisterAssisted = !!role && DIRECTORY_ROLES.includes(role);
  const queryClient = useQueryClient();
  const { regions: territoryRegions } = useTerritoryRegions();
  const tRoot = useTranslations();
  const t = useTranslations("adminInscriptionsPage");
  const locale = asUiLocale(useLocale());
  const entityLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value ?? "—";
  const fieldLabel = (field: string) => (FIELD_KEYS.has(field) ? t(`field.${field}`) : field);
  // An empty or absent before/after reads as a dash rather than as "null".
  const diffValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value;
    return String(value);
  };

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [statusFilter, setStatusFilter] = useState(createdBy ? "ALL" : "");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<CompanyRegistrationItem | null>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "REQUEST_COMPLEMENTS">("APPROVE");
  const [comment, setComment] = useState("");
  const [centralChecked, setCentralChecked] = useState(false);
  // The reviewer's ✓/✗ per verified row. A row absent from the map is
  // unanswered, which is neither ✓ nor ✗.
  const [marks, setMarks] = useState<VerificationMarks>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const from = dateRange === "30" ? daysAgo(30) : dateRange === "90" ? daysAgo(90) : undefined;

  const queueQuery = useQuery({
    queryKey: ["auth", "company-registrations", search, statusFilter, typeFilter, region, from, createdBy, page],
    queryFn: () =>
      listCompanyRegistrations({
        search,
        status: statusFilter || undefined,
        createdBy: createdBy || undefined,
        entityType: typeFilter || undefined,
        region: region || undefined,
        from,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: canReadQueue && vue === "file",
  });

  const closeReview = () => {
    setReviewing(null);
    setDecision("APPROVE");
    setComment("");
    setCentralChecked(false);
    setMarks({});
  };

  const done = (text: string) => {
    queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    setNotice({ tone: "success", text });
    closeReview();
  };

  const failed = (e: Error) => setNotice({ tone: "error", text: e.message });

  const approveMutation = useMutation({
    mutationFn: ({ id, options }: { id: string; options: ApproveUserOptions }) => approveUser(id, options),
    onSuccess: () => done(t("approvedNotice")),
    onError: failed,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason),
    onSuccess: () => done(t("rejectedNotice")),
    onError: failed,
  });
  const complementsMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => requestComplements(id, message),
    onSuccess: () => done(t("complementsNotice")),
    onError: failed,
  });

  const rows = reviewing ? verificationRows(reviewing, locale) : [];
  const gate = approvalGate(rows, marks, locale);
  // Why Approuver cannot be confirmed yet, shown in the dialog next to the
  // decision; null once it can. The server enforces the same rules.
  const approveBlocked = !reviewing
    ? null
    : gate.message ??
      (reviewing.requiresCentralStructureCheck && !centralChecked
        ? t("centralCheckRequired")
        : null);

  const handleDecisionSubmit = () => {
    if (!reviewing) return;
    if (decision === "APPROVE") {
      if (approveBlocked) return;
      approveMutation.mutate({
        id: reviewing.id,
        options: { centralStructureConfirmed: centralChecked, ...verificationFlags(rows, marks) },
      });
    } else if (decision === "REJECT") {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: t("rejectReasonRequired") });
        return;
      }
      rejectMutation.mutate({ id: reviewing.id, reason: comment.trim() });
    } else {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: t("complementsMessageRequired") });
        return;
      }
      complementsMutation.mutate({ id: reviewing.id, message: comment.trim() });
    }
  };

  // The region filter is applied by the API, inside the reviewer's own
  // territory scope, so paging and the totals stay consistent with it.
  const items = queueQuery.data?.items ?? [];
  const counts = queueQuery.data?.counts ?? { pending: 0, complements: 0, approved: 0, rejected: 0 };
  const total = queueQuery.data?.total ?? 0;
  const pendingMutation = approveMutation.isPending || rejectMutation.isPending || complementsMutation.isPending;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.declarants") }, { label: tRoot("adminNav.routes.inscriptions") }]}
        title={tRoot("adminNav.routes.inscriptions")}
        actions={
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <AdminHeaderActions showCampaignPill={false} />
            {canRegisterAssisted && (
              <Link href="/admin/inscriptions/nouvelle" className="cam-button cam-button-primary cam-button-sm">
                {tRoot("adminNav.routes.nouvelleInscription")}
              </Link>
            )}
          </div>
        }
      />

      <ViewSwitch
        label={t("viewsAriaLabel")}
        items={[
          { key: "file", label: t("viewQueue"), active: vue === "file", href: inscriptionsHref(currentQuery, "file") },
          { key: "couverture", label: t("viewCoverage"), active: vue === "couverture", href: inscriptionsHref(currentQuery, "couverture") },
        ]}
      />

      {vue === "couverture" && (
        <CoveragePanel year={year} onYearChange={(next) => router.replace(inscriptionsHref(currentQuery, "couverture", { annee: next }))} />
      )}

      {vue === "file" && (<>
      {createdBy && (
        <div role="status" className="cam-admin-notice cam-admin-notice--info" style={{ marginBottom: 16 }}>
          <span>
            {t("createdByFilter")}{" "}
            <strong>{items.find((i) => i.createdBy === createdBy)?.createdByName ?? t("selectedOfficer")}</strong>
          </span>
          <button
            type="button"
            className="cam-text-button"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              setStatusFilter("");
              setPage(1);
              router.replace(inscriptionsHref(currentQuery, "file", { createdBy: null }));
            }}
          >
            {t("removeFilter")}
          </button>
        </div>
      )}

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${notice.tone}`} style={{ marginBottom: 16 }}>
          <span>{notice.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <Kpi value={counts.pending} label={t("kpiPending")} accent="#f59e0b" />
        <Kpi value={counts.complements} label={t("kpiComplements")} accent="#2563eb" />
        <Kpi value={counts.approved} label={t("kpiApproved")} accent="#007a5e" />
        <Kpi value={counts.rejected} label={t("kpiRejected")} accent="#dc2626" />
      </div>

      <section className="cam-admin-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14, alignItems: "flex-end" }}>
          <Filter label={t("typeFilterLabel")}>
            <select className="cam-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">{t("allTypes")}</option>
              {ENTITY_TYPE_VALUES.map((value) => <option key={value} value={value}>{entityLabel(value)}</option>)}
            </select>
          </Filter>
          <Filter label={t("regionFilterLabel")}>
            <select className="cam-select" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
              <option value="">{t("allRegions")}</option>
              {territoryRegions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Filter>
          <Filter label={t("statusFilterLabel")}>
            <select className="cam-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">{t("statusInQueue")}</option>
              <option value="ALL">{t("statusAll")}</option>
              <option value="PENDING_APPROVAL">{t("statusPending")}</option>
              <option value="COMPLEMENTS_REQUESTED">{t("statusComplements")}</option>
              <option value="ACTIVE">{t("statusApproved")}</option>
              <option value="REJECTED">{t("statusRejected")}</option>
            </select>
          </Filter>
          <Filter label={t("dateFilterLabel")}>
            <select className="cam-select" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }}>
              <option value="all">{t("allDates")}</option>
              <option value="30">{t("last30Days")}</option>
              <option value="90">{t("last90Days")}</option>
            </select>
          </Filter>
          <Filter label={t("searchLabel")}>
            <input className="cam-input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t("searchPlaceholder")} />
          </Filter>
        </div>
      </section>

      {!canReadQueue && <p className="cam-admin-lede">{t("noQueueAccess")}</p>}
      {queueQuery.isLoading && <p className="cam-admin-lede">{tRoot("common.loading")}</p>}
      {queueQuery.isError && <div className="cam-admin-notice cam-admin-notice--error" role="alert">{t("loadError")}</div>}

      <section className="cam-dash-table-wrap">
        <table className="cam-dash-table">
          <thead>
            <tr>
              <th scope="col">{t("organisationColumn")}</th>
              <th scope="col">{t("typeColumn")}</th>
              <th scope="col">{t("territoryColumn")}</th>
              <th scope="col">{t("submittedColumn")}</th>
              <th scope="col">{t("registeredByColumn")}</th>
              <th scope="col">{t("verificationColumn")}</th>
              <th scope="col">{t("duplicatesColumn")}</th>
              <th scope="col">{t("actionColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const badge = statusLabel(item.status);
              return (
                <tr key={item.id}>
                  <th scope="row">{item.organisation}</th>
                  <td>{entityLabel(item.entityType)}</td>
                  <td>{[item.region, item.department].filter(Boolean).join(" / ")}</td>
                  <td>{formatDate(item.submittedAt)}</td>
                  <td>
                    {/* An assisted or admin-created file names its author; a
                        self-service one has none, which reads as the method
                        badge alone rather than as a missing name. */}
                    {item.createdByName && <div>{item.createdByName}</div>}
                    <MethodBadge method={item.registrationMethod} />
                  </td>
                  <td>
                    <span style={{ fontSize: 11, background: badge.bg, color: badge.color, padding: "4px 10px", borderRadius: 9999, fontWeight: 600 }}>
                      {badge.textKey ? t(badge.textKey) : badge.text}
                    </span>
                  </td>
                  <td>{item.duplicateHints.length > 0 ? item.duplicateHints.length : "—"}</td>
                  <td>
                    <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => { setNotice(null); setReviewing(item); }}>
                      {t("reviewButton")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cam-admin-lede" style={{ margin: 0 }}>{t("showingRange", { start, end, total })}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t("previousButton")}</button>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={end >= total} onClick={() => setPage((current) => current + 1)}>{t("nextButton")}</button>
          </div>
        </div>
      </section>
      </>)}

      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        title={t("reviewTitle", { organisation: reviewing?.organisation || "" })}
        eyebrow={t("reviewEyebrow")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={closeReview} disabled={pendingMutation}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary"
              onClick={handleDecisionSubmit}
              disabled={pendingMutation || (decision === "APPROVE" && !!approveBlocked)}
              aria-describedby={decision === "APPROVE" && approveBlocked ? "inscription-approve-blocked" : undefined}
            >
              {pendingMutation ? "…" : t("confirmButton")}
            </button>
          </>
        }
      >
        {reviewing && (
          <div>
            {/* The dialog is modal, so the page-level notice sits behind it:
                a refused decision is repeated here, where the reviewer is. */}
            {notice?.tone === "error" && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{notice.text}</span>
              </div>
            )}
            <p>{t("typeLine")} <strong>{entityLabel(reviewing.entityType)}</strong> — {reviewing.region} / {reviewing.department}</p>
            <p>{t("niuLine", { niu: hasRealNiu(reviewing.taxNumber) ? reviewing.taxNumber ?? "—" : "—" })}</p>
            <p>{t("registeredOnLine", { date: formatDate(reviewing.submittedAt) })}</p>
            {reviewing.duplicateHints.length > 0 && (
              <div className="cam-admin-notice cam-admin-notice--warn" role="status">
                {reviewing.duplicateHints.map((hint) => <p key={hint} style={{ margin: 0 }}>{hint}</p>)}
              </div>
            )}
            {reviewing.lastResubmission && (
              <div>
                <p style={{ marginBottom: 4 }}>
                  <strong>{t("correctionsSent")}</strong> {t("correctionsSentOn", { date: formatDate(reviewing.lastResubmission.at) })}
                </p>
                {Object.keys(reviewing.lastResubmission.changes).length === 0 ? (
                  <p style={{ margin: 0 }}>{t("resubmittedUnchanged")}</p>
                ) : (
                  <table className="cam-dash-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("fieldColumn")}</th>
                        <th scope="col">{t("beforeColumn")}</th>
                        <th scope="col">{t("afterColumn")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reviewing.lastResubmission.changes).map(([field, diff]) => (
                        <tr key={field}>
                          <th scope="row">{fieldLabel(field)}</th>
                          <td>{diffValue(diff.before)}</td>
                          <td>{diffValue(diff.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            <h3 className="cam-admin-label" style={{ margin: "var(--cam-space-4) 0 var(--cam-space-2)" }}>{t("toVerifyTitle")}</h3>
            <table className="cam-dash-table">
              <thead>
                <tr>
                  <th scope="col">{t("itemColumn")}</th>
                  <th scope="col">{t("declaredValueColumn")}</th>
                  <th scope="col">{t("verificationColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value ?? <span style={{ color: "var(--cam-text-muted)" }}>{t("notRecorded")}</span>}</td>
                    <td>
                      {/* Neither radio checked = not answered yet. An empty
                          value cannot be attested, so its ✓ is disabled. */}
                      <div role="radiogroup" aria-label={t("verificationAriaLabel", { label: row.label })} style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-3)" }}>
                        <label className="cam-admin-choice">
                          <input
                            type="radio"
                            name={`verify-${row.key}`}
                            checked={marks[row.key] === "ok"}
                            disabled={row.value === null}
                            onChange={() => setMarks((current) => ({ ...current, [row.key]: "ok" }))}
                          />
                          {t("compliant")}
                        </label>
                        <label className="cam-admin-choice">
                          <input
                            type="radio"
                            name={`verify-${row.key}`}
                            checked={marks[row.key] === "ko"}
                            onChange={() => setMarks((current) => ({ ...current, [row.key]: "ko" }))}
                          />
                          {t("nonCompliant")}
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="cam-admin-label" style={{ margin: "var(--cam-space-4) 0 var(--cam-space-1)" }}>{t("respondentTitle")}</h3>
            <p className="cam-admin-choice-hint" style={{ margin: "0 0 var(--cam-space-2)" }}>{t("respondentNote")}</p>
            <dl className="cam-admin-kv">
              <div>
                <dt>{t("nameLabel")}</dt>
                <dd>{[reviewing.respondentFirstName, reviewing.respondentLastName].filter(Boolean).join(" ") || "—"}</dd>
              </div>
              <div><dt>{t("functionLabel")}</dt><dd>{reviewing.respondentFunction || "—"}</dd></div>
              <div>
                <dt>{t("phoneLabel")}</dt>
                <dd>{[reviewing.respondentPhone, reviewing.respondentPhone2].filter(Boolean).join(" · ") || "—"}</dd>
              </div>
              <div><dt>{t("loginEmailLabel")}</dt><dd>{reviewing.email}</dd></div>
              <div>
                <dt>{t("registeredByLabel")}</dt>
                <dd>
                  {reviewing.createdByName && <div>{reviewing.createdByName}</div>}
                  <MethodBadge method={reviewing.registrationMethod} />
                </dd>
              </div>
            </dl>
            {reviewing.requiresCentralStructureCheck && (
              <label className="cam-admin-choice">
                <input type="checkbox" checked={centralChecked} onChange={(e) => setCentralChecked(e.target.checked)} />
                {t("centralConfirmed")}
              </label>
            )}
            <div className="cam-target-modes" role="radiogroup" aria-label={t("decisionAriaLabel")}>
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "APPROVE"} onChange={() => setDecision("APPROVE")} />
                {t("approveAccount")}
              </label>
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "REJECT"} onChange={() => setDecision("REJECT")} />
                {t("rejectAccount")}
              </label>
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "REQUEST_COMPLEMENTS"} onChange={() => setDecision("REQUEST_COMPLEMENTS")} />
                {t("requestComplements")}
              </label>
            </div>
            {decision === "APPROVE" && approveBlocked && (
              <p id="inscription-approve-blocked" role="status" className="cam-admin-choice-hint" style={{ margin: "var(--cam-space-2) 0 0" }}>
                {approveBlocked}
              </p>
            )}
            {decision !== "APPROVE" && (
              <label className="cam-target-year">
                {decision === "REJECT" ? t("rejectReasonLabel") : t("complementsMessageLabel")}
                <textarea className="cam-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
            )}
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

/** The registration-method badge, or a dash for a row that predates tracking. */
function MethodBadge({ method }: { method: string | null }) {
  const label = registrationMethodLabel(method, asUiLocale(useLocale()));
  if (!label) return <span>—</span>;
  const tone = registrationMethodTone(method);
  return (
    <span style={{ fontSize: 11, background: tone.bg, color: tone.color, padding: "3px 9px", borderRadius: 9999, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Kpi({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ background: "var(--cam-surface)", border: "1px solid var(--cam-border)", borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: "20px 24px" }}>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--cam-text-muted)", marginTop: 8 }}>{label}</div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="cam-target-year">
      {label}
      {children}
    </label>
  );
}
