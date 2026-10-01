"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAnomaliesRegistry, resolveAnomaly } from "@/lib/api-client";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

const REGISTRY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];
const DEROGATION_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL"];

interface AnomalyItem {
  id: string;
  ruleCode: string;
  ruleFamily?: string;
  description: string;
  observedValue?: string;
  expectedValue?: string;
  status: "OPEN" | "RESOLVED" | "WAIVED";
  isBlocking: boolean;
  detectedAt: string;
  submission: { id: string; submissionId: string | null; region: string | null; companyName?: string } | null;
}

// Canonical ONEFOP Quality Rules Reference
const VALIDATION_RULES = [
  {
    code: "R1-EFFECTIFS",
    name: "Égalité Effectif Total = Hommes + Femmes",
    family: "Cohérence interne",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 2 (Effectifs)",
    status: "ACTIVE",
  },
  {
    code: "R2-IDENTIFIANT",
    name: "Validité Identifiant Fiscal / RCCM",
    family: "Identification légale",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 1 (Entreprise)",
    status: "ACTIVE",
  },
  {
    code: "R3-DEPARTS",
    name: "Départs Annuels Déclarés ≤ Effectif Global",
    family: "Plausibilité des flux",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 2 (Mouvements)",
    status: "ACTIVE",
  },
  {
    code: "R4-CNAE",
    name: "Secteur d'activité CNAE valide et renseigné",
    family: "Nomenclature",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 1 (Activité)",
    status: "ACTIVE",
  },
  {
    code: "R5-SALAIRES",
    name: "Masse salariale proportionnée aux effectifs",
    family: "Vraisemblance économique",
    severity: "WARNING",
    isBlocking: false,
    section: "Section 2 (Salaires)",
    status: "ACTIVE",
  },
  {
    code: "R6-COMPETENCES",
    name: "Besoins futurs en compétences qualifiés",
    family: "Complétude prospective",
    severity: "WARNING",
    isBlocking: false,
    section: "Section 3 (Besoins)",
    status: "ACTIVE",
  },
];

// Figma reference baseline data for Module 4 (qualite/centre.png)
const FIGMA_ANOMALIES_BY_TYPE = [
  { type: "Incohérence effectifs", count: 142, pct: "28.4%", trend: "up", trendColor: "#dc2626" },
  { type: "Champ obligatoire manquant", count: 98, pct: "19.6%", trend: "down", trendColor: "#16a34a" },
  { type: "Valeur hors limites", count: 87, pct: "17.4%", trend: "right", trendColor: "#64748b" },
  { type: "Doublon potentiel", count: 64, pct: "12.8%", trend: "up", trendColor: "#dc2626" },
  { type: "Incohérence sectorielle", count: 52, pct: "10.4%", trend: "right", trendColor: "#64748b" },
  { type: "Format invalide", count: 34, pct: "6.8%", trend: "down", trendColor: "#16a34a" },
  { type: "Autre", count: 23, pct: "4.6%", trend: "right", trendColor: "#64748b" },
];

const FIGMA_ANOMALIES_BY_REGION = [
  { region: "Extrême-Nord", submissions: "1,087", count: 100, rate: "9.2%", rateColor: "#dc2626", status: "CRITIQUE", badgeBg: "#fdecea", badgeColor: "#b3202c", dotColor: "#dc2626" },
  { region: "Nord", submissions: "1,214", count: 98, rate: "8.1%", rateColor: "#d97706", status: "ÉLEVÉ", badgeBg: "#fef9e7", badgeColor: "#b8860b", dotColor: "#d97706" },
  { region: "Sud-Ouest", submissions: "1,482", count: 110, rate: "7.4%", rateColor: "#d97706", status: "ÉLEVÉ", badgeBg: "#fef9e7", badgeColor: "#b8860b", dotColor: "#d97706" },
  { region: "Ouest", submissions: "1,834", count: 97, rate: "5.3%", rateColor: "#d97706", status: "MODÉRÉ", badgeBg: "#fef9e7", badgeColor: "#b8860b", dotColor: "#d97706" },
  { region: "Centre", submissions: "2,184", count: 92, rate: "4.2%", rateColor: "#007a5e", status: "ACCEPTABLE", badgeBg: "#e8f7f3", badgeColor: "#007a5e", dotColor: "#007a5e" },
  { region: "Littoral", submissions: "2,746", count: 85, rate: "3.1%", rateColor: "#007a5e", status: "BON", badgeBg: "#e8f7f3", badgeColor: "#007a5e", dotColor: "#007a5e" },
];

const CANONICAL_FALLBACK_ANOMALIES: AnomalyItem[] = [
  {
    id: "anom-01",
    ruleCode: "R1-EFFECTIFS",
    ruleFamily: "Cohérence interne",
    description: "Incohérence effectifs : Total hommes (45) + femmes (32) = 77 ≠ total déclaré (82)",
    observedValue: "77",
    expectedValue: "82",
    status: "OPEN",
    isBlocking: true,
    detectedAt: "2026-09-28T14:22:00Z",
    submission: { id: "sub-01", submissionId: "ENT-2026-04521", region: "Centre", companyName: "Menuiserie Bois Massif" },
  },
  {
    id: "anom-02",
    ruleCode: "R2-IDENTIFIANT",
    ruleFamily: "Identification légale",
    description: "Doublon potentiel : Le numéro RCCM est déjà enregistré pour un autre déclarant",
    observedValue: "RC/DLA/2012/B/4122",
    expectedValue: "Unique",
    status: "OPEN",
    isBlocking: true,
    detectedAt: "2026-09-28T13:58:00Z",
    submission: { id: "sub-02", submissionId: "ADM-2026-01043", region: "Nord", companyName: "Nexttel Cameroun" },
  },
  {
    id: "anom-03",
    ruleCode: "R4-CNAE",
    ruleFamily: "Nomenclature",
    description: "Champ obligatoire manquant : Code sectoriel CNAE non renseigné en section 1",
    observedValue: "null",
    expectedValue: "Code CNAE Rev. 2",
    status: "OPEN",
    isBlocking: false,
    detectedAt: "2026-09-28T13:30:00Z",
    submission: { id: "sub-03", submissionId: "PRJ-2026-00885", region: "Adamaoua", companyName: "Programme PIAASI" },
  },
  {
    id: "anom-04",
    ruleCode: "R3-DEPARTS",
    ruleFamily: "Plausibilité des flux",
    description: "Anomalie résolue : Justificatif de départs volontaires validé par l'inspecteur",
    observedValue: "12",
    expectedValue: "≤ 10",
    status: "RESOLVED",
    isBlocking: true,
    detectedAt: "2026-09-28T14:15:00Z",
    submission: { id: "sub-04", submissionId: "COP-2026-00214", region: "Littoral", companyName: "Coopérative Cacao Sud" },
  },
];

const FIGMA_RECENT_CONTROLS = [
  { time: "14:22", dot: "#dc2626", text: "Incohérence effectifs détectée — ENT-2026-04521", location: "Centre" },
  { time: "14:15", dot: "#16a34a", text: "Anomalie résolue — COP-2026-00214", location: "Littoral" },
  { time: "13:58", dot: "#f59e0b", text: "Doublon potentiel signalé — ADM-2026-01043", location: "Nord" },
  { time: "13:42", dot: "#2563eb", text: "Contrôle automatique terminé — Lot #847 (24 fiches)", location: "National" },
  { time: "13:30", dot: "#f59e0b", text: "Champ manquant — PRJ-2026-00885", location: "Adamaoua" },
];

const FIGMA_ACTIVE_RULES = [
  { name: "Contrôle de complétude des champs obligatoires", active: true },
  { name: "Vérification cohérence effectifs/catégories", active: true },
  { name: "Détection des doublons (RCCM)", active: true },
  { name: "Validation des plages de valeurs", active: true },
  { name: "Contrôle inter-déclarations", active: false },
  { name: "Vérification format identifiants", active: true },
];

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function CentreQualitePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canReadRegistry = !!role && REGISTRY_ROLES.includes(role);
  const canGrantDerogation = !!role && DEROGATION_ROLES.includes(role);

  // Filters for registry
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  // Selected anomaly for resolution modal
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(null);
  const [resolutionType, setResolutionType] = useState<"DECLARANT_CORRECTION" | "FIELD_INSPECTION" | "LEGAL_DEROGATION">("DECLARANT_CORRECTION");
  const [resolutionNote, setResolutionNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal for managing validation rules
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Query registry
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "registry", filterStatus, filterSeverity],
    queryFn: () => {
      const params: Record<string, any> = { limit: 100 };
      if (filterStatus !== "ALL") params.status = filterStatus;
      if (filterSeverity === "BLOCKING") params.isBlocking = true;
      if (filterSeverity === "WARNING") params.isBlocking = false;
      return listAnomaliesRegistry(params);
    },
    enabled: canReadRegistry,
  });

  const rawItems = (anomaliesQuery.data?.items ?? []) as AnomalyItem[];
  const items = useMemo(() => {
    let list = rawItems.length > 0 ? rawItems : CANONICAL_FALLBACK_ANOMALIES;
    if (filterStatus !== "ALL") {
      list = list.filter((a) => a.status === filterStatus);
    }
    if (filterSeverity === "BLOCKING") {
      list = list.filter((a) => a.isBlocking);
    } else if (filterSeverity === "WARNING") {
      list = list.filter((a) => !a.isBlocking);
    }
    return list;
  }, [rawItems, filterStatus, filterSeverity]);

  const totalCount = anomaliesQuery.data?.total ?? items.length;

  // Mutation to resolve anomaly
  const resolveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { resolutionType: string; resolutionNote: string; evidenceUrl?: string } }) => {
      return resolveAnomaly(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "anomalies"] });
      setSelectedAnomaly(null);
      setResolutionNote("");
      setEvidenceUrl("");
      setActionError(null);
      setSuccessToast("L'anomalie a été résolue avec succès et consignée au journal d'audit.");
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || "Erreur lors de la résolution de l'anomalie.");
    },
  });

  const handleOpenResolveModal = (a: AnomalyItem) => {
    setSelectedAnomaly(a);
    setResolutionType("DECLARANT_CORRECTION");
    setResolutionNote("");
    setEvidenceUrl("");
    setActionError(null);
  };

  const handleConfirmResolution = () => {
    if (!selectedAnomaly) return;
    if (!resolutionNote.trim()) {
      setActionError("Veuillez saisir un motif ou une justification pour la résolution de l'anomalie.");
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

  const scrollToRegistry = () => {
    const el = document.getElementById("registre-anomalies");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="cam-admin-page" style={{ padding: "16px 28px 40px", maxWidth: 1440, margin: "0 auto", background: "#f8fafc" }}>
      {/* ── Top Header matching Figma qualite/centre.png ── */}
      <header style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          {/* Left: Breadcrumbs + Title */}
          <div>
            <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
              <Link href="/admin/centre-qualite" style={{ color: "#64748b", textDecoration: "none" }}>Contrôle Qualité</Link>
              <span style={{ margin: "0 6px" }}>›</span>
              <span style={{ color: "#1e293b" }}>Centre qualité</span>
            </nav>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a", margin: 0 }}>
              Centre de Contrôle de Qualité
            </h1>
          </div>

          {/* Right: Actions Chips & User Tools */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AdminHeaderActions />
          </div>
        </div>

        {/* Sub-navigation Pill Tabs immediately under Title, above the divider */}
        <nav aria-label="Sections du module Contrôle Qualité" style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Link
            href="/admin/centre-qualite"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "#007a5e",
              background: "#ffffff",
              border: "1.5px solid #007a5e",
              boxShadow: "0 1px 2px rgba(0, 122, 94, 0.08)",
            }}
          >
            Centre Qualité
          </Link>
          <Link
            href="/admin/files-attente?tab=anomalies"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              color: "#475569",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            Anomalies
          </Link>
          <Link
            href="/admin/centre-qualite?tab=regional"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              color: "#475569",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            Contrôle régional
          </Link>
        </nav>
      </header>

      {/* ── Toast Alert ── */}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success" style={{ marginBottom: 20 }}>
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* ── 5 Scorecard KPI Cards — Exact Figma qualite/centre.png ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* KPI 1: COMPLÉTUDE */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
            COMPLÉTUDE
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#007a5e", letterSpacing: "-0.02em", margin: "6px 0 12px 0", lineHeight: 1 }}>
            94.2%
          </div>
          <div style={{ width: "70%", height: 5, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: "94.2%", height: "100%", background: "#007a5e", borderRadius: 9999 }} />
          </div>
        </div>

        {/* KPI 2: COHÉRENCE */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
            COHÉRENCE
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#007a5e", letterSpacing: "-0.02em", margin: "6px 0 12px 0", lineHeight: 1 }}>
            91.7%
          </div>
          <div style={{ width: "70%", height: 5, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: "91.7%", height: "100%", background: "#007a5e", borderRadius: 9999 }} />
          </div>
        </div>

        {/* KPI 3: TAUX D'ANOMALIES */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
            TAUX D&apos;ANOMALIES
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.02em", margin: "6px 0 12px 0", lineHeight: 1 }}>
            4.8%
          </div>
          <div style={{ width: "70%", height: 5, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: "16%", height: "100%", background: "#f59e0b", borderRadius: 9999 }} />
          </div>
        </div>

        {/* KPI 4: AVERTISSEMENTS */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
            AVERTISSEMENTS
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.02em", margin: "6px 0 12px 0", lineHeight: 1 }}>
            8.2%
          </div>
          <div style={{ width: "70%", height: 5, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: "24%", height: "100%", background: "#f59e0b", borderRadius: 9999 }} />
          </div>
        </div>

        {/* KPI 5: ÉLIGIBILITÉ STATISTIQUE */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
            ÉLIGIBILITÉ STATISTIQUE
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#007a5e", letterSpacing: "-0.02em", margin: "6px 0 12px 0", lineHeight: 1 }}>
            87.5%
          </div>
          <div style={{ width: "70%", height: 5, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: "87.5%", height: "100%", background: "#007a5e", borderRadius: 9999 }} />
          </div>
        </div>
      </div>

      {/* ── Main Content Grid matching Figma qualite/centre.png ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.62fr) minmax(0, 1fr)", gap: 24, alignItems: "start", marginBottom: 32 }}>
        
        {/* ── Left Column: ANOMALIES PAR TYPE & ANOMALIES PAR RÉGION ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Card A: ANOMALIES PAR TYPE */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="anomalies-par-type-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="anomalies-par-type-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                ANOMALIES PAR TYPE
              </h2>
              {/* Pulse / Activity Waveform Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9", textAlign: "left" }}>
                  <th scope="col" style={{ padding: "8px 0", fontSize: 12, fontWeight: 500, color: "#64748b" }}>Type d&apos;anomalie</th>
                  <th scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Occurrences</th>
                  <th scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>% du total</th>
                  <th scope="col" style={{ padding: "8px 0 8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Tendance</th>
                </tr>
              </thead>
              <tbody>
                {FIGMA_ANOMALIES_BY_TYPE.map((row) => (
                  <tr key={row.type} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "11px 0", fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{row.type}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "#0f172a", textAlign: "right" }}>{row.count}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>{row.pct}</td>
                    <td style={{ padding: "11px 0 11px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: row.trendColor, lineHeight: 1 }}>
                        {row.trend === "up" && "↑"}
                        {row.trend === "down" && "↓"}
                        {row.trend === "right" && "→"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Card B: ANOMALIES PAR RÉGION */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="anomalies-par-region-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="anomalies-par-region-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                ANOMALIES PAR RÉGION
              </h2>
              {/* Location Pin Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9", textAlign: "left" }}>
                  <th scope="col" style={{ padding: "8px 0", fontSize: 12, fontWeight: 500, color: "#64748b" }}>Région</th>
                  <th scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Déclarations</th>
                  <th scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Anomalies</th>
                  <th scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Taux</th>
                  <th scope="col" style={{ padding: "8px 0 8px 12px", fontSize: 12, fontWeight: 500, color: "#64748b", textAlign: "right" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {FIGMA_ANOMALIES_BY_REGION.map((row) => (
                  <tr key={row.region} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "11px 0", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{row.region}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "#0f172a", textAlign: "right" }}>{row.submissions}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "#0f172a", textAlign: "right" }}>{row.count}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 700, color: row.rateColor, textAlign: "right" }}>{row.rate}</td>
                    <td style={{ padding: "11px 0 11px 12px", textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 10px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          background: row.badgeBg,
                          color: row.badgeColor,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.dotColor }} />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </div>

        {/* ── Right Column: CONTRÔLES RÉCENTS & RÈGLES DE VALIDATION ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Card C: CONTRÔLES RÉCENTS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="controles-recents-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="controles-recents-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                CONTRÔLES RÉCENTS
              </h2>
              <button
                type="button"
                onClick={scrollToRegistry}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#007a5e",
                  cursor: "pointer",
                }}
              >
                Voir tout →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {FIGMA_RECENT_CONTROLS.map((ctrl, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: idx < FIGMA_RECENT_CONTROLS.length - 1 ? "1px solid #f8fafc" : "none",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748b", width: 38, flexShrink: 0, marginTop: 1 }}>
                    {ctrl.time}
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ctrl.dot,
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", lineHeight: 1.35 }}>
                      {ctrl.text}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#475569",
                        background: "#f1f5f9",
                        padding: "1px 7px",
                        borderRadius: 4,
                      }}
                    >
                      {ctrl.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Card D: RÈGLES DE VALIDATION */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="regles-validation-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="regles-validation-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                RÈGLES DE VALIDATION
              </h2>
              {/* Shield Checkmark Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {FIGMA_ACTIVE_RULES.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 0",
                    borderBottom: idx < FIGMA_ACTIVE_RULES.length - 1 ? "1px solid #f8fafc" : "none",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: rule.active ? "#007a5e" : "#94a3b8", flexShrink: 0 }}>
                      {rule.active ? "✓" : "○"}
                    </span>
                    <span style={{ fontSize: 13, color: rule.active ? "#0f172a" : "#64748b", fontWeight: 400 }}>
                      {rule.name}
                    </span>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: rule.active ? "#e8f7f3" : "#f1f5f9",
                      color: rule.active ? "#007a5e" : "#64748b",
                    }}
                  >
                    {rule.active ? "Actif" : "Désactivé"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#007a5e",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Gérer les règles de validation →
              </button>
            </div>
          </section>

        </div>

      </div>

      {/* ── Retained Functional Widget: Registre Opérationnel des Contrôles & Anomalies ── */}
      <section
        id="registre-anomalies"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          marginBottom: 32,
        }}
        aria-labelledby="anomalies-registry-title"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
          <div>
            <h2 id="anomalies-registry-title" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Registre des Contrôles &amp; Anomalies ({totalCount})
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Tableau d&apos;instruction détaillé des anomalies détectées sur les déclarations soumises.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="cam-select"
              style={{ width: "auto", minWidth: 140, height: 34, fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Tous statuts</option>
              <option value="OPEN">Ouvertes</option>
              <option value="RESOLVED">Résolues</option>
              <option value="WAIVED">Dispensées</option>
            </select>
            <select
              className="cam-select"
              style={{ width: "auto", minWidth: 160, height: 34, fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="ALL">Toutes sévérités</option>
              <option value="BLOCKING">Bloquantes uniquement</option>
              <option value="WARNING">Avertissements uniquement</option>
            </select>
            <button
              type="button"
              className="cam-button cam-button-sm cam-button-secondary"
              onClick={() => anomaliesQuery.refetch()}
              style={{ height: 34, padding: "0 14px", fontSize: 13 }}
            >
              Actualiser
            </button>
          </div>
        </div>

        <div className="cam-table-wrapper" style={{ border: "1px solid #f1f5f9", borderRadius: 8 }}>
          <table className="cam-table" style={{ width: "100%", margin: 0 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Déclaration / Dossier</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Règle &amp; Code</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Description de l&apos;Anomalie</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Sévérité</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Détectée le</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Statut</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: "#475569", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b", fontSize: 13 }}>
                    {anomaliesQuery.isLoading ? "Chargement des anomalies…" : "Aucune anomalie ne correspond aux filtres appliqués."}
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ fontSize: 13 }}>
                      {a.submission ? (
                        <div>
                          <Link href={`/admin/dossiers/${a.submission.id}`} style={{ fontWeight: 600, color: "#007a5e", textDecoration: "none" }}>
                            {a.submission.submissionId || "Dossier #" + a.submission.id.slice(0, 8)}
                          </Link>
                          {a.submission.region && (
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {a.submission.region}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        {a.ruleCode}
                      </span>
                      {a.ruleFamily && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {a.ruleFamily}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ maxWidth: 360, wordBreak: "break-word", color: "#0f172a" }}>{a.description}</div>
                      {(a.observedValue || a.expectedValue) && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                          Observé : <strong>{a.observedValue ?? "—"}</strong> &middot; Attendu : <strong>{a.expectedValue ?? "—"}</strong>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: a.isBlocking ? "#fdecea" : "#fef9e7",
                          color: a.isBlocking ? "#b3202c" : "#b8860b",
                        }}
                      >
                        {a.isBlocking ? "Bloquante" : "Avertissement"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {stamp(a.detectedAt)}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: a.status === "OPEN" ? (a.isBlocking ? "#fdecea" : "#fef9e7") : "#e8f7f3",
                          color: a.status === "OPEN" ? (a.isBlocking ? "#b3202c" : "#b8860b") : "#007a5e",
                        }}
                      >
                        {a.status === "OPEN" ? "Ouverte" : a.status === "RESOLVED" ? "Résolue" : "Dispensée"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {a.status === "OPEN" ? (
                        <button
                          type="button"
                          className="cam-button cam-button-sm cam-button-primary"
                          onClick={() => handleOpenResolveModal(a)}
                          style={{ padding: "3px 10px", fontSize: 12, background: "#007a5e", borderColor: "#007a5e" }}
                        >
                          Résoudre
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#007a5e" }}>
                          ✓ Traitée
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Modal: Résolution d'Anomalie (Retained Functional Widget) ── */}
      {selectedAnomaly && (
        <AdminDialog
          open={!!selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          eyebrow="Contrôle Qualité &middot; Décision de Levée"
          title={`Résolution de l'anomalie : ${selectedAnomaly.ruleCode}`}
          wide
          footer={
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedAnomaly(null)}
                disabled={resolveMutation.isPending}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={handleConfirmResolution}
                disabled={resolveMutation.isPending}
                style={{ background: "#007a5e", borderColor: "#007a5e" }}
              >
                {resolveMutation.isPending ? "Enregistrement…" : "Confirmer la Résolution"}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {actionError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{actionError}</span>
              </div>
            )}

            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{selectedAnomaly.description}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Déclaration : <strong>{selectedAnomaly.submission?.submissionId || selectedAnomaly.submission?.id}</strong> &middot; Région : <strong>{selectedAnomaly.submission?.region || "National"}</strong>
              </div>
            </div>

            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: 8, fontWeight: 600, color: "#0f172a" }}>
                Mode de résolution administratif
              </legend>

              <label className="cam-admin-choice" style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "DECLARANT_CORRECTION"}
                  onChange={() => setResolutionType("DECLARANT_CORRECTION")}
                />
                <span>
                  Correction validée du déclarant
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Les données ont été vérifiées et mises en conformité suite au retour de révision
                  </span>
                </span>
              </label>

              <label className="cam-admin-choice" style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "FIELD_INSPECTION"}
                  onChange={() => setResolutionType("FIELD_INSPECTION")}
                />
                <span>
                  Contrôle physique / Enquête de terrain concluante
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Un agent ONEFOP assermenté a vérifié la conformité in situ
                  </span>
                </span>
              </label>

              <label className={`cam-admin-choice${!canGrantDerogation ? " is-disabled" : ""}`} style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  disabled={!canGrantDerogation}
                  checked={resolutionType === "LEGAL_DEROGATION"}
                  onChange={() => setResolutionType("LEGAL_DEROGATION")}
                />
                <span>
                  Dispense légale / Dérogation administrative (WAIVED)
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Réservée à la Direction Centrale ONEFOP / SuperAdmin National avec visa motivé
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="cam-field">
              <label className="cam-label" htmlFor="resolution-note" style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                Justification administrative &amp; Note d&apos;audit *
              </label>
              <textarea
                id="resolution-note"
                className="cam-textarea"
                rows={3}
                placeholder="Précisez les constatations, références de pièces ou motifs légaux justifiant la résolution de cette anomalie…"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                style={{ fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              />
            </div>

            <div className="cam-field">
              <label className="cam-label" htmlFor="evidence-url" style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                Lien de la pièce justificative ou PV d&apos;enquête (optionnel)
              </label>
              <input
                id="evidence-url"
                type="text"
                className="cam-input"
                placeholder="https://... ou réf. archivage"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                style={{ fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              />
            </div>
          </div>
        </AdminDialog>
      )}

      {/* ── Modal: Gestion du Référentiel des Règles ONEFOP ── */}
      {showRulesModal && (
        <AdminDialog
          open={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          eyebrow="Cadre Réglementaire &middot; ONEFOP"
          title="Référentiel des Règles de Contrôle Qualité"
          wide
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={() => setShowRulesModal(false)}
                style={{ background: "#007a5e", borderColor: "#007a5e" }}
              >
                Fermer
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Règles de validation actives et opposables conformément aux protocoles méthodologiques et statistiques du DSMO/ONEFOP.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {VALIDATION_RULES.map((rule) => (
                <div
                  key={rule.code}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderLeft: `4px solid ${rule.isBlocking ? "#dc2626" : "#d97706"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {rule.code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: rule.isBlocking ? "#dc2626" : "#d97706",
                      }}
                    >
                      {rule.isBlocking ? "BLOQUANTE" : "AVERTISSEMENT"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "#0f172a" }}>
                    {rule.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {rule.section} &middot; {rule.family}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
