// src/lib/notifications-inbox.ts
//
// GET/PATCH /auth/me/notifications* — the caller's own in-app inbox.
// Phase 3 of docs/plans/territorial-admin-monitoring.md.
//
// Not to be confused with the DSMO notification client (the outbound-email
// audit log, per-campaign, still used by Flutter). This is a per-user inbox
// with read state. Email is unreliable on this deployment, so a user is told
// things in-app, when they next log in.
//
// Every route is scoped to the authenticated caller server-side — there is no
// userId parameter to pass or to get wrong. Any authenticated user may read
// their own inbox, company accounts included.
import { apiFetch } from "./api-client";

export interface UserNotification {
  id: string;
  /** 'NUDGE' today; the column is free text so more arrive without migration. */
  kind: string;
  subject: string;
  body: string;
  /** In-app link target, when the notification points somewhere. */
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
}

export function listNotifications(params: { unreadOnly?: boolean; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.unreadOnly) query.set("unreadOnly", "true");
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<UserNotification[]>(`/auth/me/notifications${qs ? `?${qs}` : ""}`);
}

export function unreadNotificationCount() {
  return apiFetch<{ count: number }>("/auth/me/notifications/unread-count");
}

export function markNotificationRead(id: string) {
  return apiFetch<UserNotification>(`/auth/me/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

/** Shared query key, so the bell badge and the page invalidate each other. */
export const NOTIFICATIONS_QUERY_KEY = ["auth", "me", "notifications"] as const;

const KIND_LABELS: Record<string, string> = {
  NUDGE: "Relance",
  ASSIGNMENT: "Affectation",
  APPROVAL: "Validation",
  REJECTION: "Rejet",
};

/** A kind's French label, falling back to the stored value. */
export function notificationKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
