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

/**
 * Levels an actor may invite to. Both administrator roles reach all three:
 * a central post gives CENTRAL_AGENT (read-only), which ADMIN_ONEFOP
 * manages. Making someone an ADMIN_ONEFOP is a separate, SUPER_ADMIN-only
 * choice -- see canGrantAdminOnefop.
 */
export function invitationLevelsFor(actorRole: string | null | undefined): InvitationLevel[] {
  if (actorRole === "SUPER_ADMIN" || actorRole === "ADMIN_ONEFOP") return [...INVITATION_LEVELS];
  return [];
}

/** Only a SUPER_ADMIN, and only on a central post, may grant ADMIN_ONEFOP. */
export function canGrantAdminOnefop(actorRole: string | null | undefined, level: InvitationLevel | null): boolean {
  return actorRole === "SUPER_ADMIN" && level === "central";
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
  // SUPER_ADMIN, central post: the invitee becomes ADMIN_ONEFOP rather than
  // CENTRAL_AGENT. The server refuses it from anyone else or elsewhere.
  grantAdminOnefop?: boolean;
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

// ── Group links (backend: src/auth/staff-invitation-link.service.ts) ─────
//
// One link for a group of staff, posted in a WhatsApp group. Each person
// picks their service and post within the link's scope; the account waits
// for approval. The token is shown once, at creation: only its hash is
// stored, so a lost link is replaced, not recovered.

export type GroupLinkState = "active" | "expired" | "revoked" | "full";

export interface GroupLink {
  id: string;
  label: string;
  level: InvitationLevel;
  role: string | null;
  region: string | null;
  department: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  state: GroupLinkState;
  createdByName?: string | null;
}

export const GROUP_LINK_DEFAULT_DAYS = 7;
export const GROUP_LINK_MAX_DAYS = 30;
export const GROUP_LINK_DEFAULT_USES = 50;
export const GROUP_LINK_MAX_USES = 200;

export interface CreateGroupLinkBody {
  label: string;
  level: InvitationLevel;
  region?: string;
  department?: string;
  expiresInDays?: number;
  maxUses?: number;
}

export function createGroupLink(body: CreateGroupLinkBody) {
  return apiFetch<GroupLink & { token: string }>("/auth/admin/staff-invitation-links", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listGroupLinks() {
  return apiFetch<GroupLink[]>("/auth/admin/staff-invitation-links");
}

export function revokeGroupLink(id: string) {
  return apiFetch<GroupLink>(`/auth/admin/staff-invitation-links/${encodeURIComponent(id)}/revoke`, { method: "PATCH" });
}

export interface GroupLinkPreview {
  label: string;
  level: InvitationLevel;
  role: string;
  region: string | null;
  department: string | null;
  expiresAt: string;
}

export function previewGroupLink(token: string) {
  return apiFetch<GroupLinkPreview>("/auth/staff-invitation-links/preview", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export interface GroupSignUpBody {
  token: string;
  email: string;
  serviceCode: string;
  positionType: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  password: string;
}

export function signUpWithGroupLink(body: GroupSignUpBody) {
  return apiFetch<{ email: string; status: "PENDING_APPROVAL" }>("/auth/staff-invitation-links/sign-up", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** The group link: same page as the one-person link, with ?lien= instead. */
export function groupLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${INVITATION_PAGE_PATH}?lien=${encodeURIComponent(token)}`;
}

/** The message posted in the group. */
export function groupLinkMessage(link: GroupLink, url: string, locale: UiLocale): string {
  const expires = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(link.expiresAt));
  const where = territoryPhrase(link.region, link.department);
  if (locale === "en") {
    return (
      `CAM-LEAP account creation — ${link.label}${where ? `, ${where}` : ""}.` +
      ` Open this link, choose your service and post and set your password; an administrator will then validate your account.` +
      ` Valid until ${expires}:\n${url}`
    );
  }
  return (
    `Création de compte CAM-LEAP — ${link.label}${where ? `, ${where}` : ""}.` +
    ` Ouvrez ce lien, choisissez votre service et votre poste, puis votre mot de passe ; un administrateur validera ensuite votre compte.` +
    ` Valable jusqu'au ${expires} :\n${url}`
  );
}
