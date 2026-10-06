"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import {
  approveUser,
  listCompanyRegistrations,
  rejectUser,
  requestComplements,
  type CompanyRegistrationItem,
} from "@/lib/user-directory";
import { formatDate, hasRealNiu } from "@/lib/companies-directory";
import { APPROVAL_ROLES, DIRECTORY_ROLES } from "@/lib/roles";
import { inscriptionsHref, registrationMethodLabel, registrationMethodTone } from "@/lib/inscriptions";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { CoveragePanel } from "@/components/admin/CoveragePanel";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { doualaCalendarYear, parseYearParam } from "@/lib/pilotage-targets";

const PAGE_SIZE = 8;

const ENTITY_TYPES = [
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "COOPERATIVE", label: "Coopérative" },
  { value: "CTD", label: "CTD" },
  { value: "ONG", label: "ONG" },
  { value: "ADMINISTRATION", label: "Administration" },
  { value: "PROJECT_PROGRAM", label: "Projet / programme" },
  { value: "VOCATIONAL_TRAINING", label: "CFP" },
];

function entityLabel(value: string | null): string {
  return ENTITY_TYPES.find((item) => item.value === value)?.label ?? value ?? "—";
}

// Company column names as the correction form presents them, so a reviewer
// reads the diff in the applicant's own words. An unmapped key falls back to
// itself rather than being hidden.
const FIELD_LABELS: Record<string, string> = {
  name: "Raison sociale",
  taxNumber: "Numéro contribuable (NIU)",
  mainActivity: "Activité principale",
  secondaryActivity: "Activité secondaire",
  parentCompany: "Société mère",
  address: "Adresse",
  cnpsNumber: "Numéro CNPS",
  fax: "Fax",
  socialCapital: "Capital social",
  entityType: "Type d'entité",
  region: "Région",
  department: "Département",
  subdivision: "Arrondissement",
  regionId: "Région (identifiant)",
  departmentId: "Département (identifiant)",
  subdivisionId: "Arrondissement (identifiant)",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// An empty or absent before/after reads as a dash rather than as "null".
function diffValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return ENTITY_TYPES.find((t) => t.value === value)?.label ?? value;
  return String(value);
}

function statusLabel(status: string): { text: string; bg: string; color: string } {
  if (status === "PENDING_APPROVAL") return { text: "EN ATTENTE", bg: "#fef3c7", color: "#b45309" };
  if (status === "COMPLEMENTS_REQUESTED") return { text: "COMPLÉMENTS DEMANDÉS", bg: "#eff6ff", color: "#1d4ed8" };
  if (status === "ACTIVE") return { text: "APPROUVÉE", bg: "#004d3d", color: "#ffffff" };
  if (status === "REJECTED") return { text: "REJETÉE", bg: "#fee2e2", color: "#b91c1c" };
  return { text: status, bg: "#f1f5f9", color: "#475569" };
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
  };

  const done = (text: string) => {
    queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    setNotice({ tone: "success", text });
    closeReview();
  };

  const failed = (e: Error) => setNotice({ tone: "error", text: e.message });

  const approveMutation = useMutation({
    mutationFn: ({ id, centralStructureConfirmed }: { id: string; centralStructureConfirmed: boolean }) =>
      approveUser(id, { centralStructureConfirmed }),
    onSuccess: () => done("Inscription validée et compte activé."),
    onError: failed,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason),
    onSuccess: () => done("Inscription rejetée."),
    onError: failed,
  });
  const complementsMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => requestComplements(id, message),
    onSuccess: () => done("Demande de compléments transmise."),
    onError: failed,
  });

  const handleDecisionSubmit = () => {
    if (!reviewing) return;
    if (decision === "APPROVE") {
      if (reviewing.requiresCentralStructureCheck && !centralChecked) {
        setNotice({ tone: "error", text: "Cochez la confirmation « structure centrale » avant d'approuver." });
        return;
      }
      approveMutation.mutate({ id: reviewing.id, centralStructureConfirmed: centralChecked });
    } else if (decision === "REJECT") {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: "Le motif de rejet est obligatoire." });
        return;
      }
      rejectMutation.mutate({ id: reviewing.id, reason: comment.trim() });
    } else {
      if (!comment.trim()) {
        setNotice({ tone: "error", text: "Le message de demande de compléments est obligatoire." });
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
        breadcrumb={[{ label: "Déclarants" }, { label: "Inscriptions" }]}
        title="Inscriptions"
        actions={
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <AdminHeaderActions showCampaignPill={false} />
            {canRegisterAssisted && (
              <Link href="/admin/inscriptions/nouvelle" className="cam-button cam-button-primary cam-button-sm">
                Nouvelle inscription
              </Link>
            )}
          </div>
        }
      />

      <ViewSwitch
        label="Vues des inscriptions"
        items={[
          { key: "file", label: "File d'inscriptions", active: vue === "file", href: inscriptionsHref(currentQuery, "file") },
          { key: "couverture", label: "Couverture", active: vue === "couverture", href: inscriptionsHref(currentQuery, "couverture") },
        ]}
      />

      {vue === "couverture" && (
        <CoveragePanel year={year} onYearChange={(next) => router.replace(inscriptionsHref(currentQuery, "couverture", { annee: next }))} />
      )}

      {vue === "file" && (<>
      {createdBy && (
        <div role="status" className="cam-admin-notice cam-admin-notice--info" style={{ marginBottom: 16 }}>
          <span>
            Inscriptions saisies par{" "}
            <strong>{items.find((i) => i.createdBy === createdBy)?.createdByName ?? "l'agent sélectionné"}</strong>
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
            Retirer ce filtre
          </button>
        </div>
      )}

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${notice.tone}`} style={{ marginBottom: 16 }}>
          <span>{notice.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <Kpi value={counts.pending} label="En attente de vérification" accent="#f59e0b" />
        <Kpi value={counts.complements} label="Compléments demandés" accent="#2563eb" />
        <Kpi value={counts.approved} label="Approuvées" accent="#007a5e" />
        <Kpi value={counts.rejected} label="Rejetées" accent="#dc2626" />
      </div>

      <section className="cam-admin-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14, alignItems: "flex-end" }}>
          <Filter label="Type d'établissement">
            <select className="cam-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tous les types</option>
              {ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Filter>
          <Filter label="Région d'origine">
            <select className="cam-select" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
              <option value="">Toutes les régions</option>
              {territoryRegions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Filter>
          <Filter label="Statut">
            <select className="cam-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">En file (attente + compléments)</option>
              <option value="ALL">Tous les statuts</option>
              <option value="PENDING_APPROVAL">En attente</option>
              <option value="COMPLEMENTS_REQUESTED">Compléments demandés</option>
              <option value="ACTIVE">Approuvée</option>
              <option value="REJECTED">Rejetée</option>
            </select>
          </Filter>
          <Filter label="Date de soumission">
            <select className="cam-select" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }}>
              <option value="all">Toutes les dates</option>
              <option value="30">Derniers 30 jours</option>
              <option value="90">Derniers 90 jours</option>
            </select>
          </Filter>
          <Filter label="Recherche">
            <input className="cam-input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nom, NIU, e-mail…" />
          </Filter>
        </div>
      </section>

      {!canReadQueue && <p className="cam-admin-lede">Vous n&apos;avez pas accès à cette file.</p>}
      {queueQuery.isLoading && <p className="cam-admin-lede">Chargement…</p>}
      {queueQuery.isError && <div className="cam-admin-notice cam-admin-notice--error" role="alert">Impossible de charger les inscriptions.</div>}

      <section className="cam-dash-table-wrap">
        <table className="cam-dash-table">
          <thead>
            <tr>
              <th scope="col">Organisation</th>
              <th scope="col">Type</th>
              <th scope="col">Territoire</th>
              <th scope="col">Soumise le</th>
              <th scope="col">Enregistré par</th>
              <th scope="col">Vérification</th>
              <th scope="col">Doublons</th>
              <th scope="col">Action</th>
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
                      {badge.text}
                    </span>
                  </td>
                  <td>{item.duplicateHints.length > 0 ? item.duplicateHints.length : "—"}</td>
                  <td>
                    <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setReviewing(item)}>
                      Examiner
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cam-admin-lede" style={{ margin: 0 }}>Affichage {start}-{end} sur {total}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</button>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={end >= total} onClick={() => setPage((current) => current + 1)}>Suivant</button>
          </div>
        </div>
      </section>
      </>)}

      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        title={`Validation du compte — ${reviewing?.organisation || ""}`}
        eyebrow="Dossier d'auto-inscription"
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={closeReview} disabled={pendingMutation}>Annuler</button>
            <button type="button" className="cam-button cam-button-primary" onClick={handleDecisionSubmit} disabled={pendingMutation}>
              {pendingMutation ? "…" : "Confirmer"}
            </button>
          </>
        }
      >
        {reviewing && (
          <div>
            <p>Type : <strong>{entityLabel(reviewing.entityType)}</strong> — {reviewing.region} / {reviewing.department}</p>
            <p>NIU : {hasRealNiu(reviewing.taxNumber) ? reviewing.taxNumber : "—"}{reviewing.cnpsNumber ? ` — CNPS : ${reviewing.cnpsNumber}` : ""}</p>
            {reviewing.duplicateHints.length > 0 && (
              <div className="cam-admin-notice cam-admin-notice--warn" role="status">
                {reviewing.duplicateHints.map((hint) => <p key={hint} style={{ margin: 0 }}>{hint}</p>)}
              </div>
            )}
            {reviewing.lastResubmission && (
              <div>
                <p style={{ marginBottom: 4 }}>
                  <strong>Corrections envoyées</strong> le {formatDate(reviewing.lastResubmission.at)}
                </p>
                {Object.keys(reviewing.lastResubmission.changes).length === 0 ? (
                  <p style={{ margin: 0 }}>Dossier renvoyé sans modification.</p>
                ) : (
                  <table className="cam-dash-table">
                    <thead>
                      <tr>
                        <th scope="col">Champ</th>
                        <th scope="col">Avant</th>
                        <th scope="col">Après</th>
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
            {reviewing.requiresCentralStructureCheck && (
              <label className="cam-admin-choice">
                <input type="checkbox" checked={centralChecked} onChange={(e) => setCentralChecked(e.target.checked)} />
                Structure centrale confirmée
              </label>
            )}
            <div className="cam-target-modes" role="radiogroup" aria-label="Décision">
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "APPROVE"} onChange={() => setDecision("APPROVE")} />
                Approuver le compte
              </label>
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "REJECT"} onChange={() => setDecision("REJECT")} />
                Rejeter le compte
              </label>
              <label className="cam-admin-choice">
                <input type="radio" name="decision" checked={decision === "REQUEST_COMPLEMENTS"} onChange={() => setDecision("REQUEST_COMPLEMENTS")} />
                Demander des compléments
              </label>
            </div>
            {decision !== "APPROVE" && (
              <label className="cam-target-year">
                {decision === "REJECT" ? "Motif de rejet" : "Message de compléments"}
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
  const label = registrationMethodLabel(method);
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
