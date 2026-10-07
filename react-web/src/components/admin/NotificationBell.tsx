"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { elapsedSince, resolveDataState } from "@/lib/admin-data-state";
import { DataState } from "@/components/admin/DataState";
import { asUiLocale } from "@/lib/register-i18n";
import {
  NOTIFICATIONS_QUERY_KEY,
  listNotifications,
  markNotificationRead,
  unreadNotificationCount,
  type UserNotification,
} from "@/lib/notifications-inbox";

/** Notifications previewed in the panel; the full history is on the page. */
const PANEL_LIMIT = 5;

/**
 * The header bell, its unread badge, and a preview panel — Phase 3 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Replaces the static bell that linked to /admin/activite (alerts about
 * dossiers) with the caller's own inbox. Clicking opens a popover under the
 * icon rather than navigating; /admin/notifications remains the full-history
 * view, reached from "Voir tout".
 *
 * Two queries on deliberately different schedules:
 *
 *  - the unread count polls every 30s, matching AdminLayout's queue badge so
 *    the two header counters refresh on one timer rather than competing ones;
 *  - the preview list is fetched only while the panel is open, so an idle
 *    header does not pull five rows every 30 seconds.
 *
 * Dismissal follows the hand-rolled pattern already used by InfoTooltip
 * (containerRef + Escape + mousedown-outside), with focus returned to the
 * trigger on close, which a popover owes a keyboard user.
 */
export function NotificationBell() {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const t = useTranslations("notificationBell");
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const countQuery = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "unread-count"],
    queryFn: unreadNotificationCount,
    enabled: status === "authenticated",
    refetchInterval: 30000,
  });

  const panelQuery = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "panel", PANEL_LIMIT],
    queryFn: () => listNotifications({ limit: PANEL_LIMIT }),
    // Open-only: the badge poll above is what keeps the header live.
    enabled: status === "authenticated" && open,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  /** Closes the panel and hands focus back to the bell. */
  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // No focus return here: the user clicked elsewhere deliberately, and
        // yanking focus back to the bell would fight that.
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  function openNotification(notification: UserNotification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.linkHref) router.push(notification.linkHref);
  }

  const count = countQuery.data?.count ?? 0;
  const items = panelQuery.data ?? [];
  const label = t("buttonLabel", { count });

  const panelState = resolveDataState({
    isLoading: panelQuery.isLoading,
    isError: panelQuery.isError,
    error: panelQuery.error,
    rowCount: panelQuery.data ? items.length : null,
  });

  return (
    <div ref={containerRef} className="cam-admin-bell">
      <button
        ref={buttonRef}
        type="button"
        className="cam-admin-icon-button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Hidden at zero: a badge reading "0" is noise. The panel still
            opens and reports the empty state. */}
        {count > 0 && (
          <span className="cam-admin-bell-badge" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label={t("title")} className="cam-admin-bell-panel">
          <div className="cam-admin-bell-head">{t("title")}</div>

          <div className="cam-admin-bell-body">
            {panelState !== "ready" ? (
              <DataState
                dense
                state={panelState}
                resource={t("title")}
                error={panelQuery.error}
                onRetry={() => panelQuery.refetch()}
                title={
                  panelState === "loading"
                    ? tCommon("loading")
                    : panelState === "error"
                      ? t("loadError")
                      : panelState === "empty"
                        ? t("empty")
                        : undefined
                }
              />
            ) : (
              // The same timeline as /admin/notifications. Read rows stay in
              // place, muted and without the dot, so the panel does not
              // reshuffle under the cursor after a click.
              <ol className="cam-dash-timeline">
                {items.map((item) => {
                  const isRead = !!item.readAt;
                  return (
                    <li key={item.id}>
                      <span className="cam-dash-timeline-time">{elapsedSince(item.createdAt, locale)}</span>
                      {isRead ? (
                        <span className="cam-dash-timeline-dot" aria-hidden="true" style={{ visibility: "hidden" }} />
                      ) : (
                        <span className="cam-dash-timeline-dot cam-dash-timeline-dot--error" role="img" aria-label={t("unreadAriaLabel")} />
                      )}
                      <span className={`cam-dash-timeline-body${isRead ? " cam-admin-muted" : ""}`} style={{ minWidth: 0 }}>
                        <button type="button" className="cam-text-button" onClick={() => openNotification(item)}>
                          {item.subject}
                        </button>
                        {/* One line, clipped — the full body is on the page. */}
                        <span
                          className="cam-admin-meta"
                          style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {item.body}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="cam-admin-bell-foot">
            <Link href="/admin/notifications" onClick={close} className="cam-text-button">
              {t("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
