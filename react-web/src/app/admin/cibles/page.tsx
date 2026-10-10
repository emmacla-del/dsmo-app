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
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { CampaignReturnsTable } from "@/components/admin/CampaignReturnsTable";
import { TargetGrid } from "@/components/admin/TargetGrid";
import { useAuthStore } from "@/lib/auth-store";
import { NATIONAL_ROLES, hasRole } from "@/lib/roles";
import { isRegistrationCampaign, listCampaigns, type Campaign } from "@/lib/campaigns";
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
  coverageHref,
  putCampaignQuotas,
  type CampaignQuotasResponse,
  type TargetField,
} from "@/lib/pilotage-targets";

type Vue = "quotas" | "retours";
// `labelKey` is under adminCiblesPage.
const VUES: { id: Vue; labelKey: string }[] = [
  { id: "quotas", labelKey: "viewQuotas" },
  { id: "retours", labelKey: "viewReturns" },
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

  const rawVue = searchParams.get("vue");
  const vue = parseVue(rawVue);
  const campagneParam = searchParams.get("campagne")?.trim() || "";

  function setParams(next: { vue?: Vue; campagne?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextVue = next.vue ?? vue;
    params.set("vue", nextVue);
    const nextCampagne = next.campagne === undefined ? campagneParam : next.campagne;
    if (nextCampagne) params.set("campagne", nextCampagne);
    else params.delete("campagne");
    router.replace(`${pathname}?${params.toString()}`);
  }

  // The Couverture view moved to /admin/inscriptions (it measures
  // registrations). Old links and bookmarks are forwarded there with their
  // year; ?campagne= is dropped, the coverage view has no campaign.
  useEffect(() => {
    if (rawVue !== "couverture") return;
    router.replace(coverageHref(searchParams.get("annee")));
  }, [rawVue, searchParams, router]);

  // A retired or unknown vue (e.g. the former ?vue=inscriptions tab) normalizes
  // to the default tab, so the deep link lands on Quotas rather than an empty panel.
  useEffect(() => {
    if (rawVue == null || rawVue === vue || rawVue === "couverture") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("vue", vue);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawVue, vue, searchParams, pathname, router]);

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
        items={VUES.map((item) => ({
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
          {query.data.campaign.name} ({query.data.campaign.code}) — {campaignStatusLabel(t, query.data.campaign.status)}
        </p>
      )}

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
                    {campaign.code} — {campaign.name} ({campaignStatusLabel(tRoot, campaign.status)})
                  </option>
                ))}
              </optgroup>
            )}
            {registration.length > 0 && (
              <optgroup label={t("registrationCampaignsGroup")}>
                {registration.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.code} — {campaign.name} ({t("registrationStatus")})
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

  // Returns exist only for collection campaigns: the backend refuses a
  // registration campaign (it collects nothing). Missing purpose is a
  // pre-rename backend, where every campaign was a collection one.
  const onefop = useMemo(
    () =>
      (listQuery.data ?? []).filter(
        (campaign) => campaign.collectionType === "ONEFOP" && !isRegistrationCampaign(campaign),
      ),
    [listQuery.data],
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
    return <DataState state="empty" resource={tRoot("adminNav.routes.cibles")} title={t("noOnefopCollectionCampaign")} />;
  }

  const campaignId = selected;

  return (
    <>
      {canList && (
        <label className="cam-target-year">
          {t("onefopCollectionCampaignLabel")}
          <select
            className="cam-select"
            value={campaignId}
            onChange={(event) => onCampagneChange(event.target.value)}
          >
            {onefop.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.code} — {campaign.name} ({campaignStatusLabel(tRoot, campaign.status)})
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
        {query.data.campaign.name} ({query.data.campaign.code}) — {campaignStatusLabel(tRoot, query.data.campaign.status)}
      </p>
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
    </>
  );
}

// A campaign's stored status as its label (adminCampagnesPage.status), not as
// the raw enum code; an unknown status shows as stored.
const CAMPAIGN_STATUS_CODES = new Set(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]);

function campaignStatusLabel(tRoot: ReturnType<typeof useTranslations>, status: string): string {
  return CAMPAIGN_STATUS_CODES.has(status) ? tRoot(`adminCampagnesPage.status.${status}`) : status;
}

function preferredCampaignId(campaigns: Campaign[]): string {
  const active = campaigns.find((campaign) => campaign.status === "ACTIVE");
  return (active ?? campaigns[0])?.id ?? "";
}

function defaultExpanded(regions: { regionId: string; mode: string }[]): Set<string> {
  if (regions.length === 1) return new Set([regions[0].regionId]);
  return new Set(regions.filter((region) => region.mode === "MIXED").map((region) => region.regionId));
}

function parseVue(raw: string | null): Vue {
  if (raw === "quotas" || raw === "retours") return raw;
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
  if (campagne) params.set("campagne", campagne);
  else params.delete("campagne");
  return params.toString();
}
