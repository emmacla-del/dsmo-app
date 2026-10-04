"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { elapsedSince } from "@/lib/admin-data-state";
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
  const label = count > 0 ? `Notifications (${count} non lue${count > 1 ? "s" : ""})` : "Notifications";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "none",
          border: "none",
          color: "#6b7280",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Hidden at zero: a badge reading "0" is noise. The panel still
            opens and reports the empty state. */}
        {count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 9999,
              background: "var(--cam-error)",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: "16px",
              textAlign: "center",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: 40,
            // Anchored to the bell's right edge: the bell sits near the end of
            // the header row, so a left-anchored panel would overflow.
            right: 0,
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            background: "var(--cam-surface)",
            border: "1px solid var(--cam-border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--cam-border)", fontSize: 13, fontWeight: 700 }}>
            Notifications
          </div>

          {panelQuery.isLoading && (
            <p style={{ margin: 0, padding: "16px 14px", fontSize: 13, color: "var(--cam-text-muted)" }}>Chargement…</p>
          )}
          {panelQuery.isError && (
            <p role="alert" style={{ margin: 0, padding: "16px 14px", fontSize: 13, color: "var(--cam-error)" }}>
              Impossible de charger les notifications.
            </p>
          )}
          {!panelQuery.isLoading && !panelQuery.isError && items.length === 0 && (
            <p style={{ margin: 0, padding: "16px 14px", fontSize: 13, color: "var(--cam-text-muted)" }}>Aucune notification.</p>
          )}

          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" }}>
            {items.map((item) => {
              const isRead = !!item.readAt;
              return (
                <li key={item.id} style={{ borderBottom: "1px solid var(--cam-border)" }}>
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 14px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                      // Read rows dim rather than disappear, so the panel does
                      // not reshuffle under the cursor after a click.
                      opacity: isRead ? 0.6 : 1,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      {!isRead && (
                        <span
                          aria-label="Non lue"
                          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cam-error)", flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{item.subject}</span>
                      <span style={{ fontSize: 11, color: "var(--cam-text-muted)", flexShrink: 0 }}>
                        {elapsedSince(item.createdAt)}
                      </span>
                    </span>
                    {/* One line, clipped — the full body is on the page. */}
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 12,
                        color: "var(--cam-text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.body}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{ padding: "10px 14px", textAlign: "center" }}>
            <Link
              href="/admin/notifications"
              onClick={close}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--cam-green-dark)", textDecoration: "none" }}
            >
              Voir tout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
