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

export interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  type?: string | null;
  collectionType?: string;
  startDate?: string | null;
  deadline?: string | null;
  extendedDeadline?: string | null;
  closedAt?: string | null;
  targetRegions?: string[];
  targetDepartments?: string[];
  targetEntityTypes?: string[];
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

export function createCampaign(data: {
  collectionType: "ONEFOP" | "DSMO";
  type: "QUARTERLY" | "ANNUAL" | "SPECIAL";
  startDate: string;
  deadline: string;
  description?: string;
  targetRegions?: string[];
  targetDepartments?: string[];
  targetEntityTypes?: string[];
  autoReminders?: boolean;
}) {
  return apiFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
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

// Mirrors campaign_constants.dart's campaignStatuses/campaignStatusLabels.
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"];
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  PAUSED: "En pause",
  CLOSED: "Clôturée",
  ARCHIVED: "Archivée",
};
export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "var(--cam-warning)",
  ACTIVE: "var(--cam-success)",
  PAUSED: "var(--cam-info)",
  CLOSED: "var(--cam-text-muted)",
  ARCHIVED: "var(--cam-text-muted)",
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

export function formatCampaignDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function canActivate(status: string): boolean {
  return status === "DRAFT" || status === "PAUSED";
}
export function canDeactivate(status: string): boolean {
  return status === "ACTIVE";
}
export function canClose(status: string): boolean {
  return status === "ACTIVE" || status === "PAUSED";
}
export function canExtend(status: string): boolean {
  return status !== "CLOSED" && status !== "ARCHIVED";
}
export function canRemind(status: string): boolean {
  return status === "ACTIVE";
}
