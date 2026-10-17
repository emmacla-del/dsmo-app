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
    <div style={{ maxWidth: "var(--vt-content-max)", margin: "0 auto", padding: "var(--cam-space-5) var(--cam-space-4)" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "var(--cam-space-5)" }}>
        <h1 style={{ margin: "0 0 var(--cam-space-2)", fontSize: "var(--cam-font-size-2xl)", fontWeight: 700, color: "var(--cam-text)" }}>
          {t("homeMessagesPage.pageTitle")}
        </h1>
        <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {t("homeMessagesPage.pageSubtitle")}
        </p>
      </div>

      {/* Tabs / Filter strip */}
      <div style={{ display: "flex", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-4)", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`cam-button ${activeTab === "ALL" ? "cam-button-primary" : "cam-button-secondary"} cam-button-sm`}
          style={{ borderRadius: "var(--cam-radius-full)", padding: "var(--cam-space-1) var(--cam-space-3)" }}
        >
          {t("homeMessagesPage.tabAll", { count: notifications.length })}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("UNREAD")}
          className={`cam-button ${activeTab === "UNREAD" ? "cam-button-primary" : "cam-button-secondary"} cam-button-sm`}
          style={{ borderRadius: "var(--cam-radius-full)", padding: "var(--cam-space-1) var(--cam-space-3)" }}
        >
          {t("homeMessagesPage.tabUnread", { count: unreadCount })}
        </button>
      </div>

      {/* Loading state */}
      {notificationsQuery.isLoading && (
        <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)", textAlign: "center" }}>
          {t("common.loading")}
        </div>
      )}

      {/* Error state */}
      {notificationsQuery.isError && (
        <div
          role="alert"
          style={{
            padding: "var(--cam-space-4)",
            borderRadius: "var(--cam-radius-md)",
            background: "var(--cam-error-bg)",
            color: "var(--cam-error)",
            fontSize: "var(--cam-font-size-sm)",
            marginBottom: "var(--cam-space-4)",
          }}
        >
          {(notificationsQuery.error as Error).message}
        </div>
      )}

      {/* Empty states */}
      {!notificationsQuery.isLoading && filteredNotifications.length === 0 && (
        <div
          style={{
            background: "var(--cam-surface)",
            border: "var(--cam-border-width) solid var(--cam-border)",
            borderRadius: "var(--cam-radius-lg)",
            padding: "var(--cam-space-8) var(--cam-space-6)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "var(--cam-font-size-3xl)", marginBottom: "var(--cam-space-3)", opacity: 0.7 }}>📭</div>
          <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", maxWidth: "28rem", marginLeft: "auto", marginRight: "auto" }}>
            {activeTab === "UNREAD" ? t("homeMessagesPage.emptyUnread") : t("homeMessagesPage.emptyAll")}
          </p>
        </div>
      )}

      {/* Notifications list */}
      {!notificationsQuery.isLoading && filteredNotifications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
          {filteredNotifications.map((item) => {
            const isUnread = !item.readAt;
            return (
              <article
                key={item.id}
                onClick={() => {
                  if (isUnread) handleMarkRead(item);
                }}
                style={{
                  background: isUnread ? "var(--cam-surface)" : "var(--cam-surface-subtle)",
                  border: "var(--cam-border-width) solid var(--cam-border)",
                  borderLeft: isUnread ? "4px solid var(--cam-primary)" : "4px solid var(--cam-border)",
                  borderRadius: "var(--cam-radius-md)",
                  padding: "var(--cam-space-4) var(--cam-space-5)",
                  boxShadow: isUnread ? "var(--cam-shadow-sm)" : "none",
                  transition: "box-shadow 0.15s ease",
                  cursor: isUnread ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-2)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
                    {isUnread && (
                      <span className="cam-badge cam-badge-success" style={{ fontSize: "var(--cam-font-size-2xs)" }}>
                        {t("homeMessagesPage.unreadBadge")}
                      </span>
                    )}
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "var(--cam-font-size-base)",
                        fontWeight: isUnread ? 700 : 600,
                        color: "var(--cam-text)",
                      }}
                    >
                      {item.subject}
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
                    <time
                      dateTime={item.createdAt}
                      style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}
                    >
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
                        style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-primary)" }}
                      >
                        {t("homeMessagesPage.markAsRead")}
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "var(--cam-font-size-sm)",
                    color: "var(--cam-text)",
                    lineHeight: "var(--cam-line-height-base)",
                    whiteSpace: "pre-line",
                  }}
                >
                  {item.body}
                </div>

                {item.linkHref && (
                  <div style={{ marginTop: "var(--cam-space-3)" }}>
                    <Link
                      href={item.linkHref}
                      className="cam-button cam-button-secondary cam-button-sm"
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}
                    >
                      <span>{t("homeMessagesPage.viewDetails")}</span>
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
