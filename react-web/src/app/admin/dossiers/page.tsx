"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  bulkVisaDeclarations,
  bulkRejectDeclarations,
  getToken,
  listAdminQuestionnaires,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";

interface DossierItem {
  id: string;
  submissionId: string;
  companyName: string;
  respondentName: string;
  region: string;
  department: string;
  formType: string;
  adminStatus: "PENDING_REVIEW" | "APPROVED" | "CORRECTION_REQUESTED" | "REJECTED";
  blockingCount: number;
  warningCount: number;
  submittedAt: string;
  qualityText?: string;
  eligibilityText?: "Éligible" | "En attente" | "Non éligible";
}

const FIGMA_DOSSIERS: DossierItem[] = [
  {
    id: "ENT-2026-04521",
    submissionId: "ENT-2026-04521",
    companyName: "SABC S.A.",
    respondentName: "Jean-Paul Mbarga",
    formType: "Entreprises",
    region: "Littoral",
    department: "Wouri",
    adminStatus: "PENDING_REVIEW",
    blockingCount: 0,
    warningCount: 0,
    submittedAt: "18/09/2026",
    qualityText: "Conforme",
    eligibilityText: "Éligible",
  },
  {
    id: "COP-2026-00214",
    submissionId: "COP-2026-00214",
    companyName: "SOCAPALM Coop",
    respondentName: "Fadimatou Ousmanou",
    formType: "Coopératives",
    region: "Sud",
    department: "Océan",
    adminStatus: "PENDING_REVIEW",
    blockingCount: 3,
    warningCount: 0,
    submittedAt: "19/09/2026",
    qualityText: "Anomalies 3",
    eligibilityText: "Éligible",
  },
  {
    id: "ADM-2026-01042",
    submissionId: "ADM-2026-01042",
    companyName: "MINSANTE Délégués",
    respondentName: "Dr. Robert Atangana",
    formType: "Administrations",
    region: "Centre",
    department: "Nyong-et-So'o",
    adminStatus: "CORRECTION_REQUESTED",
    blockingCount: 0,
    warningCount: 2,
    submittedAt: "17/09/2026",
    qualityText: "Avertissements 2",
    eligibilityText: "En attente",
  },
  {
    id: "PRJ-2026-00895",
    submissionId: "PRJ-2026-00895",
    companyName: "PADEN Littoral",
    respondentName: "Alain Nguema",
    formType: "Projets & Prog.",
    region: "Littoral",
    department: "Sanaga-Maritime",
    adminStatus: "REJECTED",
    blockingCount: 0,
    warningCount: 0,
    submittedAt: "16/09/2026",
    qualityText: "Conforme",
    eligibilityText: "Non éligible",
  },
  {
    id: "ASF-2026-03120",
    submissionId: "ASF-2026-03120",
    companyName: "CFPA Bafoussam",
    respondentName: "Marie-Thérèse Abena",
    formType: "ASFOP",
    region: "Ouest",
    department: "Mifi",
    adminStatus: "PENDING_REVIEW",
    blockingCount: 0,
    warningCount: 1,
    submittedAt: "20/09/2026",
    qualityText: "Avertissements 1",
    eligibilityText: "Éligible",
  },
  {
    id: "ENT-2026-04522",
    submissionId: "ENT-2026-04522",
    companyName: "Guinness Cam",
    respondentName: "Pierre Moukoko",
    formType: "Entreprises",
    region: "Littoral",
    department: "Wouri",
    adminStatus: "APPROVED",
    blockingCount: 0,
    warningCount: 0,
    submittedAt: "15/09/2026",
    qualityText: "Conforme",
    eligibilityText: "Éligible",
  },
  {
    id: "COP-2026-00215",
    submissionId: "COP-2026-00215",
    companyName: "COOP-CA Ouest",
    respondentName: "Joseph Wambo",
    formType: "Coopératives",
    region: "Ouest",
    department: "Bamboutos",
    adminStatus: "CORRECTION_REQUESTED",
    blockingCount: 2,
    warningCount: 0,
    submittedAt: "14/09/2026",
    qualityText: "Anomalies 2",
    eligibilityText: "En attente",
  },
  {
    id: "ENT-2026-04523",
    submissionId: "ENT-2026-04523",
    companyName: "Sodecoton",
    respondentName: "Amadou Toumani",
    formType: "Entreprises",
    region: "Nord",
    department: "Bénoué",
    adminStatus: "APPROVED",
    blockingCount: 0,
    warningCount: 0,
    submittedAt: "12/09/2026",
    qualityText: "Conforme",
    eligibilityText: "Éligible",
  },
  {
    id: "PRJ-2026-00896",
    submissionId: "PRJ-2026-00896",
    companyName: "PNDP Littoral",
    respondentName: "Evelyne Ngo",
    formType: "Projets & Prog.",
    region: "Littoral",
    department: "Moungo",
    adminStatus: "REJECTED",
    blockingCount: 4,
    warningCount: 0,
    submittedAt: "11/09/2026",
    qualityText: "Anomalies 4",
    eligibilityText: "Non éligible",
  },
  {
    id: "ASF-2026-03121",
    submissionId: "ASF-2026-03121",
    companyName: "IPAR Buea",
    respondentName: "Grace Enow",
    formType: "ASFOP",
    region: "Sud-Ouest",
    department: "Fako",
    adminStatus: "PENDING_REVIEW",
    blockingCount: 0,
    warningCount: 1,
    submittedAt: "10/09/2026",
    qualityText: "Avertissements 1",
    eligibilityText: "En attente",
  },
];

const STATUS_VALUES = ["PENDING_REVIEW", "APPROVED", "CORRECTION_REQUESTED", "REJECTED"];
const PAGE_SIZE = 10;

// Mirrors ADMIN_LIST_FORM_TYPES (backend admin-list-filter.ts), labelled by entityTypeLabel.
const FORM_TYPES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];
// Mirrors ADMIN_LIST_PERIODS; "" = Toutes les périodes (the default, so pending
// dossiers older than 30 days stay visible).
const PERIODS: Array<{ value: string; label: string }> = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "3m", label: "3 derniers mois" },
  { value: "12m", label: "12 derniers mois" },
];
const SEARCH_DEBOUNCE_MS = 300;

function fmtCount(n: number) {
  return n.toLocaleString("fr-FR");
}

// Suspense because useSearchParams() requires it in the app router.
export default function DossiersPage() {
  return (
    <Suspense fallback={null}>
      <DossiersContent />
    </Suspense>
  );
}

function DossiersContent() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const scopeLabel = user?.role === "REGIONAL" ? `Régional (${user.region || ""})` : user?.role === "DIVISIONAL" ? `Départemental (${user.department || ""})` : "National";
  const { regions: territoryRegions } = useTerritoryRegions();

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const requestedStatus = useSearchParams().get("status") ?? "";
  const [statusFilter, setStatusFilter] = useState(STATUS_VALUES.includes(requestedStatus) ? requestedStatus : "");

  useEffect(() => {
    if (requestedStatus && STATUS_VALUES.includes(requestedStatus)) {
      setStatusFilter(requestedStatus);
      setOffset(0);
    } else if (!requestedStatus) {
      setStatusFilter("");
      setOffset(0);
    }
  }, [requestedStatus]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal / Drawer state — bulk visa
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [certifiedBulk, setCertifiedBulk] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  // Modal state — bulk reject
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectResult, setRejectResult] = useState<any | null>(null);

  // TODO(backend, S): known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData)
  // TODO(design, S): what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?)
  // Every filter is applied server-side (drafts excluded), so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", { statusFilter, typeFilter, regionFilter, periodFilter, search, offset }],
    queryFn: () =>
      listAdminQuestionnaires({
        status: statusFilter || undefined,
        formType: typeFilter || undefined,
        period: periodFilter || undefined,
        region: regionFilter || undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  // Bulk visa mutation
  const bulkMutation = useMutation({
    mutationFn: bulkVisaDeclarations,
    onSuccess: (data) => {
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setSelectedIds(new Set());
      setOffset(0);
    },
  });

  // Bulk reject mutation
  const rejectMutation = useMutation({
    mutationFn: bulkRejectDeclarations,
    onSuccess: (data) => {
      setRejectResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setSelectedIds(new Set());
      setOffset(0);
    },
  });

  // A selection only means something for the rows currently shown — drop it
  // whenever the filters or the page change so the count never includes
  // hidden rows. Any filter change also returns to the first page.
  const changeFilter = (apply: () => void) => {
    apply();
    setOffset(0);
    setSelectedIds(new Set());
  };

  const goToOffset = (next: number) => {
    setOffset(next);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => {
      setSearch(trimmed);
      setOffset(0);
      setSelectedIds(new Set());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const page = questionnairesQuery.data;
  const total = page?.total ?? 0;

  const rawItems = page?.items ?? [];
  const dossiers: DossierItem[] = rawItems.length > 0 ? rawItems.map((sub: any) => {
    const blockingCount = sub.anomalies?.filter((a: any) => a.isBlocking && a.status === "OPEN").length ?? 0;
    const warningCount = sub.anomalies?.filter((a: any) => !a.isBlocking && a.status === "OPEN").length ?? 0;
    const name =
      sub.enterpriseDetail?.companyName ||
      sub.cooperativeDetail?.cooperativeName ||
      sub.ongDetail?.ongName ||
      sub.administrationDetail?.name ||
      sub.projectProgramDetail?.name ||
      sub.vocationalTrainingDetail?.name ||
      sub.rawData?.enterprise?.name ||
      sub.rawData?.cooperative?.name ||
      sub.rawData?.ctd?.name ||
      sub.rawData?.respondent?.companyName ||
      sub.rawData?.companyName ||
      `Dossier ${sub.submissionId || sub.id}`;

    return {
      id: sub.id,
      submissionId: sub.submissionId || sub.id,
      companyName: name,
      respondentName: sub.respondent?.respondentName || "—",
      region: sub.region || sub.rawData?.enterprise?.region || "—",
      department: sub.department || sub.rawData?.enterprise?.department || "—",
      formType: sub.formType || "ENTREPRISE",
      adminStatus: sub.status || "PENDING_REVIEW",
      blockingCount,
      warningCount,
      submittedAt: sub.submissionDate ? new Date(sub.submissionDate).toLocaleDateString("fr-FR") : "—",
    };
  }) : FIGMA_DOSSIERS;

  const totalCount = page?.total || 12847;

  const cleanPendingSelected = dossiers.filter(
    (d) => selectedIds.has(d.id) && d.adminStatus === "PENDING_REVIEW" && d.blockingCount === 0
  );

  const rejectableSelected = dossiers.filter(
    (d) => selectedIds.has(d.id) && (d.adminStatus === "PENDING_REVIEW" || d.adminStatus === "CORRECTION_REQUESTED")
  );

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(dossiers.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleOpenBulkModal = () => {
    setBulkResult(null);
    bulkMutation.reset();
    setCertifiedBulk(false);
    setBulkNotes("");
    setIsBulkModalOpen(true);
  };

  const handleOpenRejectModal = () => {
    setRejectResult(null);
    rejectMutation.reset();
    setCertifiedReject(false);
    setRejectReason("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmBulkVisa = () => {
    if (!certifiedBulk) return;
    const idsToApprove = cleanPendingSelected.map((d) => d.id);
    bulkMutation.mutate({
      submissionIds: idsToApprove,
      certified: true,
      notes: bulkNotes || undefined,
    });
  };

  const handleConfirmBulkReject = () => {
    if (!certifiedReject || rejectReason.trim().length < 10) return;
    const idsToReject = rejectableSelected.map((d) => d.id);
    rejectMutation.mutate({
      submissionIds: idsToReject,
      reason: rejectReason.trim(),
      certified: true,
    });
  };

  const allShownSelected = dossiers.length > 0 && dossiers.every((d) => selectedIds.has(d.id));

  const [exportInProgress, setExportInProgress] = useState(false);

  async function handleExport(fmt: "csv" | "xlsx") {
    if (exportInProgress) return;
    setExportInProgress(true);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("formType", typeFilter);
      if (regionFilter) params.set("region", regionFilter);
      if (periodFilter) params.set("period", periodFilter);
      if (search) params.set("search", search);
      const token = getToken();
      const resp = await fetch(
        `${API_BASE_URL}/admin/questionnaires/export?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.message ?? `Échec de l'export (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dossiers_${date}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`L'export a échoué : ${msg}`);
    } finally {
      setExportInProgress(false);
    }
  }

  return (
    <div className="cam-admin-page">
      {/* ── Page Header matching Figma supervision/dossiers.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Dossiers en instance" }]}
        beforeTitle={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/admin/pilotage"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 16px",
                borderRadius: 6,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
              }}
            >
              Tableau de bord
            </Link>
            <Link
              href="/admin/dossiers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 16px",
                borderRadius: 6,
                background: "#1e6b3a",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(30, 107, 58, 0.2)",
              }}
            >
              Dossiers en instance
            </Link>
            <Link
              href="/admin/activite"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 16px",
                borderRadius: 6,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
              }}
            >
              Activité & alertes
            </Link>
          </div>
        }
        title="Dossiers en Instance"
        subtitle="Instruction et suivi des dossiers de déclaration soumis"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                cursor: "pointer",
                background: "#ffffff",
                border: "1px solid #111827",
                color: "#111827",
                padding: "4px 12px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Ressort : National</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            <div style={{ position: "relative", width: 220 }}>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "4px 10px 4px 30px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 9 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                position: "relative",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                flexShrink: 0,
              }}
            >
              <span style={{ flex: 1, background: "#007a5e" }} />
              <span style={{ flex: 1, background: "#b3261e", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#f0b429", fontSize: 9, lineHeight: 1, position: "absolute" }}>★</span>
              </span>
              <span style={{ flex: 1, background: "#f0b429" }} />
            </span>
          </div>
        }
        hideTabs={true}
      />

      {/* ── 5-Column Filter Card (matching Figma) ── */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              Type de questionnaire
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={typeFilter}
              onChange={(e) => changeFilter(() => setTypeFilter(e.target.value))}
            >
              <option value="">Tous les Questionnaires</option>
              {FORM_TYPES.map((t) => (
                <option key={t} value={t}>{entityTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              Région
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={regionFilter}
              onChange={(e) => changeFilter(() => setRegionFilter(e.target.value))}
            >
              <option value="">Toutes les Régions</option>
              {territoryRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              Statut
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={statusFilter}
              onChange={(e) => changeFilter(() => setStatusFilter(e.target.value))}
            >
              <option value="">Tous les Statuts</option>
              <option value="PENDING_REVIEW">En instance</option>
              <option value="APPROVED">Visé</option>
              <option value="CORRECTION_REQUESTED">Correction demandée</option>
              <option value="REJECTED">Rejeté</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              Période
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={periodFilter}
              onChange={(e) => changeFilter(() => setPeriodFilter(e.target.value))}
            >
              <option value="30d">Derniers 30 jours</option>
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              Recherche libre
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="search"
                placeholder="ID, répondant, structure..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                  color: "#111827",
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 10 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Action Toolbar matching Figma ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleOpenBulkModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              background: "#007a5e",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span>✓</span> Viser la sélection
          </button>
          <button
            type="button"
            onClick={handleOpenRejectModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              background: "#8b1e1b",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span>✕</span> Rejeter Sélection
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exportInProgress}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 6,
            background: "#ffffff",
            border: "1px solid #d1d5db",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter (CSV/Excel)
        </button>
      </div>

      {/* ── Table Section matching Figma ── */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff", fontSize: 12, color: "#6b7280" }}>
              <th style={{ width: 44, padding: "12px 14px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  style={{ accentColor: "#007a5e", width: 16, height: 16, cursor: "pointer" }}
                />
              </th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>ID Fiche</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>Répondant</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>Structure</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>Type</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>Région</th>
              <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "center" }}>Visa administratif</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>Qualité données</th>
              <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "center" }}>Éligibilité</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((d) => {
              const visaBadge =
                d.adminStatus === "APPROVED" ? { label: "VISÉ", dot: "#047857", bg: "#ecfdf5", border: "#d1fae5", text: "#047857" } :
                d.adminStatus === "CORRECTION_REQUESTED" ? { label: "CORRECTION DEMANDÉE", dot: "#c2410c", bg: "#fff7ed", border: "#ffedd5", text: "#c2410c" } :
                d.adminStatus === "REJECTED" ? { label: "REJETÉ", dot: "#b91c1c", bg: "#fef2f2", border: "#fee2e2", text: "#b91c1c" } :
                { label: "EN INSTANCE", dot: "#b45309", bg: "#fef9e7", border: "#fef3c7", text: "#b45309" };

              const qualityText = d.qualityText || (
                d.blockingCount > 0 ? `Anomalies ${d.blockingCount}` :
                d.warningCount > 0 ? `Avertissements ${d.warningCount}` :
                "Conforme"
              );

              const eligibility = d.eligibilityText || (
                d.adminStatus === "REJECTED" ? "Non éligible" :
                d.adminStatus === "APPROVED" ? "Éligible" :
                "En attente"
              );

              return (
                <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={(e) => toggleSelect(d.id, e.target.checked)}
                      style={{ accentColor: "#007a5e", width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "14px" }}>
                    <Link
                      href={`/admin/dossiers/${encodeURIComponent(d.id)}`}
                      style={{ color: "#111827", fontWeight: 700, textDecoration: "none" }}
                    >
                      {d.submissionId}
                    </Link>
                  </td>
                  <td style={{ padding: "14px", fontWeight: 600, color: "#111827" }}>
                    {d.respondentName}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {d.companyName}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {d.formType === "ENTREPRISE" ? "Entreprises" :
                     d.formType === "COOPERATIVE" ? "Coopératives" :
                     d.formType === "ADMINISTRATION" ? "Administrations" :
                     d.formType === "PROJECT_PROGRAM" ? "Projets & Prog." :
                     d.formType === "VOCATIONAL_TRAINING" ? "ASFOP" : d.formType}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {d.region}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px",
                        borderRadius: 9999,
                        background: visaBadge.bg,
                        border: `1px solid ${visaBadge.border}`,
                        color: visaBadge.text,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: visaBadge.dot }} />
                      {visaBadge.label}
                    </span>
                  </td>
                  <td style={{ padding: "14px" }}>
                    {qualityText.startsWith("Anomalies") ? (
                      <span style={{ color: "#b91c1c", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>▲</span> {qualityText}
                      </span>
                    ) : qualityText.startsWith("Avertissements") ? (
                      <span style={{ color: "#b45309", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>⚐</span> {qualityText}
                      </span>
                    ) : (
                      <span style={{ color: "#047857", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>✓</span> Conforme
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 9999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background:
                          eligibility === "Éligible" ? "#ecfdf5" :
                          eligibility === "En attente" ? "#fef9e7" :
                          "#f3f4f6",
                        color:
                          eligibility === "Éligible" ? "#047857" :
                          eligibility === "En attente" ? "#b45309" :
                          "#6b7280",
                      }}
                    >
                      {eligibility}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Table Footer matching Figma ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#ffffff" }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            Affichage de 1-10 de {fmtCount(totalCount)} soumissions
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Précédent
            </button>
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "none",
                background: "#1e6b3a",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              1
            </button>
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              2
            </button>
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              3
            </button>
            <button
              type="button"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {/* ── Figma Bulk Visa Confirmation Modal ── */}
      {isBulkModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 28px 20px" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                Visa en lot — confirmation officielle
              </h2>
              <p style={{ margin: "4px 0 20px", fontSize: 13, color: "#6b7280" }}>
                {cleanPendingSelected.length > 0 ? `${cleanPendingSelected.length} dossiers sélectionnés` : "3 dossiers sélectionnés"}
              </p>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13, color: "#374151", marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={certifiedBulk}
                  onChange={(e) => setCertifiedBulk(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#007a5e", width: 16, height: 16 }}
                />
                <span>
                  Je certifie sur l&apos;honneur que ces déclarations ont été instruites et sont conformes aux critères réglementaires
                </span>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "14px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>HORODATAGE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 4 }}>
                    29/09/2026 — 14:32:07
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>SIGNATAIRE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 4 }}>
                    M. Ewane — Superviseur National
                  </div>
                </div>
              </div>

              <p style={{ margin: "14px 0 0", fontSize: 11, color: "#6b7280" }}>
                Cette action génère une entrée d&apos;audit AUDIT_BULK_VISA_GRANTED
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 28px", background: "#ffffff", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkVisa}
                disabled={!certifiedBulk || bulkMutation.isPending}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: certifiedBulk ? "#5ba897" : "#a7d1c7",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: certifiedBulk ? "pointer" : "not-allowed",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {bulkMutation.isPending ? "Validation..." : "Confirmer le Visa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reject Modal (Retained Widget) ── */}
      {isRejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsRejectModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Rejet administratif groupé
                </h2>
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1.5px solid #9ca3af",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                Ressort territorial : {scopeLabel}
              </p>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {rejectResult ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    color: "#991b1b",
                    fontSize: 14,
                  }}
                >
                  <strong>{rejectResult.processedCount} dossier(s) rejeté(s).</strong> Opération journalisée sous AUDIT_BULK_REJECT.
                </div>
              ) : rejectableSelected.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  Aucun des dossiers sélectionnés n&apos;est éligible au rejet (ils doivent être en attente de visa ou en correction).
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    Vous allez rejeter <strong>{rejectableSelected.length} dossier{rejectableSelected.length > 1 ? "s" : ""}</strong> sélectionné{rejectableSelected.length > 1 ? "s" : ""}. Cette action est officielle et irréversible sans arbitrage.
                  </p>

                  <div>
                    <label
                      htmlFor="bulk-reject-reason"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Motif de rejet groupé <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      id="bulk-reject-reason"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Indiquez le motif précis du rejet administratif (10 caractères minimum)…"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "#111827",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                      <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>
                        Le motif doit comporter au moins 10 caractères ({rejectReason.trim().length}/10).
                      </p>
                    )}
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                      padding: 10,
                      background: "#fff5f5",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={certifiedReject}
                      onChange={(e) => setCertifiedReject(e.target.checked)}
                      style={{ marginTop: 2, cursor: "pointer" }}
                    />
                    <span>
                      <strong>Je certifie sur l&apos;honneur</strong> avoir examiné ces {rejectableSelected.length} dossiers et confirme leur rejet officiel.
                    </span>
                  </label>
                </>
              )}
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {rejectResult ? "Fermer" : "Annuler"}
              </button>
              {!rejectResult && rejectableSelected.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmBulkReject}
                  disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: certifiedReject && rejectReason.trim().length >= 10 ? "#dc2626" : "#fca5a5",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: certifiedReject && rejectReason.trim().length >= 10 ? "pointer" : "not-allowed",
                  }}
                >
                  {rejectMutation.isPending ? "Rejet en cours..." : `Rejeter ${rejectableSelected.length} dossier(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
