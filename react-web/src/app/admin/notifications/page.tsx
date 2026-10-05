"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import {
  NOTIFICATIONS_QUERY_KEY,
  listNotifications,
  markNotificationRead,
  notificationKindLabel,
  type UserNotification,
} from "@/lib/notifications-inbox";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

/**
 * The caller's own notification inbox — Phase 3 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Every authenticated user reads their own notifications, and the server
 * scopes every route to req.user.id, so there is nothing here a role could
 * widen. _routes.ts carries a `hidden` entry for this path with ALL_ROLES:
 * hidden keeps it out of the sidebar and the tab row, so it is still not a
 * nav destination inside a hub, while the entry gives
 * getAllowedRoles("/admin/notifications") a list to return instead of null —
 * an unrecognised role string then fails closed at RequireAdminRole rather
 * than falling through an absent gate.
 */
export default function NotificationsPage() {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "list"],
    queryFn: () => listNotifications({ limit: 50 }),
    enabled: status === "authenticated",
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    // Both the list and the bell badge read from NOTIFICATIONS_QUERY_KEY, so
    // one invalidation drops the badge and dims the row together.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    onError: (e: Error) => setError(e.message),
  });

  function open(notification: UserNotification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.linkHref) router.push(notification.linkHref);
  }

  const items = listQuery.data ?? [];

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Notifications" }]}
        title="Notifications"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      {error && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ margin: "16px 0" }}>
          <span>{error}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {listQuery.isLoading && <p className="cam-admin-lede">Chargement…</p>}
      {listQuery.isError && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">
          Impossible de charger les notifications.
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <p className="cam-admin-lede">Aucune notification.</p>
      )}

      <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
        {items.map((item) => {
          const isRead = !!item.readAt;
          return (
            <li
              key={item.id}
              style={{
                borderBottom: "1px solid var(--cam-border)",
                padding: "16px 0",
                // Read rows are dimmed rather than hidden or re-ordered: the
                // inbox stays stable so a row does not move under the cursor.
                opacity: isRead ? 0.6 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => open(item)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  {!isRead && (
                    <span
                      aria-label="Non lue"
                      style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cam-error)", flexShrink: 0 }}
                    />
                  )}
                  <strong style={{ fontSize: 14 }}>{item.subject}</strong>
                  <span style={{ fontSize: 11, color: "var(--cam-text-muted)" }}>
                    {notificationKindLabel(item.kind)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--cam-text-muted)", marginLeft: "auto" }}>
                    {formatStamp(item.createdAt)}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--cam-text-muted)", whiteSpace: "pre-wrap" }}>
                  {item.body}
                </p>
                {item.linkHref && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cam-green-dark)" }}>Voir</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Date and time, since a nudge's recency is the point of reading it. */
function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
