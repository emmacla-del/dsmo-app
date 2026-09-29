"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkVisaDeclarations,
  listAdminQuestionnaires,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminDialog } from "@/components/admin/AdminDialog";

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
}

const STATUS_VALUES = ["PENDING_REVIEW", "APPROVED", "CORRECTION_REQUESTED", "REJECTED"];
const PAGE_SIZE = 10;
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

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  // The queue page deep-links here with ?status=PENDING_REVIEW|CORRECTION_REQUESTED.
  const requestedStatus = useSearchParams().get("status") ?? "";
  const [statusFilter, setStatusFilter] = useState(STATUS_VALUES.includes(requestedStatus) ? requestedStatus : "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal / Drawer state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [certifiedBulk, setCertifiedBulk] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  // Status, region and search are all applied server-side, so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", { statusFilter, regionFilter, search, offset }],
    queryFn: () =>
      listAdminQuestionnaires({
        status: statusFilter || undefined,
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
      // Visas move dossiers out of status-filtered views, which can empty the
      // current page; restart from the first page.
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

  const dossiers: DossierItem[] = (page?.items ?? []).map((sub: any) => {
    const blockingCount = sub.anomalies?.filter((a: any) => a.isBlocking && a.status === "OPEN").length ?? 0;
    const warningCount = sub.anomalies?.filter((a: any) => !a.isBlocking && a.status === "OPEN").length ?? 0;
    // Column names differ per detail table (schema.prisma); OnefopCtdDetail
    // has no name column, so CTDs fall through to rawData.
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
  });

  const cleanPendingSelected = dossiers.filter(
    (d) => selectedIds.has(d.id) && d.adminStatus === "PENDING_REVIEW" && d.blockingCount === 0
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

  const handleConfirmBulkVisa = () => {
    if (!certifiedBulk) return;
    const idsToApprove = cleanPendingSelected.map((d) => d.id);
    bulkMutation.mutate({
      submissionIds: idsToApprove,
      certified: true,
      notes: bulkNotes || undefined,
    });
  };

  const allShownSelected = dossiers.length > 0 && dossiers.every((d) => selectedIds.has(d.id));
  const scopeLabel = user?.department
    ? `Département ${user.department}`
    : user?.region
      ? `Région ${user.region}`
      : "National (MINEFOP / ONEFOP)";

  // ROUND 2 (disabled until the backend supports them; see docs/figma/supervision/dossiers.png):
  // TODO(backend, S): ROUND 2 — questionnaire-type filter param for the "Type de questionnaire" field
  // TODO(backend, S): ROUND 2 — submission-date range params for the "Période" field
  // TODO(backend, M): ROUND 2 — bulk reject endpoint for "Rejeter Sélection"
  // TODO(backend, M): ROUND 2 — list/selection export endpoint for "Exporter (CSV/Excel)"
  const round2Hint = "Disponible prochainement";

  return (
    <div className="cam-admin-page">
      <section className="cam-admin-section" aria-label="Filtres">
        <div className="cam-admin-section-body" style={{ padding: "var(--cam-space-4) var(--cam-space-5)" }}>
          <div className="cam-admin-filters" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <div className="cam-field">
              <label className="cam-label" htmlFor="dossier-type">Type de questionnaire</label>
              <select id="dossier-type" className="cam-select" disabled title={round2Hint} value="">
                <option value="">Tous les questionnaires</option>
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="dossier-region">Région</label>
              <select id="dossier-region" className="cam-select" value={regionFilter} onChange={(e) => changeFilter(() => setRegionFilter(e.target.value))}>
                <option value="">Toutes les régions</option>
                {["Adamaoua", "Centre", "Est", "Extrême-Nord", "Littoral", "Nord", "Nord-Ouest", "Ouest", "Sud", "Sud-Ouest"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="dossier-status">Statut</label>
              <select id="dossier-status" className="cam-select" value={statusFilter} onChange={(e) => changeFilter(() => setStatusFilter(e.target.value))}>
                <option value="">Tous les statuts</option>
                <option value="PENDING_REVIEW">En instance</option>
                <option value="APPROVED">Visé</option>
                <option value="CORRECTION_REQUESTED">Correction demandée</option>
                <option value="REJECTED">Rejeté</option>
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="dossier-period">Période</label>
              {/* Shows no period rather than the Figma's "Derniers 30 jours": a disabled
                  control must not suggest a filter is applied. */}
              <select id="dossier-period" className="cam-select" disabled title={round2Hint} value="">
                <option value="">Toutes les périodes</option>
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="dossier-search">Recherche libre</label>
              <div className="cam-admin-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="dossier-search"
                  type="search"
                  className="cam-input"
                  placeholder="ID, répondant, structure…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--cam-space-2)" }}>
            <button
              type="button"
              className="cam-text-button"
              onClick={() => changeFilter(() => { setSearchInput(""); setSearch(""); setRegionFilter(""); setStatusFilter(""); })}
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      </section>

      <div className="cam-admin-page-toolbar">
        <div className="cam-admin-actions">
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            onClick={handleOpenBulkModal}
            disabled={cleanPendingSelected.length === 0}
            title={cleanPendingSelected.length === 0 ? "Sélectionnez des dossiers en instance sans anomalie bloquante" : undefined}
          >
            Viser la sélection
            <span className="cam-button-count">{cleanPendingSelected.length}</span>
          </button>
          <button type="button" className="cam-button cam-button-danger cam-button-sm" disabled title={round2Hint}>
            Rejeter la sélection
          </button>
        </div>
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled title={round2Hint}>
          Exporter (CSV/Excel)
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="cam-admin-selection" role="status">
          <span>
            <strong>{selectedIds.size}</strong> dossier{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
            {cleanPendingSelected.length < selectedIds.size && (
              <span className="cam-admin-muted">
                {" "}· {cleanPendingSelected.length} éligible{cleanPendingSelected.length > 1 ? "s" : ""} au visa groupé
              </span>
            )}
          </span>
          <div className="cam-admin-actions">
            <button type="button" className="cam-text-button" onClick={() => setSelectedIds(new Set())}>
              Désélectionner
            </button>
          </div>
        </div>
      )}

      <section className="cam-admin-section" aria-label="Registre des dossiers">
        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 44 }} className="text-center">
                  <input
                    type="checkbox"
                    className="cam-admin-table-check"
                    checked={allShownSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Sélectionner tous les dossiers affichés"
                  />
                </th>
                <th scope="col">ID Fiche</th>
                <th scope="col">Répondant</th>
                <th scope="col">Structure</th>
                <th scope="col">Type</th>
                <th scope="col">Région</th>
                <th scope="col">Visa administratif</th>
                <th scope="col">Qualité données</th>
                <th scope="col">Éligibilité</th>
                <th scope="col">Reçu le</th>
              </tr>
            </thead>
            <tbody>
              {questionnairesQuery.isLoading ? (
                <tr>
                  <td colSpan={10} className="cam-admin-empty">Chargement des dossiers…</td>
                </tr>
              ) : questionnairesQuery.isError ? (
                <tr>
                  <td colSpan={10} className="cam-admin-empty" role="alert">
                    <strong>Les dossiers n&apos;ont pas pu être chargés</strong>
                    {(questionnairesQuery.error as Error)?.message}
                  </td>
                </tr>
              ) : dossiers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="cam-admin-empty">
                    <strong>Aucun dossier</strong>
                    Aucun dossier ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                dossiers.map((d) => {
                  const isStatReady = d.adminStatus === "APPROVED" && d.blockingCount === 0;
                  return (
                    <tr key={d.id}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="cam-admin-table-check"
                          checked={selectedIds.has(d.id)}
                          onChange={(e) => toggleSelect(d.id, e.target.checked)}
                          aria-label={`Sélectionner ${d.companyName}`}
                        />
                      </td>
                      <td>
                        <Link
                          href={`/admin/dossiers/${encodeURIComponent(d.id)}?ref=${encodeURIComponent(d.submissionId)}&name=${encodeURIComponent(d.companyName)}&region=${encodeURIComponent(d.region)}&date=${encodeURIComponent(d.submittedAt)}`}
                          className="cam-admin-code"
                          style={{ color: "var(--cam-green)", fontWeight: 700 }}
                          aria-label={`Examiner le dossier ${d.submissionId} — ${d.companyName}`}
                        >
                          {d.submissionId}
                        </Link>
                      </td>
                      <td className="cam-admin-strong">{d.respondentName}</td>
                      <td>{d.companyName}</td>
                      <td>{entityTypeLabel(d.formType)}</td>
                      <td>
                        <div>{d.region}</div>
                        <div className="cam-admin-meta">{d.department}</div>
                      </td>
                      <td>
                        {d.adminStatus === "APPROVED" ? (
                          <span className="cam-badge cam-badge-success">Visé</span>
                        ) : d.adminStatus === "PENDING_REVIEW" ? (
                          <span className="cam-badge cam-badge-info">En instance</span>
                        ) : d.adminStatus === "REJECTED" ? (
                          <span className="cam-badge cam-badge-error">Rejeté</span>
                        ) : (
                          <span className="cam-badge cam-badge-warning">Correction demandée</span>
                        )}
                      </td>
                      <td>
                        {d.blockingCount > 0 ? (
                          <span className="cam-badge cam-badge-error">
                            Anomalies {d.blockingCount}
                          </span>
                        ) : d.warningCount > 0 ? (
                          <span className="cam-badge cam-badge-warning">
                            Avertissements {d.warningCount}
                          </span>
                        ) : (
                          <span className="cam-badge cam-badge-success">Conforme</span>
                        )}
                      </td>
                      <td>
                        {isStatReady ? (
                          <span className="cam-badge cam-badge-success">Diffusable</span>
                        ) : (
                          <span className="cam-badge cam-badge-neutral">Exclu</span>
                        )}
                      </td>
                      <td className="cam-admin-muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {d.submittedAt}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* total is the server's count of the filtered query, not this page. */}
        <div className="cam-pagination" style={{ justifyContent: "space-between", padding: "0 var(--cam-space-4) var(--cam-space-4)" }}>
          <span className="cam-pagination-info" aria-live="polite">
            {total === 0
              ? "Aucune soumission"
              : `Affichage de ${fmtCount(offset + 1)}–${fmtCount(offset + dossiers.length)} sur ${fmtCount(total)} soumission${total > 1 ? "s" : ""}`}
          </span>
          <div style={{ display: "flex", gap: "var(--cam-space-2)" }}>
            <button
              className="cam-pagination-btn"
              type="button"
              disabled={offset === 0 || questionnairesQuery.isFetching}
              onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Précédent
            </button>
            <button
              className="cam-pagination-btn"
              type="button"
              disabled={offset + PAGE_SIZE >= total || questionnairesQuery.isFetching}
              onClick={() => goToOffset(offset + PAGE_SIZE)}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {/* Bulk national visa — certified, audited */}
      <AdminDialog
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        eyebrow="Engagement ministériel officiel"
        title="Visa administratif groupé"
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsBulkModalOpen(false)}>
              {bulkResult ? "Fermer" : "Annuler"}
            </button>
            {!bulkResult && (
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                onClick={handleConfirmBulkVisa}
                disabled={!certifiedBulk || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? "Transaction en cours…" : `Confirmer ${cleanPendingSelected.length} visa${cleanPendingSelected.length > 1 ? "s" : ""}`}
              </button>
            )}
          </>
        }
      >
        {bulkMutation.isError && (
          <div role="alert" className="cam-admin-notice cam-admin-notice--error">
            <span>
              Le visa groupé n&apos;a pas pu être accordé : {(bulkMutation.error as Error)?.message || "erreur serveur."} Rechargez la liste pour vérifier l&apos;état des dossiers avant de réessayer.
            </span>
          </div>
        )}
        {bulkResult ? (
          <>
            <div className="cam-admin-notice cam-admin-notice--success" role="status">
              <span>
                <strong>{bulkResult.processedCount} dossier{bulkResult.processedCount > 1 ? "s" : ""} visé{bulkResult.processedCount > 1 ? "s" : ""}.</strong>{" "}
                Opération journalisée sous l&apos;empreinte <span className="cam-admin-code">AUDIT_BULK_VISA_GRANTED</span>.
              </span>
            </div>
            {bulkResult.rejectedCount > 0 && (
              <div>
                <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-2)" }}>
                  {bulkResult.rejectedCount} dossier{bulkResult.rejectedCount > 1 ? "s" : ""} non visé{bulkResult.rejectedCount > 1 ? "s" : ""} par le serveur
                </h3>
                <ul className="cam-admin-issues is-warn">
                  {(bulkResult.rejectedItems ?? []).map((item: { id: string; reason: string }) => (
                    <li key={item.id}>
                      <strong>{dossiers.find((d) => d.id === item.id)?.companyName ?? item.id}</strong> — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Vous allez accorder le visa administratif à <strong>{cleanPendingSelected.length} dossier{cleanPendingSelected.length > 1 ? "s" : ""}</strong> en
              instance, sans anomalie bloquante ouverte.
            </p>
            <dl className="cam-admin-kv" style={{ padding: "var(--cam-space-4)", background: "var(--cam-bg)", borderRadius: "var(--cam-radius-md)" }}>
              <div>
                <dt>Agent signataire</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Ressort</dt>
                <dd>{scopeLabel}</dd>
              </div>
              <div>
                <dt>Horodatage</dt>
                <dd>{new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</dd>
              </div>
            </dl>
            <p className="cam-admin-meta" style={{ margin: 0 }}>
              Le serveur vérifie à nouveau chaque dossier (statut, anomalies, ressort) dans une transaction unique et
              signale ceux qu&apos;il ne peut pas viser.
            </p>
            <div className="cam-field" style={{ margin: 0 }}>
              <label className="cam-admin-label" htmlFor="bulk-notes">
                Notes d&apos;instruction <span className="cam-admin-muted">(facultatif)</span>
              </label>
              <textarea id="bulk-notes" className="cam-admin-textarea" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} rows={2} />
            </div>
            <label className="cam-admin-choice" style={{ padding: "var(--cam-space-3)", border: "var(--cam-border-width) solid var(--cam-warning-border)", background: "var(--cam-warning-bg)", borderRadius: "var(--cam-radius-sm)" }}>
              <input type="checkbox" checked={certifiedBulk} onChange={(e) => setCertifiedBulk(e.target.checked)} />
              <span>
                <strong>Je certifie sur l&apos;honneur</strong> que ces {cleanPendingSelected.length} structures ont satisfait à leurs
                obligations déclaratives et qu&apos;aucun blocage arithmétique ne subsiste.
              </span>
            </label>
          </>
        )}
      </AdminDialog>
    </div>
  );
}
