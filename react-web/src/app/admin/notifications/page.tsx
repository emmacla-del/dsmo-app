"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { asUiLocale } from "@/lib/register-i18n";
import {
  NOTIFICATIONS_QUERY_KEY,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/lib/notifications-inbox";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataState } from "@/components/admin/DataState";
import { resolveDataState } from "@/lib/admin-data-state";
import { doualaIsoDate } from "@/lib/douala-date";
import { hrefWith } from "@/lib/admin-url";
import { ViewSwitch } from "@/components/admin/ViewSwitch";

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
  return (
    <Suspense fallback={null}>
      <NotificationsInbox />
    </Suspense>
  );
}

// Kinds the server sends today (notifications-inbox.ts). An unknown kind gets
// no tag rather than its stored code.
const KNOWN_KINDS = new Set(["NUDGE", "ASSIGNMENT", "APPROVAL", "REJECTION"]);

function NotificationsInbox() {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("notificationBell");
  const tPage = useTranslations("adminNotificationsPage");
  const locale = asUiLocale(useLocale());
  const [error, setError] = useState<string | null>(null);
  // "Today" is read once when the inbox opens, not on every render.
  const [openedAt] = useState(() => Date.now());
  const unreadOnly = searchParams.get("vue") === "non-lues";

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

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
    onError: (e: Error) => setError(e.message),
  });

  function open(notification: UserNotification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.linkHref) router.push(notification.linkHref);
  }

  const allItems = listQuery.data ?? [];
  const unreadCount = allItems.filter((item) => !item.readAt).length;
  const items = unreadOnly ? allItems.filter((item) => !item.readAt) : allItems;
  const title = tRoot("adminNav.routes.notifications");

  const listState = resolveDataState({
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    rowCount: listQuery.data ? items.length : null,
  });

  // Grouped by Cameroon calendar day, newest first (the server's order).
  const today = doualaIsoDate(new Date(openedAt));
  const yesterday = doualaIsoDate(new Date(openedAt - 86_400_000));
  const dayFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" });
  const timeFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });
  const groups: { day: string; label: string; items: UserNotification[] }[] = [];
  for (const item of items) {
    const day = doualaIsoDate(item.createdAt) ?? "";
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      const label = day === today ? tPage("today") : day === yesterday ? tPage("yesterday") : dayFormat.format(new Date(item.createdAt));
      group = { day, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: title }]}
        title={title}
        subtitle={tPage("subtitle")}
        hideTabs={true}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck size={15} aria-hidden="true" />
              {t("markAllRead")}
            </button>
          ) : undefined
        }
      />

      {error && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{error}</span>
          <button
            type="button"
            className="cam-admin-notice-close"
            aria-label={tPage("closeAriaLabel")}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <ViewSwitch
        label={tPage("viewsAriaLabel")}
        items={[
          { key: "all", label: tPage("viewAll", { count: allItems.length }), active: !unreadOnly, href: hrefWith(pathname, searchParams.toString(), { vue: null }) },
          { key: "unread", label: tPage("viewUnread", { count: unreadCount }), active: unreadOnly, href: hrefWith(pathname, searchParams.toString(), { vue: "non-lues" }) },
        ]}
      />

      <section className="cam-notification-inbox" aria-label={title}>
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
                    ? (unreadOnly ? tPage("noUnread") : t("empty"))
                    : undefined
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.day} className="cam-notification-group">
              <h2 className="cam-notification-day">{group.label}</h2>
              {/* Read rows stay in place, muted, with no unread dot: the inbox
                  stays stable so a row does not move under the cursor. */}
              <ol className="cam-notification-list">
                {group.items.map((item) => {
                  const isRead = !!item.readAt;
                  return (
                    <li key={item.id} className={`cam-notification-item${isRead ? " is-read" : ""}`}>
                      <span className="cam-notification-icon" aria-hidden="true"><Bell size={16} /></span>
                      <div className="cam-notification-body">
                        <div className="cam-notification-line">
                          {!isRead && <span className="cam-notification-dot" role="img" aria-label={t("unreadAriaLabel")} />}
                          {/* The subject opens the notification: it marks it read
                              and, when it carries one, follows its link. */}
                          <button type="button" className="cam-notification-subject" onClick={() => open(item)}>
                            {item.subject}
                          </button>
                          {KNOWN_KINDS.has(item.kind) && <span className="cam-badge cam-badge-neutral">{tPage(`kind.${item.kind}`)}</span>}
                        </div>
                        <p className="cam-notification-text">{item.body}</p>
                      </div>
                      <div className="cam-notification-side">
                        <time dateTime={item.createdAt} className="cam-notification-time">{timeFormat.format(new Date(item.createdAt))}</time>
                        {!isRead && (
                          <button
                            type="button"
                            className="cam-text-button cam-notification-mark"
                            disabled={markRead.isPending}
                            onClick={() => markRead.mutate(item.id)}
                          >
                            {tPage("markRead")}
                          </button>
                        )}
                        {isRead && item.linkHref && (
                          <Link href={item.linkHref} className="cam-text-button cam-notification-mark">{tPage("openLink")}</Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
