"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STATUS_FILTERS,
  type DirectoryUser,
  type StatusFilterKey,
  activateUser,
  approveUser,
  deleteUser,
  directoryRoleLabel,
  directoryUserName,
  listUsers,
  rejectUser,
  rowStatusMeta,
  suspendUser,
  updateUserRole,
  updateUserTerritory,
} from "@/lib/user-directory";
import { ADMIN_ROLES } from "@/lib/roles";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import { NOT_PROVIDED, resolveDataState } from "@/lib/admin-data-state";

const PAGE_SIZE = 20;

type Modal =
  | { type: "approve"; user: DirectoryUser }
  | { type: "reject"; user: DirectoryUser }
  | { type: "role"; user: DirectoryUser }
  | { type: "toggle"; user: DirectoryUser }
  | { type: "delete"; user: DirectoryUser }
  | { type: "reassign"; user: DirectoryUser };

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
 * Account creation ("Ajouter Agent") is not part of this component: it lives
 * on /admin/utilisateurs, which owns the toolbar. This component covers the
 * roster/actions surface only.
 */
export interface RoleScope {
  key: string;
  label: string;
  roles: readonly string[];
}

interface UsersDirectoryProps {
  /** Replaces the plain role list with named role groups (sent as ?roles=). */
  roleScopes?: RoleScope[];
  defaultRoleScope?: string;
  defaultStatus?: StatusFilterKey;
  showRegionFilter?: boolean;
  /** Roles offered in the role-change dialog (default: every assignable role). */
  assignableRoles?: readonly string[];
  /**
   * Agent-roster layout (Figma "Utilisateurs ONEFOP"): initials avatar, assigned
   * region column and text-link row actions. Off by default so the Annuaire
   * "Utilisateurs" tab keeps its current layout.
   */
  agentRoster?: boolean;
  /**
   * Enables the "Réassigner" action (PATCH /auth/users/:id/territory) with
   * these roles on offer. Omitted = no reassign action.
   */
  reassignRoles?: readonly string[];
}

export function UsersDirectory({ roleScopes, defaultRoleScope, defaultStatus = "pending", showRegionFilter = false, assignableRoles = ADMIN_ROLES, agentRoster = false, reassignRoles }: UsersDirectoryProps = {}) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const { regions: directoryRegions } = useTerritoryRegions();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>(defaultStatus);
  const [roleFilter, setRoleFilter] = useState(roleScopes ? (defaultRoleScope ?? roleScopes[0].key) : "");
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Modal | null>(null);
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
  const reassignMutation = useMutation({
    mutationFn: ({ id, role, region, department }: { id: string; role: string; region: string; department: string }) =>
      updateUserTerritory(id, { role, region, department }),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const listState = resolveDataState({
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    rowCount: query.data ? query.data.users.length : null,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
      <div className="cam-admin-filters">
        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="users-search">Rechercher</label>
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
          <label className="cam-admin-label" htmlFor="users-role">{t("usersDirectory.roleLabel")}</label>
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
                {assignableRoles.map((r: string) => (
                  <option key={r} value={r}>{directoryRoleLabel(r, locale)}</option>
                ))}
              </>
            )}
          </select>
        </div>
        {showRegionFilter && (
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="users-region">{t("usersDirectory.regionLabel")}</label>
            <select
              id="users-region"
              className="cam-select"
              value={regionFilter}
              onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("usersDirectory.allRegionsOption")}</option>
              {directoryRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-3)" }}>
        <div className="cam-admin-chips" role="group" aria-label={t("usersDirectory.statusFilterAriaLabel")}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="cam-admin-chip"
              aria-pressed={statusFilter === f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
            >
              {locale === "en" ? f.labelEn : f.label}
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
        <div role="alert" className="cam-admin-notice cam-admin-notice--warn">
          <span>{t("usersDirectory.filterIgnoredWarning")}</span>
        </div>
      )}
      {listState !== "ready" && (
        <DataState
          state={listState}
          resource={t("adminNav.routes.annuaire")}
          onRetry={() => query.refetch()}
          title={
            listState === "loading"
              ? t("common.loading")
              : listState === "error"
                ? t("usersDirectory.loadError", { error: (query.error as Error).message })
                : listState === "empty"
                  ? t("usersDirectory.emptyState")
                  : undefined
          }
        />
      )}

      {listState === "ready" && query.data && (
        <>
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">{agentRoster ? t("usersDirectory.agentColumn") : t("usersDirectory.userColumn")}</th>
                  <th scope="col">{agentRoster ? t("usersDirectory.regionColumn") : t("usersDirectory.locationColumn")}</th>
                  <th scope="col">{t("usersDirectory.roleColumn")}</th>
                  <th scope="col">{t("usersDirectory.statusColumn")}</th>
                  <th scope="col" className="text-right">{t("usersDirectory.actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.users.map((u) => {
                  const meta = rowStatusMeta(u, locale);
                  const location = [u.region, u.department].filter(Boolean).join(" · ");
                  const name = directoryUserName(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={agentRoster ? { display: "flex", alignItems: "center", gap: "var(--cam-space-3)" } : undefined}>
                          {agentRoster && (
                            <span aria-hidden="true" className="cam-admin-initials">{initialsOf(u)}</span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div className="cam-admin-strong">{name || u.email}</div>
                            {name && (
                              <div className="cam-admin-meta">{u.email}</div>
                            )}
                            {u.matricule && (
                              <div className="cam-admin-code cam-admin-muted">{u.matricule}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {agentRoster ? (
                          <>
                            <div className={u.region ? undefined : "cam-admin-muted"}>{u.region || NOT_PROVIDED}</div>
                            {u.department && (
                              <div className="cam-admin-meta">{u.department}</div>
                            )}
                          </>
                        ) : (
                          <span className={location ? undefined : "cam-admin-muted"}>{location || NOT_PROVIDED}</span>
                        )}
                      </td>
                      <td>
                        <span className="cam-badge cam-badge-neutral">
                          {directoryRoleLabel(u.role, locale)}
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
                      <td className="text-right">
                        {agentRoster ? (
                          <RosterActions
                            user={u}
                            canReassign={!!reassignRoles}
                            onOpen={(type) => setModal({ type, user: u } as Modal)}
                          />
                        ) : (
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
                        )}
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

        {modal?.type === "approve" && (
          <ConfirmModal
            title={t("usersDirectory.approveAgentTitle")}
            body={t("usersDirectory.approveConfirmBody", { name: directoryUserName(modal.user) || modal.user.email })}
            confirmLabel={t("usersDirectory.approve")}
            confirmVariant="primary"
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
            confirmVariant={modal.user.isActive ? "danger" : "primary"}
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
        {modal?.type === "reassign" && reassignRoles && (
          <ReassignModal
            user={modal.user}
            roles={reassignRoles}
            pending={reassignMutation.isPending}
            error={reassignMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={(v) => reassignMutation.mutate({ id: modal.user.id, ...v })}
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
    </div>
  );
}

function initialsOf(u: DirectoryUser): string {
  const fromName = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join("");
  return (fromName || u.email.slice(0, 2)).toUpperCase();
}

type RosterModal = "approve" | "reject" | "role" | "toggle" | "delete" | "reassign";

// Figma row actions: text links separated by a thin rule, instead of buttons.
function RosterActions({ user, canReassign, onOpen }: { user: DirectoryUser; canReassign: boolean; onOpen: (type: RosterModal) => void }) {
  const t = useTranslations();
  const actions: { type: RosterModal; label: string; danger?: boolean }[] =
    user.status === "PENDING_APPROVAL"
      ? [{ type: "approve", label: t("usersDirectory.approve") }, { type: "reject", label: t("usersDirectory.reject"), danger: true }]
      : user.status === "REJECTED"
        ? [{ type: "delete", label: t("usersDirectory.delete"), danger: true }]
        : [
            ...(canReassign ? [{ type: "reassign" as const, label: t("usersDirectory.reassign") }] : []),
            { type: "role", label: t("usersDirectory.roleButton") },
            { type: "toggle", label: user.isActive ? t("usersDirectory.suspend") : t("usersDirectory.reactivate") },
            { type: "delete", label: t("usersDirectory.delete"), danger: true },
          ];
  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "var(--cam-space-2)" }}>
      {actions.map((a, i) => (
        <span key={a.type} style={{ display: "inline-flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
          {i > 0 && <span aria-hidden="true" className="cam-admin-muted">|</span>}
          <button
            type="button"
            className={`cam-text-button${a.danger ? " is-danger" : ""}`}
            onClick={() => onOpen(a.type)}
          >
            {a.label}
          </button>
        </span>
      ))}
    </div>
  );
}

function ErrorLine({ error }: { error: Error | null }) {
  const t = useTranslations();
  if (!error) return null;
  return (
    <div role="alert" className="cam-admin-notice cam-admin-notice--error">
      <span>{t("usersDirectory.actionError", { error: error.message })}</span>
    </div>
  );
}

/** Cancel on the left of the footer, the dialog's one decision on the right. */
function ModalFooter({ onCancel, children }: { onCancel: () => void; children?: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
      <button type="button" className="cam-button cam-button-secondary" onClick={onCancel}>{t("common.cancel")}</button>
      {children}
    </div>
  );
}

// Each confirmation is its own AdminDialog (G7): native <dialog>, focus
// trap, Escape and focus return, with its title as the dialog's label.
function ConfirmModal({
  title, body, confirmLabel, confirmVariant, pending, error, onCancel, onConfirm,
}: {
  title: string; body: string; confirmLabel: string; confirmVariant: "primary" | "danger"; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <AdminDialog
      open
      onClose={onCancel}
      title={title}
      footer={
        <ModalFooter onCancel={onCancel}>
          <button type="button" className={`cam-button cam-button-${confirmVariant}`} disabled={pending} onClick={onConfirm}>
            {pending ? "…" : confirmLabel}
          </button>
        </ModalFooter>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
        <p className="cam-admin-meta" style={{ margin: 0 }}>{body}</p>
        <ErrorLine error={error} />
      </div>
    </AdminDialog>
  );
}

function RejectModal({ user, pending, error, onCancel, onConfirm }: { user: DirectoryUser; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  return (
    <AdminDialog
      open
      onClose={onCancel}
      title={t("usersDirectory.rejectTitle", { name: directoryUserName(user) || user.email })}
      footer={
        <ModalFooter onCancel={onCancel}>
          <button
            type="button"
            className="cam-button cam-button-danger"
            disabled={pending || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "…" : t("usersDirectory.confirmRejectButton")}
          </button>
        </ModalFooter>
      }
    >
      {/* The label is now bound to the field; it was a free-standing
          <label> with no htmlFor. */}
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="users-reject-reason">{t("usersDirectory.rejectReasonLabel")}</label>
        <textarea
          id="users-reject-reason"
          className="cam-admin-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t("usersDirectory.rejectReasonPlaceholder")}
        />
      </div>
      <ErrorLine error={error} />
    </AdminDialog>
  );
}

function RoleModal({ user, roles, pending, error, onCancel, onConfirm }: { user: DirectoryUser; roles: readonly string[]; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (role: string) => void }) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  return (
    <AdminDialog open onClose={onCancel} title={t("usersDirectory.editRoleTitle")} footer={<ModalFooter onCancel={onCancel} />}>
      {/* Picking a role applies it; the current one is marked. */}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            className={`cam-text-button${r === user.role ? "" : " cam-admin-strong"}`}
            aria-current={r === user.role ? "true" : undefined}
            disabled={pending}
            onClick={() => onConfirm(r)}
            style={{ textAlign: "left", padding: "var(--cam-space-2) 0" }}
          >
            {directoryRoleLabel(r, locale)} {r === user.role && "✓"}
          </button>
        ))}
      </div>
      <ErrorLine error={error} />
    </AdminDialog>
  );
}

// Role + region + department in one PATCH /auth/users/:id/territory. Mirrors
// the server's rules so the admin sees them before submitting: REGIONAL_ADMIN needs
// a region, DIVISIONAL_ADMIN a region and a department. The server re-checks all of
// it and refuses reassigning your own account.
function ReassignModal({ user, roles, pending, error, onCancel, onConfirm }: {
  user: DirectoryUser; roles: readonly string[]; pending: boolean; error: Error | null; onCancel: () => void;
  onConfirm: (v: { role: string; region: string; department: string }) => void;
}) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const { regions: directoryRegions } = useTerritoryRegions();
  const [role, setRole] = useState(roles.includes(user.role) ? user.role : roles[0]);
  const [region, setRegion] = useState(user.region ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const { departments } = useTerritoryDepartments(region);
  const missing =
    (role === "REGIONAL_ADMIN" || role === "DIVISIONAL_ADMIN") && !region
      ? t("usersDirectory.reassignRegionRequired")
      : role === "DIVISIONAL_ADMIN" && !department
        ? t("usersDirectory.reassignDepartmentRequired")
        : null;
  return (
    <AdminDialog
      open
      onClose={onCancel}
      title={t("usersDirectory.reassignTitle", { name: directoryUserName(user) || user.email })}
      footer={
        <ModalFooter onCancel={onCancel}>
          <button
            type="button"
            className="cam-button cam-button-primary"
            disabled={pending || !!missing}
            onClick={() => onConfirm({ role, region, department })}
          >
            {pending ? "…" : t("usersDirectory.reassignSubmit")}
          </button>
        </ModalFooter>
      }
    >
      <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("usersDirectory.reassignHint")}</p>
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="reassign-role">{t("usersDirectory.roleColumn")}</label>
        <select id="reassign-role" className="cam-select" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r} value={r}>{directoryRoleLabel(r, locale)}</option>)}
        </select>
      </div>
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="reassign-region">{t("usersDirectory.reassignRegionLabel")}</label>
        <select id="reassign-region" className="cam-select" value={region} onChange={(e) => { setRegion(e.target.value); setDepartment(""); }}>
          <option value="">{t("usersDirectory.reassignNone")}</option>
          {directoryRegions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="reassign-department">{t("usersDirectory.reassignDepartmentLabel")}</label>
        <select id="reassign-department" className="cam-select" value={department} disabled={!region} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">{t("usersDirectory.reassignNone")}</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {missing && <p role="alert" className="cam-field-error" style={{ margin: 0 }}>{missing}</p>}
      <ErrorLine error={error} />
    </AdminDialog>
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
    <AdminDialog
      open
      onClose={onCancel}
      title={t("usersDirectory.deleteUserTitle", { name: directoryUserName(user) || user.email })}
      footer={
        <ModalFooter onCancel={onCancel}>
          <button type="button" className="cam-button cam-button-danger" disabled={!matches || pending} onClick={onConfirm}>
            {pending ? "…" : t("usersDirectory.delete")}
          </button>
        </ModalFooter>
      }
    >
      <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("usersDirectory.deleteWarning")}</p>
      {/* The "type the e-mail" instruction is now the input's label; the
          input had none. */}
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="users-delete-confirm">
          {t("usersDirectory.typeToConfirmLabel", { email: user.email })}
        </label>
        <input
          id="users-delete-confirm"
          type="text"
          className="cam-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={user.email}
        />
      </div>
      <ErrorLine error={error} />
    </AdminDialog>
  );
}
