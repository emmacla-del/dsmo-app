"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { asUiLocale } from "@/lib/register-i18n";
import {
  NOTIFICATIONS_QUERY_KEY,
  listNotifications,
  markNotificationRead,
  notificationKindLabel,
  type UserNotification,
} from "@/lib/notifications-inbox";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState } from "@/components/admin/DataState";
import { resolveDataState, stamp } from "@/lib/admin-data-state";

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
  const tRoot = useTranslations();
  const t = useTranslations("notificationBell");
  const locale = asUiLocale(useLocale());
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
  const title = tRoot("adminNav.routes.notifications");

  const listState = resolveDataState({
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    rowCount: listQuery.data ? items.length : null,
  });

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: title }]}
        title={title}
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      {error && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{error}</span>
          <button
            type="button"
            className="cam-admin-notice-close"
            aria-label={tRoot("adminNotificationsPage.closeAriaLabel")}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <section className="cam-admin-section" aria-label={title}>
        <div className="cam-admin-section-body">
          {listState !== "ready" ? (
            <DataState
              state={listState}
              resource={title}
              error={listQuery.error}
              onRetry={() => listQuery.refetch()}
              title={
                listState === "loading"
                  ? tRoot("common.loading")
                  : listState === "error"
                    ? t("loadError")
                    : listState === "empty"
                      ? t("empty")
                      : undefined
              }
            />
          ) : (
            // Read rows stay in place, muted, with no unread dot: the inbox
            // stays stable so a row does not move under the cursor.
            <ol className="cam-dash-timeline">
              {items.map((item) => {
                const isRead = !!item.readAt;
                return (
                  <li key={item.id}>
                    <span className="cam-dash-timeline-time">{stamp(item.createdAt, true, locale)}</span>
                    {isRead ? (
                      <span className="cam-dash-timeline-dot" aria-hidden="true" style={{ visibility: "hidden" }} />
                    ) : (
                      <span className="cam-dash-timeline-dot cam-dash-timeline-dot--error" role="img" aria-label={t("unreadAriaLabel")} />
                    )}
                    <span className={`cam-dash-timeline-body${isRead ? " cam-admin-muted" : ""}`}>
                      {/* The subject opens the notification: it marks it read
                          and, when it carries one, follows its link. */}
                      <button type="button" className="cam-text-button" onClick={() => open(item)}>
                        {item.subject}
                      </button>
                      <span className="cam-admin-meta"> · {notificationKindLabel(item.kind)}</span>
                      <span className="cam-admin-meta" style={{ display: "block", whiteSpace: "pre-wrap" }}>
                        {item.body}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
