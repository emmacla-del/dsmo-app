"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { formatApiError } from "@/lib/pilotage-targets";
import { useAuthStore } from "@/lib/auth-store";
import {
  ANOMALY_DEROGATION_ROLES,
  ANOMALY_REGISTRY_ROLES,
  anomalyCompanyName,
  anomalyDossierRef,
  listAnomalyRegistry,
  resolveAnomalyRecord,
  getQualitySummary,
  getValidationRules,
  type AnomalyRecord,
  type AnomalyResolutionType,
  type QualitySummary,
  type ValidationRuleItem,
  ruleFamilyLabel,
} from "@/lib/anomaly-registry";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import {
  hrefWith,
  parseAnomalyStatusFilter,
  parseQualiteVue,
  parseSeverityFilter,
  type QualiteVue,
} from "@/lib/admin-url";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  percent,
  resolveDataState,
  shortRecordId,
  stamp,
} from "@/lib/admin-data-state";

const REGISTRY_PAGE_SIZE = 50;

// `labelKey` is under adminCentreQualitePage.
const QUALITE_TABS: { vue: QualiteVue; labelKey: string }[] = [
  { vue: "indicateurs", labelKey: "tabIndicators" },
  { vue: "registre", labelKey: "tabRegister" },
  { vue: "regles", labelKey: "tabRules" },
];

// A blocking anomaly or rule reads as an error, a non-blocking one as a warning.
function severityBadge(isBlocking: boolean): string {
  return isBlocking ? "cam-badge-error" : "cam-badge-warning";
}

// An open anomaly keeps its severity tone; RESOLVED and WAIVED are handled.
function anomalyStatusBadge(a: Pick<AnomalyRecord, "status" | "isBlocking">): string {
  return a.status === "OPEN" ? severityBadge(a.isBlocking) : "cam-badge-success";
}

// Suspense because useSearchParams() requires it in the app router.
export default function CentreQualitePage() {
  return (
    <Suspense fallback={null}>
      <CentreQualiteContent />
    </Suspense>
  );
}

function CentreQualiteContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vue = parseQualiteVue(searchParams.get("vue"));
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminCentreQualitePage");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canReadRegistry = !!role && ANOMALY_REGISTRY_ROLES.includes(role);
  const canGrantDerogation = !!role && ANOMALY_DEROGATION_ROLES.includes(role);

  // Both filters are sent to the server, so `total` always describes the same
  // query as the rows on screen and there is no client-side re-filtering that
  // could make the two disagree. They live in the URL (?status=, ?severity=),
  // so "open blocking anomalies" is a link that can be reloaded and shared.
  const filterStatus = parseAnomalyStatusFilter(searchParams.get("status"));
  const filterSeverity = parseSeverityFilter(searchParams.get("severity"));
  const setRegisterFilter = (key: "status" | "severity", value: string) =>
    router.replace(hrefWith(pathname, searchParams.toString(), { [key]: value === "ALL" ? null : value }));

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [resolutionType, setResolutionType] = useState<AnomalyResolutionType>("DECLARANT_CORRECTION");
  const [resolutionNote, setResolutionNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  /**
   * Anomaly registry.
   *
   * Source: GET /admin/questionnaires/anomalies/registry
   * (EligibilityEngineService.listAnomalies). Rows are scoped server-side to
   * the caller's territory; `total` counts the filtered query.
   *
   * There is no fallback dataset. If the registry is empty the screen says so
   * — which today is the truthful answer for every caller, because nothing in
   * the backend writes to `onefop_anomalies` yet (see
   * docs/admin-data-integrity-inventory.md §7.1).
   */
  // Each of the three queries runs only on its own tab (?vue=).
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "registry", filterStatus, filterSeverity],
    queryFn: () =>
      listAnomalyRegistry({
        limit: REGISTRY_PAGE_SIZE,
        status: filterStatus === "ALL" ? undefined : filterStatus,
        isBlocking:
          filterSeverity === "BLOCKING" ? true : filterSeverity === "WARNING" ? false : undefined,
      }),
    enabled: canReadRegistry && vue === "registre",
  });

  const qualityQuery = useQuery({
    queryKey: ["admin", "questionnaires", "quality", "summary"],
    queryFn: () => getQualitySummary(),
    enabled: canReadRegistry && vue === "indicateurs",
  });

  const quality = qualityQuery.data ?? null;

  const rulesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "rules"],
    queryFn: getValidationRules,
    enabled: canReadRegistry && vue === "regles",
  });

  const rulesState = resolveDataState({
    roleAllowed: canReadRegistry,
    isLoading: rulesQuery.isLoading,
    isError: rulesQuery.isError,
    error: rulesQuery.error,
    rowCount: rulesQuery.data?.length ?? null,
  });

  const items = useMemo(() => anomaliesQuery.data?.items ?? [], [anomaliesQuery.data]);
  const totalCount = anomaliesQuery.data?.total ?? null;

  const registryState = resolveDataState({
    roleAllowed: canReadRegistry,
    isLoading: anomaliesQuery.isLoading,
    isError: anomaliesQuery.isError,
    error: anomaliesQuery.error,
    rowCount: anomaliesQuery.data?.items.length ?? null,
  });

  /**
   * "Contrôles récents" panel: the five most recently detected rows of the
   * same real registry, by `detectedAt`. Not a separate event log — the system
   * keeps none — so the panel is labelled as a view of the registry.
   */

  const resolveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { resolutionType: AnomalyResolutionType; resolutionNote: string; evidenceUrl?: string } }) =>
      resolveAnomalyRecord(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      setSelectedAnomaly(null);
      setResolutionNote("");
      setEvidenceUrl("");
      setActionError(null);
      setSuccessToast(t("resolvedToast"));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(
        `${t("resolveError")} ${formatApiError(err, locale)}`,
      );
    },
  });

  const handleOpenResolveModal = (a: AnomalyRecord) => {
    setSelectedAnomaly(a);
    setResolutionType("DECLARANT_CORRECTION");
    setResolutionNote("");
    setEvidenceUrl("");
    setActionError(null);
  };

  const handleConfirmResolution = () => {
    if (!selectedAnomaly) return;
    if (!resolutionNote.trim()) {
      setActionError(t("resolutionNoteRequired"));
      return;
    }
    resolveMutation.mutate({
      id: selectedAnomaly.id,
      payload: {
        resolutionType,
        resolutionNote: resolutionNote.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined,
      },
    });
  };

  // The five rates. Each value is the server's own figure, formatted by
  // percent(); the hint carries the count it is a rate of, where one exists.
  const qualityKpis = [
    { key: "completeness", label: t("completeness"), value: quality?.completenessRate, hint: t("completeFiles") },
    { key: "coherence", label: t("coherence"), value: quality?.coherenceRate, hint: t("noContradiction") },
    { key: "anomalyRate", label: t("anomalyRate"), value: quality?.anomalyRate, hint: t("blockingCount", { count: count(quality?.blockingAnomaliesCount, locale) }) },
    { key: "warnings", label: t("warnings"), value: quality?.warningRate, hint: t("alertCount", { count: count(quality?.warningsCount, locale) }) },
    { key: "eligibility", label: t("eligibility"), value: quality?.statisticalEligibilityRate, hint: t("readyCount", { count: count(quality?.statisticallyReadyCount, locale) }) },
  ];

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.qualite") }, { label: tRoot("adminNav.routes.centreQualite") }]}
        title={tRoot("adminNav.routes.centreQualite")}
        actions={<AdminHeaderActions />}
      />

      {/* The page's three views, held in ?vue= so a reload or a shared link
          reopens the same one. An in-page view switch, not header hub tabs:
          they are views of one page, not sibling routes. A "Contrôle
          régional" view returns once GET quality/summary and
          anomalies/registry accept a `region` filter (both are
          territory-scoped by territoryFromUser today, so a REGIONAL_ADMIN
          cannot widen past its own ressort). */}
      <ViewSwitch
        label={t("viewsAriaLabel")}
        items={QUALITE_TABS.map((item) => ({
          key: item.vue,
          label: t(item.labelKey),
          href: hrefWith(pathname, searchParams.toString(), { vue: item.vue }),
          active: vue === item.vue,
        }))}
      />

      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* ── Indicateurs: the five rates and the anomaly aggregates ── */}
      {vue === "indicateurs" && (
        <>
          {/* Quality indicators. No frame around the row: the tiles are the
              cards, and a card does not sit inside another card. */}
          <section aria-labelledby="quality-kpis-title">
            <h2 id="quality-kpis-title" className="cam-admin-h2" style={{ marginBottom: "var(--cam-space-3)" }}>
              {t("qualityIndicatorsTitle")}
            </h2>
            {/* Five tiles, so the four-column .cam-pilot-kpis grid is widened
                to auto-fit rather than leaving one orphan on a second row. */}
            <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {qualityKpis.map((k) => (
                <div key={k.key} className="cam-pilot-kpi">
                  <span className="cam-pilot-kpi-label">{k.label}</span>
                  <span className="cam-pilot-kpi-value" aria-busy={qualityQuery.isLoading || undefined}>
                    {qualityQuery.isLoading ? NOT_PROVIDED : percent(k.value, 0, locale)}
                  </span>
                  <span className="cam-pilot-kpi-trend">{k.hint}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Authoritative aggregates by anomaly type and by region. */}
          <section className="cam-admin-section" aria-labelledby="anomalies-aggregates-title">
            <div className="cam-admin-section-head">
              <h2 id="anomalies-aggregates-title" className="cam-admin-h2">{t("aggregatesTitle")}</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--cam-space-5)" }}>
              <AggregateList
                title={t("byFamily")}
                loading={qualityQuery.isLoading}
                loadingLabel={t("loadingFamilies")}
                emptyLabel={t("noFamily")}
                rows={(quality?.byRuleFamily ?? []).map((f) => ({ key: f.ruleFamily, label: ruleFamilyLabel(f.ruleFamily, locale), count: count(f.count, locale) }))}
              />
              <AggregateList
                title={t("byRegion")}
                loading={qualityQuery.isLoading}
                loadingLabel={t("loadingRegions")}
                emptyLabel={t("noRegion")}
                rows={(quality?.byRegion ?? []).map((r) => ({ key: r.region, label: r.region, count: count(r.count, locale) }))}
              />
            </div>
          </section>
        </>
      )}

      {/* ── Règles de validation, as served by GET questionnaires/rules. The
          rule codes that appear in the register come from the stored
          anomalies themselves. ── */}
      {vue === "regles" && (
        <section className="cam-admin-section" aria-labelledby="regles-validation-title">
          <div className="cam-admin-section-head">
            <h2 id="regles-validation-title" className="cam-admin-h2">
              {t("rulesTitle")}{rulesQuery.data?.length !== undefined ? ` (${count(rulesQuery.data.length, locale)})` : ""}
            </h2>
            <span className="cam-badge cam-badge-success">{t("activeBadge")}</span>
          </div>
          <div className="cam-admin-section-body">
            {rulesState !== "ready" ? (
              <DataState
                dense
                state={rulesState}
                resource={t("rulesResource")}
                error={rulesQuery.error}
                onRetry={() => rulesQuery.refetch()}
                title={rulesState === "empty" ? t("noRuleTitle") : undefined}
                hint={rulesState === "empty" ? t("noRuleHint") : undefined}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
                {rulesQuery.data?.map((rule) => (
                  <div key={rule.code}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--cam-space-3)" }}>
                      <div>
                        <div className="cam-admin-strong">{rule.name}</div>
                        <div className="cam-admin-meta">
                          <span title={rule.code}>{t("familyLine", { family: ruleFamilyLabel(rule.family, locale) })}</span>
                        </div>
                      </div>
                      <span className={`cam-badge ${severityBadge(rule.isBlocking)}`}>
                        {rule.isBlocking ? t("blockingBadge") : t("warningBadge")}
                      </span>
                    </div>
                    <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{rule.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Registre des anomalies. "Détections récentes" — the first five rows
          of this same query, following its filters — sat beside the rules;
          it is folded into the register rather than shown twice. ── */}
      {vue === "registre" && (
        <section id="registre-anomalies" className="cam-admin-section" aria-labelledby="anomalies-registry-title">
          <div className="cam-admin-section-head">
            <div>
              <h2 id="anomalies-registry-title" className="cam-admin-h2">
                {t("registerTitle")}{totalCount === null ? "" : ` (${count(totalCount, locale)})`}
              </h2>
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("registerSubtitle")}</p>
            </div>
          </div>

          <div className="cam-admin-section-body">
            <div className="cam-admin-filters">
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="registre-status">{t("statusColumn")}</label>
                <select
                  id="registre-status"
                  className="cam-select"
                  value={filterStatus}
                  onChange={(e) => setRegisterFilter("status", e.target.value)}
                >
                  <option value="ALL">{t("allStatuses")}</option>
                  <option value="OPEN">{t("statusOpen")}</option>
                  <option value="RESOLVED">{t("statusResolved")}</option>
                  <option value="WAIVED">{t("statusWaived")}</option>
                </select>
              </div>
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="registre-severity">{t("severityColumn")}</label>
                <select
                  id="registre-severity"
                  className="cam-select"
                  value={filterSeverity}
                  onChange={(e) => setRegisterFilter("severity", e.target.value)}
                >
                  <option value="ALL">{t("allSeverities")}</option>
                  <option value="BLOCKING">{t("blockingOnly")}</option>
                  <option value="WARNING">{t("warningsOnly")}</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="cam-button cam-button-secondary"
                  onClick={() => anomaliesQuery.refetch()}
                >
                  {t("refresh")}
                </button>
              </div>
            </div>
          </div>

          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">{t("declarationColumn")}</th>
                  <th scope="col">{t("ruleColumn")}</th>
                  <th scope="col">{t("descriptionColumn")}</th>
                  <th scope="col">{t("severityColumn")}</th>
                  <th scope="col">{t("detectedColumn")}</th>
                  <th scope="col">{t("statusColumn")}</th>
                  <th scope="col" className="text-right">{t("actionColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading, error, authorization refusal and "no records" are
                    reported separately. No branch substitutes sample rows. */}
                <DataStateRow
                  colSpan={7}
                  state={registryState}
                  resource={t("registerResource")}
                  error={anomaliesQuery.error}
                  onRetry={() => anomaliesQuery.refetch()}
                  title={registryState === "empty" ? t("noAnomalyTitle") : undefined}
                  hint={registryState === "empty" ? t("noAnomalyHint") : undefined}
                />
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.submission ? (
                        <>
                          <Link
                            href={`/admin/dossiers/${encodeURIComponent(a.submission.id)}`}
                            className="cam-text-button"
                            title={anomalyDossierRef(a)}
                          >
                            {shortRecordId(anomalyDossierRef(a))}
                          </Link>
                          {/* Establishment name as stored on the submission's
                              company record, or nothing at all. */}
                          {anomalyCompanyName(a) && (
                            <span style={{ display: "block" }}>{anomalyCompanyName(a)}</span>
                          )}
                          <span className="cam-admin-meta" style={{ display: "block" }}>
                            {a.submission.region ?? NOT_PROVIDED}
                            {a.submission.department ? ` · ${a.submission.department}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="cam-admin-muted">{NOT_PROVIDED}</span>
                      )}
                    </td>
                    <td>
                      <span title={a.ruleCode}>{ruleFamilyLabel(a.ruleFamily, locale)}</span>
                    </td>
                    <td>
                      <div style={{ maxWidth: 360, wordBreak: "break-word" }}>{a.description}</div>
                      <div className="cam-admin-meta">
                        {t("observed")} <strong>{a.observedValue}</strong> &middot; {t("expected")} <strong>{a.expectedValue}</strong>
                        {a.deltaValue ? <> &middot; {t("gap")} <strong>{a.deltaValue}</strong></> : null}
                      </div>
                    </td>
                    <td>
                      <span className={`cam-badge ${severityBadge(a.isBlocking)}`}>
                        {a.isBlocking ? t("blocking") : t("warning")}
                      </span>
                    </td>
                    <td title={stamp(a.detectedAt, true, locale)}>
                      <span className="cam-admin-meta">{stamp(a.detectedAt, true, locale)}</span>
                    </td>
                    <td>
                      <span className={`cam-badge ${anomalyStatusBadge(a)}`}>
                        {t(`anomalyStatus.${a.status}`)}
                      </span>
                      {/* Resolution metadata only when the record carries it. */}
                      {a.resolvedAt && (
                        <span className="cam-admin-meta" style={{ display: "block" }}>
                          {stamp(a.resolvedAt, true, locale)}
                          {a.resolvedBy
                            ? ` · ${[a.resolvedBy.firstName, a.resolvedBy.lastName].filter(Boolean).join(" ").trim() || a.resolvedBy.email}`
                            : ""}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {/* Secondary: one primary action per view, and a row
                          action repeated fifty times is not it. */}
                      {a.status === "OPEN" ? (
                        <button
                          type="button"
                          className="cam-button cam-button-sm cam-button-secondary"
                          onClick={() => handleOpenResolveModal(a)}
                        >
                          {t("resolve")}
                        </button>
                      ) : (
                        <span className="cam-admin-meta">{t("handled")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Modal: Résolution d'Anomalie (Retained Functional Widget) ── */}
      {selectedAnomaly && (
        <AdminDialog
          open={!!selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          eyebrow={t("resolveEyebrow")}
          title={t("resolveTitle", { code: selectedAnomaly.ruleCode })}
          wide
          footer={
            <div style={{ display: "flex", gap: "var(--cam-space-3)", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedAnomaly(null)}
                disabled={resolveMutation.isPending}
              >
                {tRoot("common.cancel")}
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={handleConfirmResolution}
                disabled={resolveMutation.isPending}
              >
                {resolveMutation.isPending ? t("saving") : t("confirmResolution")}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            {actionError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{actionError}</span>
              </div>
            )}

            <div>
              <div className="cam-admin-strong">{selectedAnomaly.description}</div>
              <div className="cam-admin-meta">
                {/* A submission with no stored region is reported as such.
                    Printing "National" here would invent a territorial fact on
                    an authorization-sensitive field. */}
                {t("declarationLabel")} <strong>{anomalyDossierRef(selectedAnomaly)}</strong> &middot; {t("regionLabel")} <strong>{selectedAnomaly.submission?.region ?? NOT_PROVIDED}</strong>
              </div>
            </div>

            {/* Unboxed radio rows (CLAUDE.md §9): the whole label is the
                target, and no option is framed as a card. */}
            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>
                {t("resolutionMode")}
              </legend>

              <label className="cam-admin-choice">
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "DECLARANT_CORRECTION"}
                  onChange={() => setResolutionType("DECLARANT_CORRECTION")}
                />
                <span>
                  {t("modeCorrection")}
                  <span className="cam-admin-choice-hint">{t("modeCorrectionHint")}</span>
                </span>
              </label>

              <label className="cam-admin-choice">
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "FIELD_INSPECTION"}
                  onChange={() => setResolutionType("FIELD_INSPECTION")}
                />
                <span>
                  {t("modeInspection")}
                  <span className="cam-admin-choice-hint">{t("modeInspectionHint")}</span>
                </span>
              </label>

              <label className={`cam-admin-choice${!canGrantDerogation ? " is-disabled" : ""}`}>
                <input
                  type="radio"
                  name="resolution-type"
                  disabled={!canGrantDerogation}
                  checked={resolutionType === "LEGAL_DEROGATION"}
                  onChange={() => setResolutionType("LEGAL_DEROGATION")}
                />
                <span>
                  {t("modeDerogation")}
                  <span className="cam-admin-choice-hint">{t("modeDerogationHint")}</span>
                </span>
              </label>
            </fieldset>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="resolution-note">
                {t("justificationLabel")}
              </label>
              {/* Was className="cam-textarea", a class defined nowhere, so the
                  field rendered with browser defaults. */}
              <textarea
                id="resolution-note"
                className="cam-admin-textarea"
                rows={3}
                placeholder={t("justificationPlaceholder")}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="evidence-url">
                {t("evidenceLabel")}
              </label>
              <input
                id="evidence-url"
                type="text"
                className="cam-input"
                placeholder={t("evidencePlaceholder")}
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
            </div>
          </div>
        </AdminDialog>
      )}

    </div>
  );
}

/** One ranked aggregate: the label on the left, its stored count on the right. */
function AggregateList({
  title,
  loading,
  loadingLabel,
  emptyLabel,
  rows,
}: {
  title: string;
  loading: boolean;
  loadingLabel: string;
  emptyLabel: string;
  rows: { key: string; label: string; count: string }[];
}) {
  return (
    <div>
      <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-2)" }}>{title}</h3>
      {loading ? (
        <p className="cam-admin-meta" style={{ margin: 0 }}>{loadingLabel}</p>
      ) : rows.length === 0 ? (
        <p className="cam-admin-meta" style={{ margin: 0 }}>{emptyLabel}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
              <span>{r.label}</span>
              <span className="cam-admin-strong">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
