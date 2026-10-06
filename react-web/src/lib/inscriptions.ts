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
import type { CompanyRegistrationItem, DirectoryUser } from "./user-directory";
import type { UiLocale } from "./register-i18n";

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

const REGISTRATION_METHOD_LABELS_EN: Record<string, string> = {
  SELF_REGISTRATION: "Self-service",
  ADMIN_CREATED: "Created by admin",
  ASSISTED: "Assisted",
};

/** The badge label for a method, or null when the account predates tracking. */
export function registrationMethodLabel(method: string | null | undefined, locale: UiLocale = "fr"): string | null {
  if (!method) return null;
  const labels = locale === "en" ? REGISTRATION_METHOD_LABELS_EN : REGISTRATION_METHOD_LABELS;
  return labels[method] ?? method;
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

// ── Review verification ────────────────────────────────────────────────────
//
// The review dialog lists the entity's identifying values and the reviewer
// marks each one ✓ (conforme) or ✗ (non conforme). The marks are dialog state
// only; approveUser() sends them as four booleans, and the server
// (src/auth/registration-verification.ts) refuses the approval unless every
// row that applies holds a value and is marked strictly true. These helpers
// are the client copy of that rule, so the dialog can say why Confirmer is
// unavailable before the request is made.

/** The entity types with a CNPS row. Mirrors the server's CNPS_REQUIRED_ENTITY_TYPES. */
const CNPS_REVIEW_ENTITY_TYPES: readonly string[] = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "VOCATIONAL_TRAINING"];

export type VerificationKey = "nameVerified" | "phoneVerified" | "contactEmailVerified" | "cnpsVerified";

/** A row's mark. Absent from the marks map = not answered yet, which is neither. */
export type VerificationMark = "ok" | "ko";

export type VerificationMarks = Partial<Record<VerificationKey, VerificationMark>>;

export interface VerificationRow {
  key: VerificationKey;
  label: string;
  /** Trimmed value, or null when the file holds none. */
  value: string | null;
}

// Row labels, and the rows as a sentence subject (worded as the server's
// empty-value refusal), in both console locales.
const ROW_LABELS: Record<UiLocale, Record<VerificationKey, string>> = {
  fr: {
    nameVerified: "Nom de l'entité",
    phoneVerified: "Téléphone / WhatsApp de l'entité",
    contactEmailVerified: "Email de contact",
    cnpsVerified: "N° CNPS",
  },
  en: {
    nameVerified: "Entity name",
    phoneVerified: "Entity phone / WhatsApp",
    contactEmailVerified: "Contact email",
    cnpsVerified: "CNPS No.",
  },
};

const EMPTY_SUBJECTS: Record<UiLocale, Record<VerificationKey, string>> = {
  fr: {
    nameVerified: "le nom de l'entité",
    phoneVerified: "le téléphone / WhatsApp de l'entité",
    contactEmailVerified: "l'email de contact",
    cnpsVerified: "le N° CNPS",
  },
  en: {
    nameVerified: "the entity name",
    phoneVerified: "the entity phone / WhatsApp",
    contactEmailVerified: "the contact email",
    cnpsVerified: "the CNPS No.",
  },
};

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The rows to verify for a file: three for administration and
 * project/programme, four (with N° CNPS) for the five CNPS types. The email is
 * the account email, which is also the entity's contact with ONEFOP.
 */
export function verificationRows(
  item: Pick<CompanyRegistrationItem, "entityType" | "organisation" | "phone" | "email" | "cnpsNumber">,
  locale: UiLocale = "fr",
): VerificationRow[] {
  const labels = ROW_LABELS[locale];
  const rows: VerificationRow[] = [
    { key: "nameVerified", label: labels.nameVerified, value: present(item.organisation) },
    { key: "phoneVerified", label: labels.phoneVerified, value: present(item.phone) },
    { key: "contactEmailVerified", label: labels.contactEmailVerified, value: present(item.email) },
  ];
  if (item.entityType && CNPS_REVIEW_ENTITY_TYPES.includes(item.entityType)) {
    rows.push({ key: "cnpsVerified", label: labels.cnpsVerified, value: present(item.cnpsNumber) });
  }
  return rows;
}

/**
 * Whether the file can be approved from these marks, and if not, the one
 * sentence the dialog shows. In order of what the reviewer must do about it:
 * an empty value needs a correction from the company (no mark can fix it), a
 * ✗ means reject or request complements, an unanswered row means keep
 * checking.
 */
export function approvalGate(
  rows: VerificationRow[],
  marks: VerificationMarks,
  locale: UiLocale = "fr",
): { canApprove: true; message: null } | { canApprove: false; message: string } {
  const en = locale === "en";
  const empty = rows.filter((row) => row.value === null);
  if (empty.length > 0) {
    const subjects = empty.map((row) => EMPTY_SUBJECTS[locale][row.key]);
    const and = en ? "and" : "et";
    const subject = subjects.length === 1 ? subjects[0] : `${subjects.slice(0, -1).join(", ")} ${and} ${subjects[subjects.length - 1]}`;
    const single = subjects.length === 1;
    return {
      canApprove: false,
      message: en
        ? `Cannot approve: ${subject} ${single ? "is empty" : "are empty"}. Request a correction.`
        : `Impossible d'approuver : ${subject} ${single ? "est vide" : "sont vides"}. Demandez une correction.`,
    };
  }
  if (rows.some((row) => marks[row.key] === "ko")) {
    return {
      canApprove: false,
      message: en
        ? "An item is non-compliant: reject the file or request further information."
        : "Une information est non conforme : rejetez le dossier ou demandez des compléments.",
    };
  }
  if (rows.some((row) => marks[row.key] !== "ok")) {
    return {
      canApprove: false,
      message: en
        ? "Mark every item as compliant to approve."
        : "Marquez chaque information comme conforme pour approuver.",
    };
  }
  return { canApprove: true, message: null };
}

/** The approve body's flags: true only for a row marked ✓. */
export function verificationFlags(rows: VerificationRow[], marks: VerificationMarks): Partial<Record<VerificationKey, boolean>> {
  return Object.fromEntries(rows.map((row) => [row.key, marks[row.key] === "ok"]));
}
