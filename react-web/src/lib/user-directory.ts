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
import type { UiLocale } from "./register-i18n";

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
  // The organigramme post's title and type (AuthService.listUsers).
  poste?: string | null;
  positionType?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  submissionsCount?: number | null;
  perAgentTarget?: number | null;
  // Phase 2 attribution (AuthService.listUsers): how the account was created
  // and by whom. createdByName is resolved server-side from the createdBy
  // relation, so a row renders a name without a second request. Both are null
  // on a self-registration and on accounts that predate the tracking.
  registrationMethod?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  /** Several roles at once (GET /auth/users?roles=A,B). */
  roles?: readonly string[];
  region?: string;
  status?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  fromCreatedAt?: string;
  toCreatedAt?: string;
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
  if (params.fromCreatedAt) query.set("fromCreatedAt", params.fromCreatedAt);
  if (params.toCreatedAt) query.set("toCreatedAt", params.toCreatedAt);
  const qs = query.toString();
  return apiFetch<ListUsersResult>(`/auth/users${qs ? `?${qs}` : ""}`);
}

// centralStructureConfirmed backs the "structure centrale" checkbox, which
// the server requires before approving an ADMINISTRATION file. The four
// verification flags are the reviewer's ✓ marks on the entity's name, phone,
// contact email and CNPS (see verificationFlags in inscriptions.ts); the
// server refuses a company approval unless every applicable one is true.
// Each is sent as `true` only when the reviewer actually set it: the server
// demands strictly `true`.
export interface ApproveUserOptions {
  centralStructureConfirmed?: boolean;
  nameVerified?: boolean;
  phoneVerified?: boolean;
  contactEmailVerified?: boolean;
  cnpsVerified?: boolean;
}

export function approveUser(id: string, options: ApproveUserOptions = {}) {
  const body = Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, value === true]),
  );
  return apiFetch(`/auth/approve-user/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ centralStructureConfirmed: false, ...body }),
  });
}

export function rejectUser(id: string, reason?: string) {
  return apiFetch(`/auth/reject-user/${id}`, {
    method: "PATCH",
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
}

export function requestComplements(id: string, message: string) {
  return apiFetch(`/auth/request-complements/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ message }),
  });
}

export interface CompanyRegistrationItem {
  id: string;
  companyId: string;
  organisation: string;
  email: string;
  entityType: string | null;
  region: string;
  department: string;
  status: string;
  taxNumber: string;
  cnpsNumber: string | null;
  /** The entity's phone ("Téléphone / WhatsApp"), a verified review row. */
  phone: string | null;
  // The declarant, shown in the review dialog as context, not verified.
  respondentFirstName: string | null;
  respondentLastName: string | null;
  respondentFunction: string | null;
  respondentPhone: string | null;
  respondentPhone2: string | null;
  submittedAt: string;
  registrationNumber: string | null;
  approvalComment: string | null;
  rejectionReason: string | null;
  duplicateHints: string[];
  requiresCentralStructureCheck: boolean;
  // Phase 2 attribution — see DirectoryUser above for the same three fields.
  registrationMethod: string | null;
  createdBy: string | null;
  createdByName: string | null;
  // The corrections the company last sent, when that resubmission is newer
  // than the last complements request on the same file. null when the company
  // has not corrected anything since the reviewer last wrote to it.
  lastResubmission: {
    at: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  } | null;
  // When the reviewers' wait on the file began (registration, or the last
  // resubmission), and whether it is past the overdue threshold. null /
  // false when the file is not the reviewers' move (src/auth/registration-overdue.ts).
  waitingSince: string | null;
  overdue: boolean;
}

export interface CompanyRegistrationsResult {
  items: CompanyRegistrationItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; complements: number; approved: number; rejected: number; overdue: number };
  // The overdue threshold applied, in days (the /admin/parametres setting).
  overdueDays: number;
}

export function listCompanyRegistrations(params: {
  entityType?: string;
  region?: string;
  from?: string;
  to?: string;
  search?: string;
  /** A UserStatus, or "ALL" to lift the default queue filter (pending + complements). */
  status?: string;
  /** Only files registered by this admin (User.createdBy). */
  createdBy?: string;
  /** Only files left waiting past the overdue threshold (/admin/parametres); overrides `status`. */
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.region) query.set("region", params.region);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.createdBy) query.set("createdBy", params.createdBy);
  if (params.overdue) query.set("overdue", "true");
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<CompanyRegistrationsResult>(`/auth/company-registrations${qs ? `?${qs}` : ""}`);
}

/**
 * The corrections a company may send with a resubmission.
 *
 * Mirrors ResubmitRegistrationDto field for field. The route validates with
 * forbidNonWhitelisted, so an extra key is a 400 — which is why callers must
 * build this object explicitly and never spread a CompanyProfile into it:
 * CompanyProfile has an index signature and would carry unknown keys along.
 */
export interface RegistrationCorrections {
  name?: string;
  taxNumber?: string;
  mainActivity?: string;
  secondaryActivity?: string;
  parentCompany?: string;
  address?: string;
  phone?: string;
  cnpsNumber?: string;
  fax?: string;
  socialCapital?: number;
  // User.email: the login identifier and the entity's ONEFOP contact.
  email?: string;
  entityType?: string;
  region?: string;
  department?: string;
  subdivision?: string;
}

// No argument, or an empty object, is a resubmission with no corrections:
// the status flip alone, which stays allowed.
export function resubmitRegistration(data?: RegistrationCorrections) {
  return apiFetch(`/auth/resubmit-registration`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
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

// PATCH /auth/users/:id/territory — role + region + department in one write,
// audited server-side as USER_TERRITORY_CHANGED. SUPER_ADMIN and
// ADMIN_ONEFOP (D1); the server applies assertCanManageRole to both the
// current and the new role, refuses self-reassignment, and requires a region
// for REGIONAL_ADMIN and a region + department for DIVISIONAL_ADMIN. Blank values are
// omitted so they are stored as null, not "".
export function updateUserTerritory(id: string, body: { role: string; region?: string; department?: string }) {
  return apiFetch<DirectoryUser>(`/auth/users/${id}/territory`, {
    method: "PATCH",
    body: JSON.stringify({
      role: body.role,
      region: body.region || undefined,
      department: body.department || undefined,
    }),
  });
}

export interface CreateMinefopUserBody {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  region?: string;
  department?: string;
  matricule?: string;
  poste?: string;
}

// POST /auth/admin/create-minefop-user — creates an ACTIVE account with
// mustChangePassword set, skipping approval. SUPER_ADMIN and
// ADMIN_ONEFOP (D1). The temporary password is returned once, in
// plaintext, and never again: show it to the admin, never store it.
export function createMinefopUser(body: CreateMinefopUserBody) {
  return apiFetch<{ user: DirectoryUser; temporaryPassword: string }>("/auth/admin/create-minefop-user", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { TERRITORIAL_ROLES, ADMIN_ROLES as ASSIGNABLE_ROLES } from "./roles";

const ROLE_LABELS: Record<UiLocale, Record<string, string>> = {
  fr: {
    SUPER_ADMIN: "Super administrateur",
    ADMIN_ONEFOP: "Admin ONEFOP",
    REGIONAL_ADMIN: "Régional",
    DIVISIONAL_ADMIN: "Divisionnaire",
    AUDITOR: "Auditeur",
    CENTRAL_AGENT: "Agent central",
    COMPANY: "Entreprise",
  },
  en: {
    SUPER_ADMIN: "Super administrator",
    ADMIN_ONEFOP: "ONEFOP administrator",
    REGIONAL_ADMIN: "Regional",
    DIVISIONAL_ADMIN: "Departmental",
    AUDITOR: "Auditor",
    CENTRAL_AGENT: "Central officer",
    COMPANY: "Company",
  },
};

export function directoryRoleLabel(role: string, locale: UiLocale = "fr"): string {
  return ROLE_LABELS[locale][role] ?? role.replace(/_/g, " ");
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "var(--cam-green-dark)",
  ADMIN_ONEFOP: "var(--cam-green)",
  REGIONAL_ADMIN: "var(--cam-info)",
  DIVISIONAL_ADMIN: "var(--cam-info)",
  AUDITOR: "var(--cam-warning)",
  CENTRAL_AGENT: "var(--cam-info)",
  COMPANY: "var(--cam-green)",
};

export function directoryRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? "var(--cam-green)";
}

export function directoryUserName(u: DirectoryUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
}

export type StatusFilterKey = "all" | "pending" | "active" | "suspended" | "rejected";

export const STATUS_FILTERS: { key: StatusFilterKey; label: string; labelEn: string; color: string; status?: string; isActive?: boolean }[] = [
  { key: "all", label: "Tous", labelEn: "All", color: "var(--cam-green)" },
  { key: "pending", label: "En attente", labelEn: "Pending", color: "var(--cam-warning)", status: "PENDING_APPROVAL" },
  { key: "active", label: "Actifs", labelEn: "Active", color: "var(--cam-success)", status: undefined, isActive: true },
  { key: "suspended", label: "Suspendus", labelEn: "Suspended", color: "var(--cam-error)", isActive: false },
  { key: "rejected", label: "Rejetés", labelEn: "Rejected", color: "var(--cam-text-muted)", status: "REJECTED" },
];

export function rowStatusMeta(u: DirectoryUser, locale: UiLocale = "fr"): { label: string; color: string } {
  const en = locale === "en";
  if (u.status === "PENDING_APPROVAL") return { label: en ? "Pending" : "En attente", color: "var(--cam-warning)" };
  if (u.status === "REJECTED") return { label: en ? "Rejected" : "Rejeté", color: "var(--cam-text-muted)" };
  return u.isActive
    ? { label: en ? "Active" : "Actif", color: "var(--cam-success)" }
    : { label: en ? "Suspended" : "Suspendu", color: "var(--cam-error)" };
}
