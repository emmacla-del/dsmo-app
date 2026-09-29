"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// ── Breadcrumb ──────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'Ariane" style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true" style={{ margin: "0 6px" }}>›</span>}
          {item.href
            ? <Link href={item.href} style={{ color: "var(--cam-text-muted)", textDecoration: "none" }}>{item.label}</Link>
            : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ── Status badge (inline, next to title on detail pages) ────────────────────

type StatusVariant = "pending" | "validated" | "rejected" | "correction" | "active" | "neutral";

const STATUS_STYLES: Record<StatusVariant, { bg: string; color: string; dot: string }> = {
  pending:    { bg: "rgba(240,180,41,0.15)",  color: "#92620a",  dot: "#f0b429" },
  validated:  { bg: "rgba(30,107,58,0.12)",   color: "#144a28",  dot: "#1e6b3a" },
  rejected:   { bg: "rgba(179,38,30,0.1)",    color: "#b3261e",  dot: "#b3261e" },
  correction: { bg: "rgba(240,180,41,0.15)",  color: "#92620a",  dot: "#e8a020" },
  active:     { bg: "rgba(30,107,58,0.12)",   color: "#144a28",  dot: "#1e6b3a" },
  neutral:    { bg: "rgba(74,90,80,0.1)",     color: "#4a5a50",  dot: "#4a5a50" },
};

export function AdminStatusBadge({ label, variant }: { label: string; variant: StatusVariant }) {
  const s = STATUS_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px 3px 7px",
        borderRadius: "var(--cam-radius-full)",
        background: s.bg,
        fontSize: "var(--cam-font-size-xs)",
        fontWeight: 600,
        color: s.color,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }}
      />
      {label}
    </span>
  );
}

// ── AdminPageHeader ─────────────────────────────────────────────────────────

export interface AdminPageHeaderProps {
  /** Breadcrumb trail leading up to this page */
  breadcrumb?: BreadcrumbItem[];
  /** Main page title */
  title: ReactNode;
  /** Optional subtitle / description under the title */
  subtitle?: string;
  /** Inline status badge shown next to the title (detail pages) */
  statusBadge?: { label: string; variant: StatusVariant };
  /** Back-navigation href (detail pages — renders ← arrow left of title) */
  backHref?: string;
  /** Right-hand actions (buttons, chips, etc.) */
  actions?: ReactNode;
}

/**
 * Shared page-level header for all admin screens.
 *
 * List pages:  breadcrumb · title + subtitle on left, chips/icons on right.
 * Detail pages: back arrow · title + inline status badge · subtitle on left,
 *               action buttons on right.
 */
export function AdminPageHeader({
  breadcrumb,
  title,
  subtitle,
  statusBadge,
  backHref,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--cam-space-6)",
        paddingBottom: "var(--cam-space-5)",
        borderBottom: "var(--cam-border-width) solid var(--cam-border)",
        marginBottom: "var(--cam-space-5)",
      }}
    >
      {/* ── Left: breadcrumb + title row + subtitle ── */}
      <div style={{ minWidth: 0 }}>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "var(--cam-radius-sm)",
                border: "var(--cam-border-width) solid var(--cam-border-strong)",
                background: "var(--cam-surface)",
                color: "var(--cam-text)",
                textDecoration: "none",
                fontSize: "var(--cam-font-size-base)",
                flexShrink: 0,
              }}
            >
              ←
            </Link>
          )}

          <h1
            style={{
              margin: 0,
              fontSize: "var(--cam-font-size-2xl, 1.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "var(--cam-green-dark)",
            }}
          >
            {title}
          </h1>

          {statusBadge && (
            <AdminStatusBadge label={statusBadge.label} variant={statusBadge.variant} />
          )}
        </div>

        {subtitle && (
          <p
            style={{
              margin: "var(--cam-space-1) 0 0",
              fontSize: "var(--cam-font-size-sm)",
              color: "var(--cam-text-muted)",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Right: actions slot ── */}
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cam-space-2)",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
