// src/lib/inscriptions.ts
//
// POST /auth/admin/register-company — admin-assisted declarant registration.
// Phase 2 of docs/plans/territorial-admin-monitoring.md.
//
// The field-work counterpart to the public /auth/register-company route: a
// territorial admin registers a declarant it met on a visit, over the phone,
// or at the delegation counter. Gated server-side to SUPER_ADMIN,
// ADMIN_ONEFOP, REGIONAL_ADMIN and DIVISIONAL_ADMIN, and additionally narrowed
// to the actor's own ressort — a REGIONAL_ADMIN posting another region's
// territory gets a 403, so the region/department pickers on the form are a
// convenience, not the control.
//
// Two fields the public payload carries are deliberately absent here:
//
//   password — the server generates a temporary one and returns it once, in
//     plaintext. An admin does not choose a declarant's password.
//   role — always COMPANY on this route; the server sets it.
//
// registrationMethod and createdBy are likewise not sendable: the server takes
// both from the authenticated actor. A client cannot claim an attribution it
// does not have.
import { apiFetch } from "./api-client";
import type { DirectoryUser } from "./user-directory";

/**
 * The assisted-registration body: the public RegisterCompanyPayload minus
 * `password` and `role`. Mostly optional because the required set differs per
 * entity type (see ENTITY_CONFIGS in register-constants.ts) — the server's
 * AssistedRegistrationDto is the enforcing copy.
 */
export interface AssistedRegistrationPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName: string;
  address: string;
  region: string;
  department: string;
  subdivision: string;
  regionId?: string;
  departmentId?: string;
  subdivisionId?: string;
  area?: string;
  entityType?: string;
  taxNumber?: string;
  mainActivity?: string;
  parentCompany?: string;
  secondaryActivity?: string;
  cnpsNumber?: string;
  socialCapital?: number;
  legalStatus?: string;
  cooperativeType?: string;
  yearOfCreation?: string;
  ctdType?: string;
  mainMission?: string;
  registrationNumber?: string;
  branch?: string;
  poBox?: string;
  phone?: string;
  phone2?: string;
  sigle?: string;
  cfpType?: string;
  educationSystem?: string;
  functionalStatus?: string;
  nonFunctionalReason?: string;
  nonFunctionalReasonOther?: string;
  promoterName?: string;
  promoterSex?: string;
  promoterPhone1?: string;
  promoterPhone2?: string;
  sectorId?: string;
  respondentFirstName?: string;
  respondentLastName?: string;
  respondentFunction?: string;
  respondentPhone?: string;
  respondentPhone2?: string;
  trainingDomains?: string;
}

export interface AssistedRegistrationResult {
  user: DirectoryUser;
  company: {
    id: string;
    name: string;
    /** Generated at registration for every file; null only for legacy files. */
    establishmentId: string | null;
    taxNumber: string;
    entityType: string | null;
  };
  /**
   * Shown to the acting admin once and never returned again. Outbound email is
   * unreliable on this deployment, so this is the delivery path rather than a
   * fallback: display it, let the admin copy it, never store it.
   */
  temporaryPassword: string;
}

export function adminRegisterCompany(payload: AssistedRegistrationPayload) {
  return apiFetch<AssistedRegistrationResult>("/auth/admin/register-company", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * How an account came into existence, as `User.registrationMethod` stores it.
 * The column is free text server-side; these are the three values Phase 1 and
 * Phase 2 write (DECISION 1 deliberately shipped three rather than five, so a
 * fourth can be added later without a migration).
 */
export const REGISTRATION_METHOD_LABELS: Record<string, string> = {
  SELF_REGISTRATION: "Auto-service",
  ADMIN_CREATED: "Créé par admin",
  ASSISTED: "Assisté",
};

/** The badge label for a method, or null when the account predates tracking. */
export function registrationMethodLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  return REGISTRATION_METHOD_LABELS[method] ?? method;
}

/**
 * Badge colours per method, as design tokens. ASSISTED is the one that marks
 * field work, so it reads in the brand green; auto-service is neutral, because
 * it is the unremarkable majority.
 */
export function registrationMethodTone(method: string | null | undefined): { bg: string; color: string } {
  if (method === "ASSISTED") return { bg: "var(--cam-green-dark)", color: "#ffffff" };
  if (method === "ADMIN_CREATED") return { bg: "var(--cam-info-bg)", color: "var(--cam-info)" };
  return { bg: "var(--cam-surface-subtle)", color: "var(--cam-text-muted)" };
}

/** The two views of /admin/inscriptions: the review queue and registration coverage. */
export type InscriptionsView = "file" | "couverture";

/**
 * URL of an /admin/inscriptions view, built from the current query string.
 *
 * Every other parameter is kept — ?createdBy= (the équipe deep link), ?annee=
 * (the coverage year) — so toggling between the two views never drops an
 * active filter; each view ignores the parameters it does not use. "file" is
 * the default view, so it is expressed by the absence of ?vue=.
 *
 * `changes` sets a parameter (a year) or removes one (null).
 */
export function inscriptionsHref(
  current: string,
  view: InscriptionsView,
  changes: Record<string, string | number | null> = {},
): string {
  const params = new URLSearchParams(current);
  if (view === "couverture") params.set("vue", "couverture");
  else params.delete("vue");
  for (const [key, value] of Object.entries(changes)) {
    if (value == null) params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return `/admin/inscriptions${qs ? `?${qs}` : ""}`;
}
