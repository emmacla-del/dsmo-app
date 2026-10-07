// Staff invitation links (backend: src/auth/staff-invitation.service.ts).
//
// An administrator places the agent in the MINEFOP organigramme -- a service
// and one of its posts -- and gets back a signed token; the link built from
// it is sent over WhatsApp. The agent opens /inscription-agent, sees what
// the invitation fixes (post, service, territory, email), adds their name
// and chooses a password.
//
// Pure helpers live here, with the API calls, so the two screens share one
// definition of the organigramme slices, the link and the WhatsApp message.
import { apiFetch } from "./api-client";
import type { UiLocale } from "./register-i18n";

// ── Organigramme ─────────────────────────────────────────────────────────

/** GET /minefop-services/tree node (MinefopServicesService.getTree). */
export interface OrgServiceNode {
  code: string;
  name: string;
  nameEn: string | null;
  acronym: string | null;
  category: "CENTRALE" | "DECONCENTRE" | "RATTACHE";
  level: number;
  parentCode: string | null;
  roleMapping: string;
  requiresRegion: boolean;
  requiresDepartment: boolean;
  children?: OrgServiceNode[];
}

/** GET /minefop-services/:code/positions row. */
export interface OrgPosition {
  id: string;
  serviceCode: string;
  positionType: string;
  title: string;
  titleEn: string | null;
}

export function getOrganigramme() {
  return apiFetch<OrgServiceNode[]>("/minefop-services/tree");
}

export function getServicePositions(serviceCode: string) {
  return apiFetch<OrgPosition[]>(`/minefop-services/${encodeURIComponent(serviceCode)}/positions`);
}

/**
 * The three places an agent can be invited to. Each is a slice of the
 * organigramme: the two delegations are the DREFOP and DDEFOP subtrees,
 * "central" is every central and attached service.
 */
export type InvitationLevel = "regional" | "departmental" | "central";

export const INVITATION_LEVELS: readonly InvitationLevel[] = ["regional", "departmental", "central"];

/** Levels an actor may invite to: only SUPER_ADMIN reaches central services. */
export function invitationLevelsFor(actorRole: string | null | undefined): InvitationLevel[] {
  if (actorRole === "SUPER_ADMIN") return [...INVITATION_LEVELS];
  if (actorRole === "ADMIN_ONEFOP") return ["regional", "departmental"];
  return [];
}

const LEVEL_ROOT: Record<Exclude<InvitationLevel, "central">, string> = {
  regional: "DREFOP",
  departmental: "DDEFOP",
};

/** One selectable service, already indented for a <select>. */
export interface ServiceOption {
  code: string;
  label: string;
  depth: number;
}

function walk(nodes: OrgServiceNode[], depth: number, locale: UiLocale, out: ServiceOption[]) {
  for (const n of nodes) {
    const name = locale === "en" && n.nameEn ? n.nameEn : n.name;
    out.push({ code: n.code, label: n.acronym && !name.includes(`(${n.acronym})`) ? `${name} (${n.acronym})` : name, depth });
    if (n.children?.length) walk(n.children, depth + 1, locale, out);
  }
}

/**
 * The services of one level, in organigramme order, root first. For a
 * delegation the root itself is included: the délégué's post is on it.
 */
export function servicesForLevel(tree: OrgServiceNode[], level: InvitationLevel, locale: UiLocale): ServiceOption[] {
  const out: ServiceOption[] = [];
  if (level === "central") {
    walk(tree.filter((n) => n.category === "CENTRALE" || n.category === "RATTACHE"), 0, locale, out);
  } else {
    const root = tree.find((n) => n.code === LEVEL_ROOT[level]);
    if (root) walk([root], 0, locale, out);
  }
  return out;
}

/** Territory a level needs, mirroring resolveStaffTerritory on the server. */
export function levelNeedsRegion(level: InvitationLevel): boolean {
  return level !== "central";
}

export function levelNeedsDepartment(level: InvitationLevel): boolean {
  return level === "departmental";
}

/**
 * "Cadre": an agent who holds none of the service's head posts. The seed
 * lists head posts only, so every service also offers this one
 * (GENERIC_POSITION_TYPE on the server).
 */
export const GENERIC_POSITION_TYPE = "STAFF";

// ── API ──────────────────────────────────────────────────────────────────

export interface CreateStaffInvitationBody {
  email: string;
  serviceCode: string;
  positionType: string;
  region?: string;
  department?: string;
}

export interface StaffInvitation {
  token: string;
  expiresAt: string;
  email: string;
  role: string;
  region: string | null;
  department: string | null;
  serviceCode: string;
  serviceName: string;
  positionType: string;
  positionTitle: string;
}

export function createStaffInvitation(body: CreateStaffInvitationBody) {
  return apiFetch<StaffInvitation>("/auth/admin/staff-invitations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface StaffInvitationPreview {
  email: string;
  role: string;
  region: string | null;
  department: string | null;
  serviceCode: string;
  serviceName: string | null;
  positionType: string;
  positionTitle: string;
  expiresAt: string | null;
}

export function previewStaffInvitation(token: string) {
  return apiFetch<StaffInvitationPreview>("/auth/staff-invitations/preview", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export interface AcceptStaffInvitationBody {
  token: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  password: string;
}

export function acceptStaffInvitation(body: AcceptStaffInvitationBody) {
  return apiFetch<{ user: { email: string } }>("/auth/staff-invitations/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── The link and the WhatsApp message ────────────────────────────────────

export const INVITATION_PAGE_PATH = "/inscription-agent";

export function invitationUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${INVITATION_PAGE_PATH}?invitation=${encodeURIComponent(token)}`;
}

/** The territory as one phrase: "Centre", "Mfoundi (Centre)", or "". */
export function territoryPhrase(region: string | null, department: string | null): string {
  if (department && region) return `${department} (${region})`;
  return region ?? "";
}

/**
 * The WhatsApp message the administrator sends. Names the post, so the
 * recipient can tell at a glance that it is meant for them, and the expiry,
 * so a link opened on day four is not a surprise.
 */
export function invitationMessage(inv: StaffInvitation, url: string, locale: UiLocale): string {
  const expires = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(inv.expiresAt));
  const where = territoryPhrase(inv.region, inv.department);
  if (locale === "en") {
    return (
      `Hello, you are invited to create your CAM-LEAP account` +
      ` (${inv.positionTitle}, ${inv.serviceName}${where ? `, ${where}` : ""}).` +
      ` Open this link to set your password. It is valid until ${expires} and works once:\n${url}`
    );
  }
  return (
    `Bonjour, vous êtes invité(e) à créer votre compte CAM-LEAP` +
    ` (${inv.positionTitle}, ${inv.serviceName}${where ? `, ${where}` : ""}).` +
    ` Ouvrez ce lien pour choisir votre mot de passe. Il est valable jusqu'au ${expires} et ne sert qu'une fois :\n${url}`
  );
}

/**
 * A wa.me link that opens WhatsApp with the message ready. With a phone
 * number it opens that chat directly; without one, WhatsApp asks whom to
 * send it to. Cameroonian numbers are accepted as typed: a nine-digit local
 * number gets the 237 country code.
 */
export function whatsappHref(message: string, phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const intl = digits.length === 9 ? `237${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
