// src/lib/user-directory.ts
//
// GET/PATCH/DELETE /auth/users* — read directly from src/auth/auth.controller.ts
// + auth.service.ts. Every endpoint here is gated server-side to exactly
// SUPER_ADMIN (@Roles('SUPER_ADMIN')) — no stream-scoped admin, matching
// annuaire_screen.dart's showUsersTab restriction exactly. Several of these
// are genuinely dangerous: role changes are a privilege-escalation vector,
// and deleteUser is a hard, irreversible delete (the backend itself refuses
// it with a 409 when the account has linked declarations/submissions/
// notifications, but otherwise it is permanent).
import { apiFetch } from "./api-client";

export interface DirectoryUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  isActive: boolean;
  region: string | null;
  department: string | null;
  matricule: string | null;
  serviceCode: string | null;
  createdAt: string;
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  /** Several roles at once (GET /auth/users?roles=A,B). */
  roles?: string[];
  region?: string;
  status?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListUsersResult {
  users: DirectoryUser[];
  total: number;
  page: number;
  pageSize: number;
}

export function listUsers(params: ListUsersParams) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.roles?.length) query.set("roles", params.roles.join(","));
  if (params.region) query.set("region", params.region);
  if (params.status) query.set("status", params.status);
  if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<ListUsersResult>(`/auth/users${qs ? `?${qs}` : ""}`);
}

export function approveUser(id: string) {
  return apiFetch(`/auth/approve-user/${id}`, { method: "PATCH" });
}

export function rejectUser(id: string, reason?: string) {
  return apiFetch(`/auth/reject-user/${id}`, {
    method: "PATCH",
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
}

export function updateUserRole(id: string, role: string) {
  return apiFetch(`/auth/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function suspendUser(id: string) {
  return apiFetch(`/auth/users/${id}/suspend`, { method: "PATCH" });
}

export function activateUser(id: string) {
  return apiFetch(`/auth/users/${id}/activate`, { method: "PATCH" });
}

export function deleteUser(id: string) {
  return apiFetch<{ message: string }>(`/auth/users/${id}`, { method: "DELETE" });
}

// Mirrors AuthService.ASSIGNABLE_ROLES / widgets/admin_kit.dart's
// kAssignableRoles exactly (same order).
export const ASSIGNABLE_ROLES = [
  "DIVISIONAL",
  "REGIONAL",
  "CENTRAL",
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
  "DATA_MANAGER",
  "CAMPAIGN_MANAGER",
  "ANALYST",
  "AUDITOR",
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  SUPER_ADMIN_DSMO: "Admin DSMO",
  SUPER_ADMIN_ONEFOP: "Admin ONEFOP",
  CENTRAL: "Central",
  REGIONAL: "Régional",
  DIVISIONAL: "Divisionnaire",
  DATA_MANAGER: "Gestionnaire de données",
  CAMPAIGN_MANAGER: "Gestionnaire de campagnes",
  ANALYST: "Analyste",
  AUDITOR: "Auditeur",
};

/**
 * ONEFOP personnel — mirrors ONEFOP_STAFF_ROLES in src/auth/staff-scope.ts,
 * the set a SUPER_ADMIN_ONEFOP may see, manage and assign. Administrator
 * accounts are managed from the Annuaire by SUPER_ADMIN.
 */
export const ONEFOP_STAFF_ROLES = ["CENTRAL", "REGIONAL", "DIVISIONAL", "DATA_MANAGER", "CAMPAIGN_MANAGER", "ANALYST", "AUDITOR"];
export const TERRITORIAL_ROLES = ["REGIONAL", "DIVISIONAL"];

export function directoryRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

const ROLE_COLORS: Record<string, string> = {
  REGIONAL: "var(--cam-info)",
  DIVISIONAL: "var(--cam-info)",
  CENTRAL: "var(--cam-warning)",
  DATA_MANAGER: "var(--cam-info)",
  CAMPAIGN_MANAGER: "var(--cam-info)",
  ANALYST: "var(--cam-info)",
  AUDITOR: "var(--cam-warning)",
  SUPER_ADMIN_DSMO: "var(--cam-green)",
  SUPER_ADMIN_ONEFOP: "var(--cam-green)",
  SUPER_ADMIN: "var(--cam-green-dark)",
};

export function directoryRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? "var(--cam-green)";
}

export function directoryUserName(u: DirectoryUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
}

export type StatusFilterKey = "all" | "pending" | "active" | "suspended" | "rejected";

export const STATUS_FILTERS: { key: StatusFilterKey; label: string; color: string; status?: string; isActive?: boolean }[] = [
  { key: "all", label: "Tous", color: "var(--cam-green)" },
  { key: "pending", label: "En attente", color: "var(--cam-warning)", status: "PENDING_APPROVAL" },
  { key: "active", label: "Actifs", color: "var(--cam-success)", status: undefined, isActive: true },
  { key: "suspended", label: "Suspendus", color: "var(--cam-error)", isActive: false },
  { key: "rejected", label: "Rejetés", color: "var(--cam-text-muted)", status: "REJECTED" },
];

export function rowStatusMeta(u: DirectoryUser): { label: string; color: string } {
  if (u.status === "PENDING_APPROVAL") return { label: "En attente", color: "var(--cam-warning)" };
  if (u.status === "REJECTED") return { label: "Rejeté", color: "var(--cam-text-muted)" };
  return u.isActive ? { label: "Actif", color: "var(--cam-success)" } : { label: "Suspendu", color: "var(--cam-error)" };
}
