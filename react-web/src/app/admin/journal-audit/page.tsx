"use client";

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { directoryRoleLabel } from "@/lib/user-directory";
import {
  AUDIT_ACTIONS,
  AUDIT_PERIODS,
  AUDIT_RESOURCE_TYPES,
  auditActionLabel,
  auditActionTone,
  auditActorName,
  auditDetailsSummary,
  auditResourceLabel,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import type { UserRole } from "@/lib/user-types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// Mirrors @Roles on GET /audit/reports (src/report/audit.controller.ts).
const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "AUDITOR"];
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
// Figma default. "" = Toutes les dates.
const DEFAULT_PERIOD = "7d";

function fmtCount(n: number) {
  return n.toLocaleString("fr-FR");
}

function fmtStamp(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Debounced text filter: `input` is what is typed, `value` is sent 300 ms
// after the last keystroke (both are contains queries server-side).
function useDebouncedText(onSettle: () => void) {
  const [input, setInput] = useState("");
  const [value, setValue] = useState("");
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === value) return;
    const timer = setTimeout(() => {
      setValue(trimmed);
      onSettle();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, value, onSettle]);
  return { input, setInput, value, reset: () => { setInput(""); setValue(""); } };
}

export default function JournalAuditPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [offset, setOffset] = useState(0);
  const resetOffset = useCallback(() => setOffset(0), []);
  const actor = useDebouncedText(resetOffset);
  const object = useDebouncedText(resetOffset);

  const auditQuery = useQuery({
    queryKey: ["admin", "audit", "list", { period, action, resourceType, actor: actor.value, object: object.value, offset }],
    queryFn: () =>
      listAuditLog({
        period: period || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        actor: actor.value || undefined,
        resourceId: object.value || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: !isLoading && !forbidden,
    placeholderData: keepPreviousData,
  });

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès réservé aux super-administrateurs plateforme et ONEFOP, et aux auditeurs.</p>
      </div>
    );
  }

  const changeFilter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;

  // TODO(backend, M): Figma "Exporter le journal" needs a server-side export that audits itself (see deferred.md)
  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Journal d'audit" }]}
        title="Journal d'Audit Système"
        actions={<AdminHeaderActions />}
      />
      <section className="cam-admin-section" aria-label="Filtres">
        <div className="cam-admin-section-body" style={{ padding: "var(--cam-space-4) var(--cam-space-5)" }}>
          <div className="cam-admin-filters" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <div className="cam-field">
              <label className="cam-label" htmlFor="audit-period">Période</label>
              <select id="audit-period" className="cam-select" value={period} onChange={(e) => changeFilter(() => setPeriod(e.target.value))}>
                <option value="">Toutes les dates</option>
                {AUDIT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="audit-actor">Acteur</label>
              <input
                id="audit-actor"
                type="search"
                className="cam-input"
                placeholder="Nom ou e-mail"
                value={actor.input}
                onChange={(e) => actor.setInput(e.target.value)}
              />
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="audit-action">Type d&apos;action</label>
              <select id="audit-action" className="cam-select" value={action} onChange={(e) => changeFilter(() => setAction(e.target.value))}>
                <option value="">Toutes</option>
                {Object.entries(AUDIT_ACTIONS).map(([code, a]) => <option key={code} value={code}>{a.label}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="audit-resource-type">Type d&apos;objet</label>
              <select id="audit-resource-type" className="cam-select" value={resourceType} onChange={(e) => changeFilter(() => setResourceType(e.target.value))}>
                <option value="">Tous</option>
                {Object.entries(AUDIT_RESOURCE_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="audit-object">Objet de l&apos;action</label>
              <div className="cam-admin-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="audit-object"
                  type="search"
                  className="cam-input"
                  placeholder="Rechercher par ID…"
                  value={object.input}
                  onChange={(e) => object.setInput(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--cam-space-2)" }}>
            <button
              type="button"
              className="cam-text-button"
              onClick={() => changeFilter(() => { setPeriod(DEFAULT_PERIOD); setAction(""); setResourceType(""); actor.reset(); object.reset(); })}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </section>

      <section className="cam-admin-section" aria-label="Journal d'audit">
        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th scope="col">Horodatage</th>
                <th scope="col">Acteur</th>
                <th scope="col">Action</th>
                <th scope="col">Objet</th>
                <th scope="col">Détails</th>
                <th scope="col">État précédent → nouveau</th>
              </tr>
            </thead>
            <tbody>
              {auditQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="cam-admin-empty">Chargement du journal…</td>
                </tr>
              ) : auditQuery.isError ? (
                <tr>
                  <td colSpan={6} className="cam-admin-empty" role="alert">
                    <strong>Le journal n&apos;a pas pu être chargé</strong>
                    {(auditQuery.error as Error)?.message}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cam-admin-empty">
                    <strong>Aucun événement</strong>
                    Aucun événement ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <time dateTime={e.timestamp}>{fmtStamp(e.timestamp)}</time>
                    </td>
                    <td>
                      <span className="cam-admin-strong">{auditActorName(e)}</span>
                      {e.user?.role && (
                        <span className="cam-admin-meta" style={{ display: "block" }}>{directoryRoleLabel(e.user.role)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`cam-badge cam-badge-${auditActionTone(e.action)}`}>{auditActionLabel(e.action)}</span>
                    </td>
                    <td>
                      {auditResourceLabel(e.resourceType)}
                      {e.resourceId && (
                        <span className="cam-admin-code" style={{ display: "block" }} title={e.resourceId}>{e.resourceId}</span>
                      )}
                    </td>
                    <td style={{ overflowWrap: "anywhere" }}>{auditDetailsSummary(e)}</td>
                    <td>{auditTransition(e) ?? <span className="cam-admin-muted">—</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cam-pagination" style={{ justifyContent: "space-between", padding: "0 var(--cam-space-4) var(--cam-space-4)" }}>
          <span className="cam-pagination-info" aria-live="polite">
            {total === 0
              ? "Aucun événement"
              : `Affichage de ${fmtCount(offset + 1)}–${fmtCount(offset + entries.length)} sur ${fmtCount(total)} événement${total > 1 ? "s" : ""}`}
          </span>
          <div style={{ display: "flex", gap: "var(--cam-space-2)" }}>
            <button
              type="button"
              className="cam-pagination-btn"
              disabled={offset === 0 || auditQuery.isFetching}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="cam-pagination-btn"
              disabled={offset + PAGE_SIZE >= total || auditQuery.isFetching}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
