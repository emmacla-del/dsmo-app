"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, listUsers, rejectUser, type DirectoryUser } from "@/lib/user-directory";
import { formatDate } from "@/lib/companies-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { KpiTile } from "@/components/admin/KpiTile";

// UI shell for the "File d'attente des inscriptions" frame. Wiring gaps are
// listed in docs/admin-replacement/ui-wiring-todo.md.
//
// Establishment accounts are listed by GET /auth/users?role=COMPANY, which
// only SUPER_ADMIN can read for COMPANY accounts (SUPER_ADMIN_ONEFOP is
// limited to ONEFOP staff by src/auth/staff-scope.ts). Every other console
// role sees the frame without data. No page-level role gate is added here.
const QUEUE_ROLES = ["SUPER_ADMIN"];
const PAGE_SIZE = 20;

const NOT_WIRED = "Non disponible : aucune donnée côté serveur pour l'instant.";

export default function InscriptionsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadQueue = !!role && QUEUE_ROLES.includes(role);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<DirectoryUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queueQuery = useQuery({
    queryKey: ["auth", "users", "registrations", search, region, page],
    queryFn: () => listUsers({ role: "COMPANY", status: "PENDING_APPROVAL", search, region, page, pageSize: PAGE_SIZE }),
    enabled: canReadQueue,
  });

  const closeReview = () => { setReviewing(null); setRejectReason(""); };
  const done = (text: string) => {
    queryClient.invalidateQueries({ queryKey: ["auth", "users"] });
    setNotice({ tone: "success", text });
    closeReview();
  };
  const failed = (e: Error) => setNotice({ tone: "error", text: e.message });
  const approveMutation = useMutation({ mutationFn: approveUser, onSuccess: () => done("Inscription approuvée."), onError: failed });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason),
    onSuccess: () => done("Inscription rejetée."),
    onError: failed,
  });

  const rows = queueQuery.data?.users ?? [];
  const total = queueQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Déclarants" }, { label: "Inscriptions" }]}
        title="File d'attente des inscriptions"
        actions={<AdminHeaderActions />}
      />

      {!canReadQueue && (
        <div role="note" className="cam-admin-notice cam-admin-notice--info">
          <span>
            La file des inscriptions d&apos;établissements n&apos;est consultable que par le super-administrateur
            plateforme pour l&apos;instant.
          </span>
        </div>
      )}
      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${notice.tone}`}>
          <span>{notice.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div className="cam-dash-kpis">
        <KpiTile tone="warning" label="En attente de vérification" value={canReadQueue && queueQuery.data ? total : null} />
        {/* No workflow writes COMPLEMENTS_REQUESTED; approvedAt has no writer; /auth/users has no date filter. */}
        <KpiTile tone="info" label="Compléments demandés" value={null} />
        <KpiTile tone="info" label="Approuvées ce trimestre" value={null} />
        <KpiTile tone="error" label="Rejetées ce trimestre" value={null} />
      </div>

      <section className="cam-pilot-panel" aria-label="Filtres">
        <div className="cam-pilot-panel-body">
          <div className="cam-admin-filters">
            <div className="cam-field" title={NOT_WIRED}>
              <label className="cam-label" htmlFor="ins-type">Type d&apos;établissement</label>
              <select id="ins-type" className="cam-select" disabled><option>Tous les types</option></select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="ins-region">Région d&apos;origine</label>
              <select id="ins-region" className="cam-select" value={region} disabled={!canReadQueue} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
                <option value="">Toutes les régions</option>
                {CAMEROON_ADMIN_HIERARCHY.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div className="cam-field" title="Seul le statut « En attente » existe aujourd'hui pour une inscription.">
              <label className="cam-label" htmlFor="ins-status">Statut de dossier</label>
              <select id="ins-status" className="cam-select" disabled><option>En attente</option></select>
            </div>
            <div className="cam-field" title={NOT_WIRED}>
              <label className="cam-label" htmlFor="ins-period">Date de soumission</label>
              <select id="ins-period" className="cam-select" disabled><option>Toutes les dates</option></select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="ins-search">Recherche</label>
              <div className="cam-admin-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="ins-search"
                  type="search"
                  className="cam-input"
                  placeholder="Nom, e-mail…"
                  value={searchInput}
                  disabled={!canReadQueue}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cam-pilot-panel" style={{ overflow: "hidden" }} aria-label="Inscriptions">
        <div className="cam-pilot-panel-body" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">N° Inscription</th>
                  <th scope="col">Organisation</th>
                  <th scope="col">Type</th>
                  <th scope="col">Région</th>
                  <th scope="col">Soumise le</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Vérification</th>
                  <th scope="col">Assigné à</th>
                  <th scope="col" style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    {/* registrationNumber, organisation name, type, documents and assignee are not returned by /auth/users. */}
                    <td title={NOT_WIRED}>—</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>—</div>
                      <div className="cam-admin-meta">{u.email}</div>
                    </td>
                    <td title={NOT_WIRED}>—</td>
                    <td>{[u.region, u.department].filter(Boolean).join("/") || "—"}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td title={NOT_WIRED}>—</td>
                    <td><span className="cam-badge cam-badge-warning">En attente</span></td>
                    <td title={NOT_WIRED}>—</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="cam-button cam-button-primary cam-button-sm" onClick={() => setReviewing(u)}>
                        Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!canReadQueue ? (
            <div className="cam-admin-empty">— Consultation réservée au super-administrateur plateforme.</div>
          ) : queueQuery.isLoading ? (
            <div className="cam-admin-empty">Chargement…</div>
          ) : queueQuery.isError ? (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ margin: "var(--cam-space-4)" }}>
              <span>Impossible de charger les inscriptions : {(queueQuery.error as Error).message}</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="cam-admin-empty">
              <strong>Aucune inscription en attente</strong>
              Les établissements sont aujourd&apos;hui activés dès leur auto-inscription.
            </div>
          ) : (
            <div className="cam-pagination" style={{ padding: "var(--cam-space-3) var(--cam-space-4)" }}>
              <span className="cam-admin-meta" style={{ marginRight: "auto" }}>
                Affichage {from}–{to} sur {total} inscriptions en attente
              </span>
              <button className="cam-pagination-btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
              <span className="cam-pagination-info">Page {page} sur {totalPages}</span>
              <button className="cam-pagination-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
            </div>
          )}
        </div>
      </section>

      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        eyebrow="Inscription"
        title={reviewing?.email ?? ""}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={closeReview}>Annuler</button>
            <button
              type="button"
              className="cam-button cam-button-secondary"
              disabled={pending || !rejectReason.trim()}
              onClick={() => reviewing && rejectMutation.mutate({ id: reviewing.id, reason: rejectReason.trim() })}
            >
              Rejeter
            </button>
            <button type="button" className="cam-button cam-button-primary" disabled={pending} onClick={() => reviewing && approveMutation.mutate(reviewing.id)}>
              Approuver
            </button>
          </>
        }
      >
        {reviewing && (
          <>
            <dl className="cam-admin-kv">
              <div><dt>Compte</dt><dd>{reviewing.email}</dd></div>
              <div><dt>Région / Département</dt><dd>{[reviewing.region, reviewing.department].filter(Boolean).join(" / ") || "—"}</dd></div>
              <div><dt>Soumise le</dt><dd>{formatDate(reviewing.createdAt)}</dd></div>
              <div><dt>Documents fournis</dt><dd>— (pièces non disponibles)</dd></div>
            </dl>
            <div className="cam-field">
              <label className="cam-label" htmlFor="ins-reject-reason">Motif du rejet (requis pour rejeter)</label>
              <textarea id="ins-reject-reason" className="cam-admin-textarea" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          </>
        )}
      </AdminDialog>
    </div>
  );
}
