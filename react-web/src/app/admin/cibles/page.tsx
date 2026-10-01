"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CoverageTable } from "@/components/admin/CoverageTable";
import { TargetGrid } from "@/components/admin/TargetGrid";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns, type Campaign } from "@/lib/campaigns";
import {
  buildTargetPayload,
  initDrafts,
  normalizeRegions,
  type PayloadChange,
  type RegionDraft,
} from "@/lib/pilotage-target-payload";
import {
  canListCampaigns,
  canWritePilotageTargets,
  doualaCalendarYear,
  formatApiError,
  getCampaignQuotas,
  getCoverage,
  getInscriptionTargets,
  parseYearParam,
  putCampaignQuotas,
  putInscriptionTargets,
  YEAR_MAX,
  YEAR_MIN,
  type CampaignQuotasResponse,
  type InscriptionTargetsResponse,
  type TargetField,
} from "@/lib/pilotage-targets";

type GridResponse = InscriptionTargetsResponse | CampaignQuotasResponse;

type Vue = "inscriptions" | "couverture" | "quotas";
const VUES: { id: Vue; label: string }[] = [
  { id: "inscriptions", label: "Objectifs d'inscription" },
  { id: "couverture", label: "Couverture" },
  { id: "quotas", label: "Quotas de campagne" },
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
  const canWrite = canWritePilotageTargets(user?.role);
  const canList = canListCampaigns(user?.role);

  const vue = parseVue(searchParams.get("vue"));
  const yearFromUrl = parseYearParam(searchParams.get("annee"));
  const year = yearFromUrl ?? doualaCalendarYear();
  const campagneParam = searchParams.get("campagne")?.trim() || "";

  const [yearDraft, setYearDraft] = useState(String(year));
  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  function setParams(next: { vue?: Vue; annee?: number; campagne?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextVue = next.vue ?? vue;
    params.set("vue", nextVue);
    const nextYear = next.annee ?? year;
    params.set("annee", String(nextYear));
    const nextCampagne = next.campagne === undefined ? campagneParam : next.campagne;
    if (nextCampagne) params.set("campagne", nextCampagne);
    else params.delete("campagne");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Cibles et couverture" }]}
        title="Cibles et couverture"
        subtitle="Objectifs d'inscription par année, couverture du répertoire et quotas des campagnes ONEFOP."
        actions={<AdminHeaderActions />}
      />

      {!canWrite && (
        <p className="cam-admin-notice" style={{ marginBottom: "var(--cam-space-4)" }}>
          Consultation seulement
          {user?.department
            ? ` — département ${user.department}`
            : user?.region
              ? ` — région ${user.region}`
              : ""}.
        </p>
      )}

      <nav className="cam-admin-tabs" aria-label="Vues cibles">
        {VUES.map((item) => (
          <Link
            key={item.id}
            href={`${pathname}?${viewQuery(searchParams, item.id, year, campagneParam)}`}
            className="cam-admin-tab"
            role="tab"
            aria-selected={vue === item.id}
            style={{ textDecoration: "none" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="cam-target-toolbar">
        {vue !== "quotas" && (
          <label className="cam-target-year">
            Année
            <input
              className="cam-input"
              type="number"
              min={YEAR_MIN}
              max={YEAR_MAX}
              value={yearDraft}
              onChange={(event) => setYearDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseYearParam(yearDraft);
                if (parsed != null && parsed !== year) setParams({ annee: parsed });
                else setYearDraft(String(year));
              }}
            />
          </label>
        )}
      </div>

      {vue === "inscriptions" && (
        <TargetsPanel
          kind="inscriptions"
          field="inscriptionTarget"
          year={year}
          canWrite={canWrite}
          showCentral={isNational(user?.role)}
        />
      )}
      {vue === "couverture" && <CoveragePanel year={year} />}
      {vue === "quotas" && (
        <QuotasPanel
          canWrite={canWrite}
          canList={canList}
          campagneParam={campagneParam}
          onCampagneChange={(id) => setParams({ campagne: id || null })}
          showCentral={isNational(user?.role)}
        />
      )}
    </div>
  );
}

function TargetsPanel({
  kind,
  field,
  year,
  canWrite,
  showCentral,
  campaignId,
}: {
  kind: "inscriptions" | "quotas";
  field: TargetField;
  year?: number;
  campaignId?: string;
  canWrite: boolean;
  showCentral: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery<GridResponse>({
    queryKey: kind === "inscriptions" ? ["admin", "pilotage", "inscriptions", year] : ["admin", "pilotage", "quotas", campaignId],
    queryFn: () =>
      kind === "inscriptions"
        ? getInscriptionTargets(year as number)
        : getCampaignQuotas(campaignId as string),
    enabled: kind === "inscriptions" ? year != null : !!campaignId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const regions = useMemo(
    () => (query.data ? normalizeRegions(query.data.regions, field) : []),
    [query.data, field],
  );
  const originalCentral = readCentral(query.data?.central, field);

  const [drafts, setDrafts] = useState<Record<string, RegionDraft>>({});
  const [centralInput, setCentralInput] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PayloadChange[]>([]);

  useEffect(() => {
    if (!query.data) return;
    setDrafts(initDrafts(regions));
    setCentralInput(originalCentral == null ? "" : String(originalCentral));
    setClientErrors([]);
    setExpanded(defaultExpanded(regions));
  }, [query.data, regions, originalCentral]);

  const mutation = useMutation<GridResponse, unknown, void>({
    mutationFn: () => {
      const built = buildTargetPayload({
        field,
        regions,
        drafts,
        originalCentral,
        centralInput,
      });
      if (!built.ok) throw new Error(built.errors.join(" "));
      return kind === "inscriptions"
        ? putInscriptionTargets(year as number, built.body)
        : putCampaignQuotas(campaignId as string, built.body);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        kind === "inscriptions" ? ["admin", "pilotage", "inscriptions", year] : ["admin", "pilotage", "quotas", campaignId],
        data,
      );
      setConfirmOpen(false);
      setClientErrors([]);
    },
  });

  function requestSave() {
    const built = buildTargetPayload({
      field,
      regions,
      drafts,
      originalCentral,
      centralInput,
    });
    if (!built.ok) {
      setClientErrors(built.errors);
      return;
    }
    setClientErrors([]);
    setPendingChanges(built.changes);
    setConfirmOpen(true);
  }

  if (query.isLoading) return <p className="cam-admin-lede">Chargement…</p>;
  if (query.isError) {
    return <div className="cam-admin-notice cam-admin-notice--error" role="alert">{formatApiError(query.error)}</div>;
  }

  const saveError = mutation.isError ? formatApiError(mutation.error) : null;
  const scope = kind === "inscriptions" ? `l'année ${year}` : "cette campagne";

  return (
    <>
      {query.isSuccess && mutation.isSuccess && !confirmOpen && (
        <div className="cam-admin-notice cam-admin-notice--success">Objectifs enregistrés.</div>
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

      {kind === "quotas" && query.data && "campaign" in query.data && (
        <p className="cam-admin-lede">
          {query.data.campaign.name} ({query.data.campaign.code}) — {query.data.campaign.status}
        </p>
      )}

      <TargetGrid
        regions={regions}
        drafts={drafts}
        onDraftChange={(regionId, next) => setDrafts((current) => ({ ...current, [regionId]: next }))}
        centralInput={centralInput}
        onCentralChange={setCentralInput}
        showCentral={showCentral}
        canWrite={canWrite}
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

      {canWrite && (
        <div className="cam-target-actions">
          <button type="button" className="cam-button cam-button-primary" onClick={requestSave} disabled={mutation.isPending}>
            Enregistrer
          </button>
        </div>
      )}

      <AdminDialog
        open={confirmOpen}
        onClose={() => !mutation.isPending && setConfirmOpen(false)}
        title="Confirmer l'enregistrement"
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={() => setConfirmOpen(false)} disabled={mutation.isPending}>
              Annuler
            </button>
            <button type="button" className="cam-button cam-button-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : "Confirmer"}
            </button>
          </>
        }
      >
        <p>Ces objectifs remplaceront les valeurs enregistrées pour {scope}.</p>
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

function CoveragePanel({ year }: { year: number }) {
  const query = useQuery({
    queryKey: ["admin", "pilotage", "coverage", year],
    queryFn: () => getCoverage(year),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!query.data) return;
    const mixed = query.data.regions.filter((region) => region.mode === "MIXED").map((region) => region.regionId);
    setExpanded(new Set(query.data.regions.length === 1 ? query.data.regions.map((region) => region.regionId) : mixed));
  }, [query.data]);

  if (query.isLoading) return <p className="cam-admin-lede">Chargement…</p>;
  if (query.isError) {
    return <div className="cam-admin-notice cam-admin-notice--error" role="alert">{formatApiError(query.error)}</div>;
  }
  if (!query.data) return null;

  return (
    <CoverageTable
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
    return (
      <p className="cam-admin-lede">
        La liste des campagnes n&apos;est pas disponible au niveau départemental. Un identifiant de campagne dans l&apos;adresse permet la consultation.
      </p>
    );
  }

  if (canList && listQuery.isLoading) return <p className="cam-admin-lede">Chargement des campagnes…</p>;
  if (canList && listQuery.isError) {
    return <div className="cam-admin-notice cam-admin-notice--error" role="alert">{formatApiError(listQuery.error)}</div>;
  }
  if (canList && onefop.length === 0) {
    return <p className="cam-admin-lede">Aucune campagne ONEFOP n&apos;est disponible.</p>;
  }

  const campaignId = campagneParam || selected;

  return (
    <>
      {canList && (
        <label className="cam-target-year" style={{ marginBottom: "var(--cam-space-4)" }}>
          Campagne ONEFOP
          <select
            className="cam-select"
            value={campaignId}
            onChange={(event) => onCampagneChange(event.target.value)}
          >
            {onefop.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.code} — {campaign.name} ({campaign.status})
              </option>
            ))}
          </select>
        </label>
      )}
      {campaignId && (
        <TargetsPanel
          kind="quotas"
          field="submissionTarget"
          campaignId={campaignId}
          canWrite={canWrite}
          showCentral={showCentral}
        />
      )}
    </>
  );
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
  if (raw === "couverture" || raw === "quotas" || raw === "inscriptions") return raw;
  return "inscriptions";
}

function isNational(role: string | undefined): boolean {
  return role === "CENTRAL" || role === "SUPER_ADMIN" || role === "SUPER_ADMIN_ONEFOP";
}

function readCentral(
  central: { inscriptionTarget?: number; submissionTarget?: number } | null | undefined,
  field: TargetField,
): number | null {
  if (!central) return null;
  const value = central[field];
  return typeof value === "number" ? value : null;
}

function viewQuery(searchParams: URLSearchParams, vue: Vue, year: number, campagne: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("vue", vue);
  params.set("annee", String(year));
  if (campagne) params.set("campagne", campagne);
  else params.delete("campagne");
  return params.toString();
}
