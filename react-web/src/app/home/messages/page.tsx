"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  getCachedUser,
  markNotificationRead,
  type UserNotification,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { myNotificationsQueryOptions, unreadNotificationCountQueryOptions } from "@/lib/shared-queries";
import { formatDoualaDate } from "@/lib/douala-date";
import { stamp } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

export default function HomeMessagesPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);

  const notificationsQuery = useQuery({
    ...myNotificationsQueryOptions,
    enabled: !!authUser,
  });

  const [activeTab, setActiveTab] = useState<"ALL" | "UNREAD">("ALL");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const notifications = useMemo(() => {
    return notificationsQuery.data ?? [];
  }, [notificationsQuery.data]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "UNREAD") {
      return notifications.filter((n) => !n.readAt);
    }
    return notifications;
  }, [notifications, activeTab]);

  async function handleMarkRead(notification: UserNotification) {
    if (notification.readAt) return;
    setMarkingId(notification.id);
    try {
      await markNotificationRead(notification.id);
      queryClient.setQueryData<UserNotification[]>(
        myNotificationsQueryOptions.queryKey,
        (old) =>
          old
            ? old.map((n) =>
                n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
              )
            : []
      );
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryOptions.queryKey });
    } catch {
      // Best effort
    } finally {
      setMarkingId(null);
    }
  }

  function formatMessageDate(dateStr: string): string {
    const formatted = formatDoualaDate(dateStr);
    if (formatted) return formatted;
    return stamp(dateStr, true, asUiLocale(locale));
  }

  return (
    <div className="cam-home-page">
      <header className="cam-home-head">
        <div>
          <h1 className="cam-home-title">{t("homeMessagesPage.pageTitle")}</h1>
          <p className="cam-home-lede">{t("homeMessagesPage.pageSubtitle")}</p>
        </div>
      </header>

      <div className="cam-home-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
          className="cam-home-tab"
        >
          {t("homeMessagesPage.tabAll", { count: notifications.length })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "UNREAD"}
          onClick={() => setActiveTab("UNREAD")}
          className="cam-home-tab"
        >
          {t("homeMessagesPage.tabUnread", { count: unreadCount })}
        </button>
      </div>

      {notificationsQuery.isLoading && <p className="cam-home-state">{t("common.loading")}</p>}

      {notificationsQuery.isError && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">
          <span>{(notificationsQuery.error as Error).message}</span>
        </div>
      )}

      {!notificationsQuery.isLoading && filteredNotifications.length === 0 && (
        <p className="cam-home-state">
          {activeTab === "UNREAD" ? t("homeMessagesPage.emptyUnread") : t("homeMessagesPage.emptyAll")}
        </p>
      )}

      {!notificationsQuery.isLoading && filteredNotifications.length > 0 && (
        <ul className="cam-home-list">
          {filteredNotifications.map((item) => {
            const isUnread = !item.readAt;
            return (
              <li
                key={item.id}
                className={`cam-home-row cam-home-row--stacked${isUnread ? " is-clickable" : ""}`}
                onClick={() => {
                  if (isUnread) handleMarkRead(item);
                }}
              >
                <div className="cam-home-section-head">
                  <h2 className={`cam-home-row-title${isUnread ? " is-unread" : ""}`}>
                    {isUnread && (
                      <span className="cam-badge cam-badge-success">
                        {t("homeMessagesPage.unreadBadge")}
                      </span>
                    )}
                    {item.subject}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
                    <time dateTime={item.createdAt} className="cam-home-meta">
                      {formatMessageDate(item.createdAt)}
                    </time>
                    {isUnread && (
                      <button
                        type="button"
                        disabled={markingId === item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(item);
                        }}
                        className="cam-text-button"
                      >
                        {t("homeMessagesPage.markAsRead")}
                      </button>
                    )}
                  </div>
                </div>

                <p className="cam-home-body">{item.body}</p>

                {item.linkHref && (
                  <div>
                    <Link href={item.linkHref} className="cam-home-link">
                      {t("homeMessagesPage.viewDetails")}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
