"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState } from "@/components/admin/DataState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { CampaignReturnsTable } from "@/components/admin/CampaignReturnsTable";
import { CoveragePanel, type CoverageSelection } from "@/components/admin/CoveragePanel";
import { TargetGrid } from "@/components/admin/TargetGrid";
import { useAuthStore } from "@/lib/auth-store";
import { NATIONAL_ROLES, REGISTRATION_ROLES, SURVEY_ROLES, hasRole } from "@/lib/roles";
import { formatCampaignDisplayName, isRegistrationCampaign, listCampaigns, type Campaign } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { asUiLocale } from "@/lib/register-i18n";
import {
  buildTargetPayload,
  clearRegionDraft,
  hasUnsavedChanges,
  initDrafts,
  normalizeRegions,
  type PayloadChange,
  type RegionDraft,
} from "@/lib/pilotage-target-payload";
import {
  canListCampaigns,
  canWritePilotageTargets,
  formatApiError,
  getCampaignQuotas,
  getCampaignReturns,
  getActiveCollectionCampaigns,
  coverageHref,
  doualaCalendarYear,
  parseYearParam,
  putCampaignQuotas,
  type CampaignQuotasResponse,
  type TargetField,
} from "@/lib/pilotage-targets";

type Vue = "quotas" | "retours" | "couverture" | "relances";
// `labelKey` is under adminCiblesPage.
const VUES: { id: Exclude<Vue, "relances">; labelKey: string }[] = [
  { id: "quotas", labelKey: "viewQuotas" },
  { id: "retours", labelKey: "viewReturns" },
  { id: "couverture", labelKey: "viewRegistrationCoverage" },
];

export default function CiblesPage() {
  return (
    <Suspense fallback={null}>
      <CiblesContent />
    </Suspense>
  );
}

function CiblesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const t = useTranslations();
  const canWrite = canWritePilotageTargets(user?.role);
  const canList = canListCampaigns(user?.role);
  const canReadSubmissionViews = hasRole(user?.role, SURVEY_ROLES);
  const canReadRegistrationCoverage = hasRole(user?.role, REGISTRATION_ROLES);
  const visibleViews = VUES.filter((item) => {
    if (item.id === "couverture") return canReadRegistrationCoverage;
    if (item.id === "quotas") return canReadSubmissionViews && canList;
    return canReadSubmissionViews;
  });

  const rawVue = searchParams.get("vue");
  const vue = parseVue(rawVue);
  const campagneParam = searchParams.get("campagne")?.trim() || "";
  const defaultVue = visibleViews[0]?.id ?? "quotas";
  const vueAllowed = visibleViews.some((item) => item.id === vue);
  const selectedCoveragePeriod = coveragePeriodSelection(searchParams);

  function setParams(next: { vue?: Vue; campagne?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextVue = next.vue ?? vue;
    params.set("vue", nextVue);
    const nextCampagne = next.campagne === undefined ? campagneParam : next.campagne;
    if (nextCampagne) params.set("campagne", nextCampagne);
    else params.delete("campagne");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setCoveragePeriod(next: CoverageSelection) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vue", "couverture");
    params.set("annee", String(next.year));
    if (next.semester != null) params.set("semestre", String(next.semester));
    else params.delete("semestre");
    if (next.quarter != null) params.set("trimestre", String(next.quarter));
    else params.delete("trimestre");
    params.delete("campagne");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Keep saved campaign follow-up links working while the workflow lives with
  // survey submissions. Convert Campaign targets' `campagne` parameter to
  // the dossiers hub's shared `campaignId` parameter.
  useEffect(() => {
    if (rawVue !== "relances") return;
    if (!canReadSubmissionViews) {
      router.replace(`${pathname}?${viewQuery(searchParams, defaultVue, campagneParam)}`);
      return;
    }
    const params = new URLSearchParams({ vue: "followup" });
    if (campagneParam) params.set("campaignId", campagneParam);
    router.replace(`/admin/dossiers?${params.toString()}`);
  }, [canReadSubmissionViews, campagneParam, defaultVue, pathname, rawVue, router, searchParams]);

  // A role-specific deep link is redirected to the first view that role may
  // open. Unknown view names still normalize to the role's default view.
  useEffect(() => {
    if (!user?.role || rawVue === "relances") return;
    if ((rawVue == null && vueAllowed) || (rawVue === vue && vueAllowed)) return;
    router.replace(`${pathname}?${viewQuery(searchParams, vueAllowed ? vue : defaultVue, campagneParam)}`);
  }, [user?.role, rawVue, vue, vueAllowed, defaultVue, campagneParam, searchParams, pathname, router]);

  if (rawVue === "relances" || !vueAllowed) return null;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: t("adminNav.hubs.collecte") }, { label: t("adminNav.routes.cibles") }]}
        title={t("adminNav.routes.cibles")}
        subtitle={t("adminCiblesPage.subtitle")}
        actions={<AdminHeaderActions />}
      />

      {!canWrite && (
        <p className="cam-admin-notice cam-admin-notice--info">
          {user?.department
            ? t("adminCiblesPage.readOnlyDepartment", { department: user.department })
            : user?.region
              ? t("adminCiblesPage.readOnlyRegion", { region: user.region })
              : t("adminCiblesPage.readOnly")}
        </p>
      )}

      <ViewSwitch
        label={t("adminCiblesPage.viewsAriaLabel")}
        items={visibleViews.map((item) => ({
          key: item.id,
          label: t(`adminCiblesPage.${item.labelKey}`),
          active: vue === item.id,
          href: `${pathname}?${viewQuery(searchParams, item.id, campagneParam)}`,
        }))}
      />

      {vue === "quotas" && (
        <QuotasPanel
          canWrite={canWrite}
          canList={canList}
          campagneParam={campagneParam}
          onCampagneChange={(id) => setParams({ campagne: id || null })}
          showCentral={isNational(user?.role)}
        />
      )}
      {vue === "retours" && (
        <ReturnsPanel
          canList={canList}
          campagneParam={campagneParam}
          onCampagneChange={(id) => setParams({ campagne: id || null })}
        />
      )}
      {vue === "couverture" && (
        <CoveragePanel
          year={parseYearParam(searchParams.get("annee")) ?? doualaCalendarYear()}
          semester={selectedCoveragePeriod.semester}
          quarter={selectedCoveragePeriod.quarter}
          onPeriodChange={setCoveragePeriod}
        />
      )}
    </div>
  );
}

/**
 * The campaign quota editor. It was once shared with the year-scoped
 * inscription targets, which is why `field` is still threaded through
 * buildTargetPayload and normalizeRegions rather than hard-coded: the payload
 * helpers remain written for either field. The panel itself only ever reads
 * and writes campaign quotas.
 */
function TargetsPanel({
  field,
  canWrite,
  showCentral,
  campaignId,
}: {
  field: TargetField;
  campaignId: string;
  canWrite: boolean;
  showCentral: boolean;
}) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const query = useQuery<CampaignQuotasResponse>({
    queryKey: ["admin", "pilotage", "quotas", campaignId],
    queryFn: () => getCampaignQuotas(campaignId),
    enabled: !!campaignId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const regions = useMemo(
    () => (query.data ? normalizeRegions(query.data.regions, field) : []),
    [query.data, field],
  );
  const originalCentral = readCentral(query.data?.central);

  const [drafts, setDrafts] = useState<Record<string, RegionDraft>>({});
  const [centralInput, setCentralInput] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PayloadChange[]>([]);
  const draftsBeforeClear = useRef<Record<string, RegionDraft> | null>(null);

  const unsavedChanges = useMemo(
    () =>
      hasUnsavedChanges({
        regions,
        drafts,
        originalCentral,
        centralInput,
      }),
    [regions, drafts, originalCentral, centralInput],
  );

  useEffect(() => {
    if (!query.data) return;
    setDrafts(initDrafts(regions));
    setCentralInput(originalCentral == null ? "" : String(originalCentral));
    setClientErrors([]);
    setExpanded(defaultExpanded(regions));
  }, [query.data, regions, originalCentral]);

  const mutation = useMutation<CampaignQuotasResponse, unknown, void>({
    mutationFn: () => {
      const built = buildTargetPayload({
        field,
        regions,
        drafts,
        originalCentral,
        centralInput,
        locale,
      });
      if (!built.ok) throw new Error(built.errors.join(" "));
      return putCampaignQuotas(campaignId, built.body);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "pilotage", "quotas", campaignId], data);
      draftsBeforeClear.current = null;
      setConfirmOpen(false);
      setClientErrors([]);
    },
  });

  function requestSave(nextDrafts?: Record<string, RegionDraft>) {
    const usedDrafts = nextDrafts ?? drafts;
    const built = buildTargetPayload({
      field,
      regions,
      drafts: usedDrafts,
      originalCentral,
      centralInput,
      locale,
    });
    if (!built.ok) {
      if (nextDrafts && draftsBeforeClear.current) {
        setDrafts(draftsBeforeClear.current);
        draftsBeforeClear.current = null;
      }
      setClientErrors(built.errors);
      return;
    }
    setClientErrors([]);
    setPendingChanges(built.changes);
    setConfirmOpen(true);
  }

  function requestClear(regionId: string) {
    const region = regions.find((item) => item.regionId === regionId);
    if (!region) return;
    draftsBeforeClear.current = drafts;
    const next = { ...drafts, [regionId]: clearRegionDraft(region) };
    setDrafts(next);
    requestSave(next);
  }

  function closeConfirm() {
    if (mutation.isPending) return;
    if (draftsBeforeClear.current) {
      setDrafts(draftsBeforeClear.current);
      draftsBeforeClear.current = null;
    }
    setConfirmOpen(false);
  }

  if (query.isLoading) {
    return <DataState state="loading" resource={t("adminNav.routes.cibles")} title={t("common.loading")} />;
  }
  if (query.isError) {
    return (
      <DataState
        state="error"
        resource={t("adminNav.routes.cibles")}
        title={formatApiError(query.error, locale)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const saveError = mutation.isError ? formatApiError(mutation.error, locale) : null;

  return (
    <>
      {query.isSuccess && mutation.isSuccess && !confirmOpen && (
        <div className="cam-admin-notice cam-admin-notice--success">{t("adminCiblesPage.targetsSaved")}</div>
      )}
      {clientErrors.length > 0 && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">
          {clientErrors.map((error) => (
            <p key={error} style={{ margin: 0 }}>{error}</p>
          ))}
        </div>
      )}
      {saveError && confirmOpen === false && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">{saveError}</div>
      )}

      {query.data && (
        <p className="cam-admin-lede">
          {formatCampaignDisplayName(query.data.campaign.name)} — {referencePeriodLabel(query.data.campaign.code, locale)} — {campaignStatusLabel(t, query.data.campaign.status)}
        </p>
      )}

      <AdminTablePanel title={t("adminCiblesPage.viewQuotas")} headingId="campaign-targets-table-heading">
      <TargetGrid
        regions={regions}
        drafts={drafts}
        onDraftChange={(regionId, next) => setDrafts((current) => ({ ...current, [regionId]: next }))}
        onClearRegion={requestClear}
        centralInput={centralInput}
        onCentralChange={setCentralInput}
        showCentral={showCentral}
        canWrite={canWrite}
        expanded={expanded}
        hasUnsavedChanges={unsavedChanges}
        onToggle={(regionId) =>
          setExpanded((current) => {
            const next = new Set(current);
            if (next.has(regionId)) next.delete(regionId);
            else next.add(regionId);
            return next;
          })
        }
      />

      {canWrite && (
        <div className="cam-target-actions">
          <button type="button" className="cam-button cam-button-primary" onClick={() => requestSave()} disabled={mutation.isPending}>
            {t("common.save")}
          </button>
        </div>
      )}
      </AdminTablePanel>

      <AdminDialog
        open={confirmOpen}
        onClose={closeConfirm}
        title={t("adminCiblesPage.confirmSaveTitle")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={closeConfirm} disabled={mutation.isPending}>
              {t("common.cancel")}
            </button>
            <button type="button" className="cam-button cam-button-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : t("adminCiblesPage.confirmButton")}
            </button>
          </>
        }
      >
        <p>{t("adminCiblesPage.confirmSaveBody")}</p>
        <ul className="cam-target-changes">
          {pendingChanges.map((change) => (
            <li key={`${change.kind}-${change.name}`}>
              <strong>{change.name}</strong> : {change.from} → {change.to}
            </li>
          ))}
        </ul>
        {saveError && <p role="alert" style={{ color: "var(--cam-error)" }}>{saveError}</p>}
      </AdminDialog>
    </>
  );
}

function QuotasPanel({
  canWrite,
  canList,
  campagneParam,
  onCampagneChange,
  showCentral,
}: {
  canWrite: boolean;
  canList: boolean;
  campagneParam: string;
  onCampagneChange: (id: string) => void;
  showCentral: boolean;
}) {
  const t = useTranslations("adminCiblesPage");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const listQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: canList,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const onefop = useMemo(
    () => (listQuery.data ?? []).filter((campaign) => campaign.collectionType === "ONEFOP"),
    [listQuery.data],
  );

  const selected = campagneParam || preferredCampaignId(onefop);
  const didSelect = useRef(false);
  useEffect(() => {
    if (didSelect.current || !canList || campagneParam || !selected) return;
    didSelect.current = true;
    onCampagneChange(selected);
  }, [canList, campagneParam, selected, onCampagneChange]);

  if (!canList && !campagneParam) {
    return <DataState state="unavailable" resource={tRoot("adminNav.routes.cibles")} title={t("noCampaignListDepartmental")} />;
  }

  if (canList && listQuery.isLoading) {
    return <DataState state="loading" resource={tRoot("adminNav.routes.cibles")} title={t("loadingCampaigns")} />;
  }
  if (canList && listQuery.isError) {
    return (
      <DataState
        state="error"
        resource={tRoot("adminNav.routes.cibles")}
        title={formatApiError(listQuery.error, locale)}
        onRetry={() => listQuery.refetch()}
      />
    );
  }
  if (canList && onefop.length === 0) {
    return <DataState state="empty" resource={tRoot("adminNav.routes.cibles")} title={t("noOnefopCampaign")} />;
  }

  const campaignId = campagneParam || selected;
  // Both kinds carry quotas: a collection campaign's are declaration quotas
  // (read by Suivi des retours), a registration campaign's are inscription
  // targets (read by Couverture). Grouped so the two never look alike.
  const collection = onefop.filter((campaign) => !isRegistrationCampaign(campaign));
  const registration = onefop.filter(isRegistrationCampaign);
  const selectedCampaign = onefop.find((campaign) => campaign.id === campaignId);

  return (
    <>
      {canList && (
        <label className="cam-target-year">
          {t("onefopCampaignLabel")}
          <select
            className="cam-select"
            value={campaignId}
            onChange={(event) => onCampagneChange(event.target.value)}
          >
            {collection.length > 0 && (
              <optgroup label={t("collectionCampaignsGroup")}>
                {collection.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {referencePeriodLabel(campaign.code, locale)} — {formatCampaignDisplayName(campaign.name)} ({campaignStatusLabel(tRoot, campaign.status)})
                  </option>
                ))}
              </optgroup>
            )}
            {registration.length > 0 && (
              <optgroup label={t("registrationCampaignsGroup")}>
                {registration.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {referencePeriodLabel(campaign.code, locale)} — {formatCampaignDisplayName(campaign.name)} ({t("registrationStatus")})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}
      {selectedCampaign && (
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          {isRegistrationCampaign(selectedCampaign)
            ? <>{t("registrationTargetsNoteBefore")} <Link href={coverageHref(null)}>{t("registrationTargetsNoteLink")}</Link> {t("registrationTargetsNoteAfter")}</>
            : t("declarationQuotasNote")}
        </p>
      )}
      {campaignId && (
        <TargetsPanel
          field="submissionTarget"
          campaignId={campaignId}
          canWrite={canWrite}
          showCentral={showCentral}
        />
      )}
    </>
  );
}

/** Campaign picker and canonical campaign returns table. */
function ReturnsPanel({
  canList,
  campagneParam,
  onCampagneChange,
}: {
  canList: boolean;
  campagneParam: string;
  onCampagneChange: (id: string) => void;
}) {
  const t = useTranslations("adminCiblesPage");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const listQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: canList,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const activeCampaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "active-campaigns"],
    queryFn: getActiveCollectionCampaigns,
    enabled: !canList && !campagneParam,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Returns exist only for collection campaigns: the backend refuses a
  // registration campaign (it collects nothing). Readers who cannot list
  // every campaign use the reader-scoped active collection endpoint unless
  // the source route already supplied a specific campaign.
  const onefop = useMemo(
    () => canList
      ? (listQuery.data ?? []).filter(
          (campaign) => campaign.collectionType === "ONEFOP" && !isRegistrationCampaign(campaign),
        )
      : (activeCampaignsQuery.data ?? []).filter((campaign) => campaign.collectionType === "ONEFOP"),
    [canList, listQuery.data, activeCampaignsQuery.data],
  );

  // ?campagne= is shared with the Quotas tab, which also lists registration
  // campaigns. A parameter this tab cannot show falls back to the preferred
  // collection campaign instead of requesting returns that would 400.
  const paramShowable = !canList || !campagneParam || onefop.some((campaign) => campaign.id === campagneParam);
  const fallback = preferredCampaignId(onefop);
  const selected = (paramShowable && campagneParam) || fallback;
  const didSelect = useRef(false);
  useEffect(() => {
    if (!canList || !listQuery.isSuccess || !selected) return;
    if (campagneParam && paramShowable) return;
    if (!campagneParam && didSelect.current) return;
    didSelect.current = true;
    onCampagneChange(selected);
  }, [canList, listQuery.isSuccess, campagneParam, paramShowable, selected, onCampagneChange]);

  const campaignCatalogLoading = canList ? listQuery.isLoading : activeCampaignsQuery.isLoading;
  const campaignCatalogError = canList ? listQuery.error : activeCampaignsQuery.error;
  const retryCampaignCatalog = canList ? () => listQuery.refetch() : () => activeCampaignsQuery.refetch();
  if (campaignCatalogLoading) {
    return <DataState state="loading" resource={tRoot("adminNav.routes.cibles")} title={t("loadingCampaigns")} />;
  }
  if (campaignCatalogError) {
    return (
      <DataState
        state="error"
        resource={tRoot("adminNav.routes.cibles")}
        title={formatApiError(campaignCatalogError, locale)}
        onRetry={retryCampaignCatalog}
      />
    );
  }
  if (onefop.length === 0 && (canList || !campagneParam)) {
    return <DataState state="empty" resource={tRoot("adminNav.routes.cibles")} title={t("noOnefopCollectionCampaign")} />;
  }

  const campaignId = selected;

  return (
    <>
      {(canList || onefop.length > 1) && (
        <label className="cam-target-year">
          {t("onefopCollectionCampaignLabel")}
          <select
            className="cam-select"
            value={campaignId}
            onChange={(event) => onCampagneChange(event.target.value)}
          >
            {onefop.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {referencePeriodLabel(campaign.code, locale)} — {formatCampaignDisplayName(campaign.name)} ({campaignStatusLabel(tRoot, campaign.status)})
              </option>
            ))}
          </select>
        </label>
      )}
      {campaignId && <ReturnsContent campaignId={campaignId} />}
    </>
  );
}

function ReturnsContent({ campaignId }: { campaignId: string }) {
  const t = useTranslations("adminCiblesPage");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const query = useQuery({
    queryKey: ["admin", "pilotage", "returns", campaignId],
    queryFn: () => getCampaignReturns(campaignId),
    enabled: !!campaignId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!query.data) return;
    setExpanded(new Set(query.data.regions.map((region) => region.regionId)));
  }, [query.data]);

  if (query.isLoading) {
    return <DataState state="loading" resource={tRoot("adminNav.routes.cibles")} title={t("loadingReturns")} />;
  }
  if (query.isError) {
    return (
      <DataState
        state="error"
        resource={tRoot("adminNav.routes.cibles")}
        title={formatApiError(query.error, locale)}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return null;

  return (
    <>
      <p className="cam-admin-lede">
        {formatCampaignDisplayName(query.data.campaign.name)} — {referencePeriodLabel(query.data.campaign.code, locale)} — {campaignStatusLabel(tRoot, query.data.campaign.status)}
      </p>
      <AdminTablePanel title={t("viewReturns")} headingId="campaign-returns-table-heading">
        <CampaignReturnsTable
          data={query.data}
          expanded={expanded}
          onToggle={(regionId) =>
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(regionId)) next.delete(regionId);
              else next.add(regionId);
              return next;
            })
          }
        />
      </AdminTablePanel>
    </>
  );
}

// A campaign's stored status as its label (adminCampagnesPage.status), not as
// the raw enum code; an unknown status shows as stored.
const CAMPAIGN_STATUS_CODES = new Set(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]);

function campaignStatusLabel(tRoot: ReturnType<typeof useTranslations>, status: string): string {
  return CAMPAIGN_STATUS_CODES.has(status) ? tRoot(`adminCampagnesPage.status.${status}`) : status;
}

function preferredCampaignId(campaigns: readonly Pick<Campaign, "id" | "status">[]): string {
  const active = campaigns.find((campaign) => campaign.status === "ACTIVE");
  return (active ?? campaigns[0])?.id ?? "";
}

function defaultExpanded(regions: { regionId: string; mode: string }[]): Set<string> {
  if (regions.length === 1) return new Set([regions[0].regionId]);
  return new Set(regions.filter((region) => region.mode === "MIXED").map((region) => region.regionId));
}

function parseVue(raw: string | null): Vue {
  if (raw === "coverage" || raw === "couverture") return "couverture";
  if (raw === "quotas" || raw === "retours" || raw === "relances") return raw;
  return "quotas";
}

function isNational(role: string | undefined): boolean {
  return hasRole(role, NATIONAL_ROLES);
}

function readCentral(central: { submissionTarget?: number } | null | undefined): number | null {
  if (!central) return null;
  const value = central.submissionTarget;
  return typeof value === "number" ? value : null;
}

function viewQuery(searchParams: URLSearchParams, vue: Vue, campagne: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("vue", vue);
  if (vue === "couverture") {
    params.delete("campagne");
  } else {
    if (campagne) params.set("campagne", campagne);
    else params.delete("campagne");
    params.delete("annee");
    params.delete("semestre");
    params.delete("trimestre");
  }
  return params.toString();
}

function coveragePeriodSelection(params: { get: (key: string) => string | null }): Pick<CoverageSelection, "semester" | "quarter"> {
  const requestedSemester = params.get("semestre");
  const requestedQuarter = params.get("trimestre");
  const validSemester = requestedSemester === "1" || requestedSemester === "2"
    ? Number(requestedSemester) as 1 | 2
    : null;
  const validQuarter = ["1", "2", "3", "4"].includes(requestedQuarter ?? "")
    ? Number(requestedQuarter) as 1 | 2 | 3 | 4
    : null;
  const semester: CoverageSelection["semester"] = validQuarter != null
    ? validSemester ?? (validQuarter <= 2 ? 1 : 2)
    : validSemester;
  const quarter: CoverageSelection["quarter"] = validQuarter != null
    && semester != null
    && (validQuarter <= 2 ? 1 : 2) === semester
    ? validQuarter
    : null;
  return { semester, quarter };
}
