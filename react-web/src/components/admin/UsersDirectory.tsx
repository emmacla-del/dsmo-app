"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ASSIGNABLE_ROLES,
  STATUS_FILTERS,
  type DirectoryUser,
  type StatusFilterKey,
  activateUser,
  approveUser,
  deleteUser,
  directoryRoleColor,
  directoryRoleLabel,
  directoryUserName,
  listUsers,
  rejectUser,
  rowStatusMeta,
  suspendUser,
  updateUserRole,
} from "@/lib/user-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";

const PAGE_SIZE = 20;

type Modal =
  | { type: "approve"; user: DirectoryUser }
  | { type: "reject"; user: DirectoryUser }
  | { type: "role"; user: DirectoryUser }
  | { type: "toggle"; user: DirectoryUser }
  | { type: "delete"; user: DirectoryUser };

/**
 * Faithful port of users_directory_screen.dart — the SUPER_ADMIN-only roster
 * behind Annuaire's "Utilisateurs" tab. This is the most consequential
 * admin screen built so far: role changes are a privilege-escalation
 * vector and delete is a hard, irreversible action (though the backend
 * itself refuses deletes with linked data — a 409, surfaced as an error
 * here, not silently swallowed). Every destructive/high-privilege action
 * keeps Flutter's own confirmation friction exactly: a confirm step for
 * approve/suspend/reactivate, and — for delete specifically — typing the
 * account's exact email before the delete button enables, matching
 * _DeleteConfirmSheet precisely rather than a plain "are you sure".
 *
 * "Nouvel agent" (CreateMinefopUserScreen, a separate creation form) is not
 * ported in this slice — this component covers the roster/actions surface
 * only.
 */
export interface RoleScope {
  key: string;
  label: string;
  roles: string[];
}

interface UsersDirectoryProps {
  /** Replaces the plain role list with named role groups (sent as ?roles=). */
  roleScopes?: RoleScope[];
  defaultRoleScope?: string;
  defaultStatus?: StatusFilterKey;
  showRegionFilter?: boolean;
  /** Roles offered in the role-change dialog (default: every assignable role). */
  assignableRoles?: string[];
}

export function UsersDirectory({ roleScopes, defaultRoleScope, defaultStatus = "pending", showRegionFilter = false, assignableRoles = ASSIGNABLE_ROLES }: UsersDirectoryProps = {}) {
  const t = useTranslations();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>(defaultStatus);
  const [roleFilter, setRoleFilter] = useState(roleScopes ? (defaultRoleScope ?? roleScopes[0].key) : "");
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Modal | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusFilter)!;

  const scopeRoles = roleScopes?.find((s) => s.key === roleFilter)?.roles;

  const query = useQuery({
    queryKey: ["auth", "users", search, statusFilter, roleFilter, regionFilter, page],
    queryFn: () =>
      listUsers({
        search,
        role: roleScopes ? undefined : roleFilter || undefined,
        roles: scopeRoles,
        region: regionFilter || undefined,
        status: activeFilter.status,
        isActive: activeFilter.isActive,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const total = query.data?.total ?? 0;
  // A backend that predates ?roles=/?region= ignores them and returns every
  // staff account — say so rather than showing that list under the filter's name.
  const filterIgnored =
    !!query.data &&
    query.data.users.some(
      (u) =>
        (scopeRoles && !scopeRoles.includes(u.role)) ||
        (regionFilter && (u.region ?? "").toLowerCase() !== regionFilter.toLowerCase()),
    );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["auth", "users"] });

  const approveMutation = useMutation({ mutationFn: (id: string) => approveUser(id), onSuccess: () => { invalidate(); setModal(null); } });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason || undefined),
    onSuccess: () => { invalidate(); setModal(null); },
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: () => { invalidate(); setModal(null); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) => (activate ? activateUser(id) : suspendUser(id)),
    onSuccess: () => { invalidate(); setModal(null); },
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => deleteUser(id), onSuccess: () => { invalidate(); setModal(null); } });

  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
      <div className="cam-admin-filters">
        <div className="cam-field">
          <label className="cam-label" htmlFor="users-search">Rechercher</label>
          <div className="cam-admin-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="users-search"
              type="search"
              className="cam-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("usersDirectory.searchPlaceholder")}
            />
          </div>
        </div>
        <div className="cam-field">
          <label className="cam-label" htmlFor="users-role">Rôle</label>
          <select
            id="users-role"
            className="cam-select"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            {roleScopes ? (
              roleScopes.map((scope) => (
                <option key={scope.key} value={scope.key}>{scope.label}</option>
              ))
            ) : (
              <>
                <option value="">{t("usersDirectory.allRolesOption")}</option>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{directoryRoleLabel(r)}</option>
                ))}
              </>
            )}
          </select>
        </div>
        {showRegionFilter && (
          <div className="cam-field">
            <label className="cam-label" htmlFor="users-region">Région</label>
            <select
              id="users-region"
              className="cam-select"
              value={regionFilter}
              onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
            >
              <option value="">Toutes les régions</option>
              {CAMEROON_ADMIN_HIERARCHY.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-3)" }}>
        <div className="cam-admin-chips" role="group" aria-label="Statut du compte">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="cam-admin-chip"
              aria-pressed={statusFilter === f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
          <span className="cam-admin-meta">{t("usersDirectory.accountsCount", { count: total })}</span>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => query.refetch()}>
            {t("usersDirectory.refresh")}
          </button>
        </div>
      </div>

      {filterIgnored && (
        <p role="alert" style={{ color: "var(--cam-warning)", fontSize: "var(--cam-font-size-sm)", marginBottom: "var(--cam-space-3)" }}>
          Le serveur n&apos;applique pas encore ce filtre : la liste ci-dessous contient des comptes hors du rôle ou de la région choisis.
        </p>
      )}
      {query.isLoading && <p className="cam-admin-empty">{t("common.loading")}</p>}
      {query.isError && <div role="alert" style={{ color: "var(--cam-error)" }}>{t("usersDirectory.loadError", { error: (query.error as Error).message })}</div>}
      {query.data && query.data.users.length === 0 && <p className="cam-admin-empty">{t("usersDirectory.emptyState")}</p>}

      {query.data && query.data.users.length > 0 && (
        <>
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">{t("usersDirectory.userColumn")}</th>
                  <th scope="col">{t("usersDirectory.locationColumn")}</th>
                  <th scope="col">{t("usersDirectory.roleColumn")}</th>
                  <th scope="col">{t("usersDirectory.statusColumn")}</th>
                  <th scope="col" style={{ textAlign: "right" }}>{t("usersDirectory.actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.users.map((u) => {
                  const meta = rowStatusMeta(u);
                  const location = [u.region, u.department].filter(Boolean).join(" · ");
                  const name = directoryUserName(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{name || u.email}</div>
                        {name && (
                          <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
                            {u.email}
                          </div>
                        )}
                        {u.matricule && (
                          <div style={{ fontFamily: "var(--cam-font-mono)", fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
                            {u.matricule}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ color: location ? "var(--cam-text)" : "var(--cam-text-muted)" }}>
                          {location || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="cam-badge cam-badge-neutral" style={{ color: directoryRoleColor(u.role), borderColor: "var(--cam-border)" }}>
                          {directoryRoleLabel(u.role)}
                        </span>
                      </td>
                      <td>
                        <span className={`cam-badge ${
                          u.status === "PENDING_APPROVAL" ? "cam-badge-warning" :
                          u.status === "REJECTED" ? "cam-badge-neutral" :
                          u.isActive ? "cam-badge-success" : "cam-badge-error"
                        }`}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "var(--cam-space-2)", alignItems: "center", justifyContent: "flex-end" }}>
                          {u.status === "PENDING_APPROVAL" && (
                            <>
                              <button
                                type="button"
                                className="cam-button cam-button-danger cam-button-sm"
                                onClick={() => setModal({ type: "reject", user: u })}
                              >
                                {t("usersDirectory.reject")}
                              </button>
                              <button
                                type="button"
                                className="cam-button cam-button-primary cam-button-sm"
                                onClick={() => setModal({ type: "approve", user: u })}
                              >
                                {t("usersDirectory.approve")}
                              </button>
                            </>
                          )}
                          {u.status === "REJECTED" && (
                            <button
                              type="button"
                              className="cam-button cam-button-danger cam-button-sm"
                              onClick={() => setModal({ type: "delete", user: u })}
                            >
                              {t("usersDirectory.delete")}
                            </button>
                          )}
                          {u.status !== "PENDING_APPROVAL" && u.status !== "REJECTED" && (
                            <>
                              <button
                                type="button"
                                className="cam-button cam-button-secondary cam-button-sm"
                                onClick={() => setModal({ type: "role", user: u })}
                              >
                                {t("usersDirectory.roleButton")}
                              </button>
                              <button
                                type="button"
                                className="cam-button cam-button-secondary cam-button-sm"
                                onClick={() => setModal({ type: "toggle", user: u })}
                              >
                                {u.isActive ? t("usersDirectory.suspend") : t("usersDirectory.reactivate")}
                              </button>
                              <button
                                type="button"
                                className="cam-button cam-button-danger cam-button-sm"
                                onClick={() => setModal({ type: "delete", user: u })}
                              >
                                {t("usersDirectory.delete")}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="cam-pagination">
              <button className="cam-pagination-btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("usersDirectory.prevPage")}
              </button>
              <span className="cam-pagination-info">
                {t("usersDirectory.pageIndicator", { page, totalPages })}
              </span>
              <button className="cam-pagination-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t("usersDirectory.nextPage")}
              </button>
            </div>
          )}
        </>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setModal(null)}
        className="cam-admin-dialog"
        style={{ width: "min(460px, calc(100vw - 32px))" }}
      >
        {modal?.type === "approve" && (
          <ConfirmModal
            title={t("usersDirectory.approveAgentTitle")}
            body={t("usersDirectory.approveConfirmBody", { name: directoryUserName(modal.user) || modal.user.email })}
            confirmLabel={t("usersDirectory.approve")}
            confirmColor="var(--cam-success)"
            pending={approveMutation.isPending}
            error={approveMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={() => approveMutation.mutate(modal.user.id)}
          />
        )}
        {modal?.type === "toggle" && (
          <ConfirmModal
            title={modal.user.isActive ? t("usersDirectory.suspendAccountTitle") : t("usersDirectory.reactivateAccountTitle")}
            body={
              modal.user.isActive
                ? t("usersDirectory.suspendBody", { name: directoryUserName(modal.user) || modal.user.email })
                : t("usersDirectory.reactivateBody", { name: directoryUserName(modal.user) || modal.user.email })
            }
            confirmLabel={modal.user.isActive ? t("usersDirectory.suspend") : t("usersDirectory.reactivate")}
            confirmColor={modal.user.isActive ? "var(--cam-warning)" : "var(--cam-success)"}
            pending={toggleMutation.isPending}
            error={toggleMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={() => toggleMutation.mutate({ id: modal.user.id, activate: !modal.user.isActive })}
          />
        )}
        {modal?.type === "reject" && (
          <RejectModal
            user={modal.user}
            pending={rejectMutation.isPending}
            error={rejectMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={(reason) => rejectMutation.mutate({ id: modal.user.id, reason })}
          />
        )}
        {modal?.type === "role" && (
          <RoleModal
            user={modal.user}
            roles={assignableRoles}
            pending={roleMutation.isPending}
            error={roleMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={(role) => roleMutation.mutate({ id: modal.user.id, role })}
          />
        )}
        {modal?.type === "delete" && (
          <DeleteModal
            user={modal.user}
            pending={deleteMutation.isPending}
            error={deleteMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={() => deleteMutation.mutate(modal.user.id)}
          />
        )}
      </dialog>
    </div>
  );
}

const modalBodyStyle: React.CSSProperties = { padding: "var(--cam-space-5)" };
const modalTitleStyle: React.CSSProperties = { fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" };
const modalActionsRow: React.CSSProperties = { display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" };
const cancelBtnStyle: React.CSSProperties = { flex: 1 };

function ErrorLine({ error }: { error: Error | null }) {
  const t = useTranslations();
  if (!error) return null;
  return <p role="alert" style={{ color: "var(--cam-error)", marginTop: "var(--cam-space-3)", fontSize: "var(--cam-font-size-sm)" }}>{t("usersDirectory.actionError", { error: error.message })}</p>;
}

function ConfirmModal({
  title, body, confirmLabel, confirmColor, pending, error, onCancel, onConfirm,
}: {
  title: string; body: string; confirmLabel: string; confirmColor: string; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: () => void;
}) {
  const t = useTranslations();
  return (
    <div style={modalBodyStyle}>
      <h2 style={modalTitleStyle}>{title}</h2>
      <p style={{ color: "var(--cam-text-muted)" }}>{body}</p>
      <div style={modalActionsRow}>
        <button type="button" className="cam-button cam-button-secondary" style={cancelBtnStyle} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="cam-button" disabled={pending} onClick={onConfirm} style={{ flex: 1, color: "#fff", background: confirmColor }}>
          {pending ? "…" : confirmLabel}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function RejectModal({ user, pending, error, onCancel, onConfirm }: { user: DirectoryUser; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  return (
    <div style={modalBodyStyle}>
      <h2 style={modalTitleStyle}>{t("usersDirectory.rejectTitle", { name: directoryUserName(user) || user.email })}</h2>
      <label style={{ display: "block", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
        {t("usersDirectory.rejectReasonLabel")}
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder={t("usersDirectory.rejectReasonPlaceholder")}
        style={{ width: "100%", border: "1px solid var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", padding: "var(--cam-space-2)", fontFamily: "inherit" }}
      />
      <div style={modalActionsRow}>
        <button type="button" className="cam-button cam-button-secondary" style={cancelBtnStyle} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="cam-button" disabled={pending} onClick={() => onConfirm(reason.trim())} style={{ flex: 1, color: "#fff", background: "var(--cam-error)" }}>
          {pending ? "…" : t("usersDirectory.confirmRejectButton")}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function RoleModal({ user, roles, pending, error, onCancel, onConfirm }: { user: DirectoryUser; roles: string[]; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (role: string) => void }) {
  const t = useTranslations();
  return (
    <div style={modalBodyStyle}>
      <h2 style={modalTitleStyle}>{t("usersDirectory.editRoleTitle")}</h2>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            onClick={() => onConfirm(r)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "var(--cam-space-2) 0", border: "none", background: "none",
              cursor: "pointer", fontWeight: r === user.role ? 700 : 500, color: r === user.role ? "var(--cam-green)" : "var(--cam-text)",
            }}
          >
            {directoryRoleLabel(r)} {r === user.role && "✓"}
          </button>
        ))}
      </div>
      <div style={modalActionsRow}>
        <button type="button" className="cam-button cam-button-secondary" style={{ width: "100%" }} onClick={onCancel}>{t("common.cancel")}</button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

// Faithful port of _DeleteConfirmSheet — the delete button stays disabled
// until the typed text exactly matches the account's email, the same
// deliberate friction Flutter puts in front of this irreversible action.
function DeleteModal({ user, pending, error, onCancel, onConfirm }: { user: DirectoryUser; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: () => void }) {
  const t = useTranslations();
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === user.email;
  return (
    <div style={modalBodyStyle}>
      <h2 style={modalTitleStyle}>{t("usersDirectory.deleteUserTitle", { name: directoryUserName(user) || user.email })}</h2>
      <p style={{ color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)" }}>
        {t("usersDirectory.deleteWarning")}
      </p>
      <p style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 500, marginTop: "var(--cam-space-3)" }}>
        {t("usersDirectory.typeToConfirmLabel", { email: user.email })}
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={user.email}
        style={{ width: "100%", height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", padding: "0 var(--cam-space-3)" }}
      />
      <div style={modalActionsRow}>
        <button type="button" className="cam-button cam-button-secondary" style={cancelBtnStyle} onClick={onCancel}>{t("common.cancel")}</button>
        <button
          type="button"
          disabled={!matches || pending}
          onClick={onConfirm}
          style={{
            flex: 1, height: "var(--cam-form-field-height)", border: "none", color: "#fff",
            background: matches ? "var(--cam-error)" : "var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)",
            cursor: matches ? "pointer" : "not-allowed",
          }}
        >
          {pending ? "…" : t("usersDirectory.delete")}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
