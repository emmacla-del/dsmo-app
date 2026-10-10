// src/lib/campaigns.ts
//
// /campaigns* — read directly from src/campaign/campaign.controller.ts +
// campaign.service.ts. These endpoints are the actual production control
// surface for the whole declaration system's availability: activateCampaign
// opens real SubmissionRounds nationally (this is the exact mechanism
// onefop-submission.ts's getActiveQuarter()/submitDeclaration() depend on
// elsewhere in this app), and pause/close/delete close them. Every
// mutating function here is genuinely consequential — treated with the
// same caution as the ONEFOP final-submit action earlier in this
// migration: built and wired, never exercised live without explicit,
// separately-authorized testing.
import { apiFetch } from "./api-client";
import { formatDoualaDate } from "./douala-date";

/**
 * Mirrors the Prisma `CampaignPeriodicity` enum (prisma/schema.prisma).
 * Note there is no `SPECIAL`: the enum migration
 * (20261007120000_rename_campaign_type_and_add_purpose) folded any legacy
 * free-text value — `SPECIAL` included — into `QUARTERLY`.
 */
export type CampaignPeriodicity = "QUARTERLY" | "SEMESTER" | "ANNUAL";

/** Mirrors the Prisma `CampaignPurpose` enum — a distinct axis from periodicity. */
export type CampaignPurpose = "COLLECTION" | "REGISTRATION";

export interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  /** What period the campaign covers. Read it through campaignPeriodicity(). */
  periodicity?: CampaignPeriodicity | null;
  /** What the campaign is for. Absent on a pre-rename backend. */
  purpose?: CampaignPurpose | null;
  /**
   * @deprecated Legacy wire alias for `periodicity`.
   *
   * `DataCampaign.type` was renamed to `periodicity` in the backend;
   * `campaign.service.ts#toCampaignWire()` dual-emits both keys so the three
   * clients (this app, the Flutter admin, the Flutter company workspace) keep
   * working until each has migrated. Never read this directly — use
   * campaignPeriodicity(), which prefers the new key and falls back to this
   * one for a backend deploy that still predates the rename. Delete once the
   * backend drops the alias.
   */
  type?: string | null;
  collectionType?: string;
  startDate?: string | null;
  deadline?: string | null;
  extendedDeadline?: string | null;
  closedAt?: string | null;
  targetRegions?: string[];
  targetDepartments?: string[];
  targetEntityTypes?: string[];
  referenceYear?: number | null;
  referenceQuarter?: number | null;
  /** Embedded by GET /campaigns (CampaignService._buildProgress). */
  progress?: CampaignProgress;
  createdAt: string;
  [key: string]: unknown;
}

// Counts of CampaignSubmission rows by status. Rows are created NOT_STARTED
// at activation (one per targeted establishment) and nothing updates them
// afterwards, so `total` is the targeted count while `submitted` and
// `completionRate` stay at 0 — see docs/deferred.md.
export interface CampaignProgress {
  total: number;
  submitted: number;
  notStarted: number;
  inProgress: number;
  completionRate: string;
  byStatus: Record<string, number>;
}

export interface CampaignReminderEntry {
  id: string;
  sentAt: string;
  reminderType: string;
  recipientCount: number;
  failedCount: number;
  subject?: string | null;
}

/** GET /campaigns/:id — the campaign plus its creator and last 10 reminders. */
export interface CampaignDetail extends Campaign {
  creator?: { firstName: string | null; lastName: string | null; email: string } | null;
  reminders?: CampaignReminderEntry[];
}

export function listCampaigns(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Campaign[]>(`/campaigns${qs}`);
}

export function getCampaign(id: string) {
  return apiFetch<CampaignDetail>(`/campaigns/${id}`);
}

export interface CreateCampaignInput {
  collectionType: "ONEFOP" | "DSMO";
  periodicity: CampaignPeriodicity;
  purpose?: CampaignPurpose;
  startDate: string;
  deadline: string;
  description?: string;
  targetRegions?: string[];
  targetDepartments?: string[];
  targetEntityTypes?: string[];
  autoReminders?: boolean;
  referenceYear?: number;
  referenceQuarter?: number;
}

/**
 * The POST /campaigns body.
 *
 * `createCampaign` on the backend reads `data.periodicity ?? data.type`, so
 * the new key alone is enough there — but a deploy that still predates the
 * rename reads only `data.type`, and silently falls back to `QUARTERLY` when
 * it is missing. Sending both keys with the same value means the stored
 * periodicity is correct against either backend. Drop `type` here in the same
 * release that drops the response alias.
 */
export function buildCreateCampaignPayload(
  data: CreateCampaignInput,
): CreateCampaignInput & { type: CampaignPeriodicity } {
  return { ...data, type: data.periodicity };
}

export function createCampaign(data: CreateCampaignInput) {
  return apiFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(buildCreateCampaignPayload(data)),
  });
}

export function activateCampaign(id: string) {
  return apiFetch<Campaign>(`/campaigns/${id}/activate`, { method: "POST" });
}

export function pauseCampaign(id: string) {
  return apiFetch<Campaign>(`/campaigns/${id}/pause`, { method: "POST" });
}

export function closeCampaign(id: string) {
  return apiFetch<Campaign>(`/campaigns/${id}/close`, { method: "POST" });
}

export function extendCampaignDeadline(id: string, newDeadline: string) {
  return apiFetch<Campaign>(`/campaigns/${id}/extend`, {
    method: "POST",
    body: JSON.stringify({ newDeadline }),
  });
}

export function sendCampaignReminder(id: string, type: string) {
  return apiFetch(`/campaigns/${id}/remind`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export function deleteCampaign(id: string) {
  return apiFetch(`/campaigns/${id}`, { method: "DELETE" });
}

export function archiveCampaign(id: string) {
  return apiFetch<Campaign>(`/campaigns/${id}/archive`, { method: "POST" });
}

export const CAMPAIGN_PERIODICITIES: CampaignPeriodicity[] = ["QUARTERLY", "SEMESTER", "ANNUAL"];
export const CAMPAIGN_PERIODICITY_LABELS: Record<CampaignPeriodicity, string> = {
  QUARTERLY: "Trimestrielle",
  SEMESTER: "Semestrielle",
  ANNUAL: "Annuelle",
};

export const CAMPAIGN_PURPOSE_LABELS: Record<CampaignPurpose, string> = {
  COLLECTION: "Collecte",
  REGISTRATION: "Inscription",
};

/**
 * The campaign's periodicity, preferring the renamed field and falling back to
 * the legacy `type` alias. Returns null when neither is set — a campaign row
 * may legitimately carry a null periodicity, which the backend passes through
 * rather than inventing a value.
 */
export function campaignPeriodicity(
  c: Pick<Campaign, "periodicity" | "type">,
): CampaignPeriodicity | null {
  const raw = c.periodicity ?? c.type ?? null;
  if (raw === null) return null;
  return CAMPAIGN_PERIODICITIES.includes(raw as CampaignPeriodicity)
    ? (raw as CampaignPeriodicity)
    : null;
}

/** The periodicity as a French label, or null when the campaign has none. */
export function campaignPeriodicityLabel(
  c: Pick<Campaign, "periodicity" | "type">,
): string | null {
  const value = campaignPeriodicity(c);
  return value === null ? null : CAMPAIGN_PERIODICITY_LABELS[value];
}

// Mirrors campaign_constants.dart's campaignStatusLabels.
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  PAUSED: "En pause",
  CLOSED: "Clôturée",
  ARCHIVED: "Archivée",
};

// Reminder types an admin can manually trigger — CAMPAIGN_EXPIRED excluded,
// matching campaign_constants.dart's reminderTypes exactly (it's only ever
// sent automatically by the deadline scheduler).
export const REMINDER_TYPES: { value: string; label: string }[] = [
  { value: "CAMPAIGN_ANNOUNCEMENT", label: "Annonce de campagne" },
  { value: "DEADLINE_APPROACHING", label: "Échéance approchante" },
  { value: "FINAL_REMINDER", label: "Dernier rappel" },
  { value: "DEADLINE_EXTENDED", label: "Prorogation" },
];

/**
 * dd/MM/yyyy of the campaign date's Cameroon (Africa/Douala) calendar day,
 * whatever the viewer's own time zone: 2026-09-30T23:00:00Z is 01/10/2026.
 */
export function formatCampaignDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDoualaDate(iso) ?? String(iso);
}

/**
 * A registration campaign is a target container: it stays DRAFT for life and
 * the backend refuses activate / extend / pause / remind on it (8a-BE). Lists
 * show REGISTRATION_STATUS_LABEL in place of "Brouillon" and offer only
 * delete — no lifecycle actions, no archive.
 */
export function isRegistrationCampaign(c: Pick<Campaign, "purpose">): boolean {
  return c.purpose === "REGISTRATION";
}
export const REGISTRATION_STATUS_LABEL = "Cible";

export function canActivate(status: string): boolean {
  return status === "DRAFT" || status === "PAUSED";
}
export function canArchive(status: string): boolean {
  return status !== "DRAFT" && status !== "ARCHIVED";
}
export function canDelete(status: string): boolean {
  return status === "DRAFT";
}

// Readable campaign name for staff screens: the stored names are the official
// all-caps titles. Moved from admin/campagnes so every screen shows the same
// wording.
export function formatCampaignDisplayName(name: string): string {
  if (!name) return "—";
  if (name.includes("COLLECTE DES DONNEES SUR LES EMPLOIS") || name.includes("SECTEUR MODERNE")) {
    return "Collecte des données sur les emplois (Secteur moderne)";
  }
  if (name.includes("DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE") || name.includes("MAIN D'OEUVRE")) {
    return "Déclaration sur la situation de la main d'œuvre (DSMO)";
  }
  if (name.length > 40 && name === name.toUpperCase()) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}
