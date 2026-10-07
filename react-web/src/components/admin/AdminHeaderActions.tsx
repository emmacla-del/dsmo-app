"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns } from "@/lib/campaigns";
import { CAMPAIGN_ROLES, hasRole } from "@/lib/roles";
import { NotificationBell } from "./NotificationBell";

import { computeUserScopeLabel } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

/**
 * The active campaign, or undefined when there is none or the user's role
 * cannot read campaigns. Shares its query key with every other caller, so the
 * header and page content trigger a single GET /campaigns?status=ACTIVE.
 */
export function useActiveCampaign() {
  const user = useAuthStore((s) => s.user);
  const canReadCampaigns = hasRole(user?.role, CAMPAIGN_ROLES);
  const query = useQuery({
    queryKey: ["campaigns", "ACTIVE"],
    queryFn: () => listCampaigns("ACTIVE"),
    enabled: canReadCampaigns,
  });
  return { canReadCampaigns, activeCampaign: query.data?.[0], isLoading: query.isLoading };
}

/**
 * Configuration options for right-hand header actions.
 */
export interface AdminHeaderActionsProps {
  showCampaignPill?: boolean;
  showBell?: boolean;
  showSearchInput?: boolean;
}

/**
 * Right-hand chips shared by every admin page header: active campaign pill,
 * the account's territorial scope, and the Cameroon flag.
 */
export function AdminHeaderActions({
  showCampaignPill = true,
  showBell = true,
  showSearchInput = false,
}: AdminHeaderActionsProps = {}) {
  const router = useRouter();
  const t = useTranslations("adminHeaderActions");
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  const { activeCampaign, isLoading: campaignLoading, canReadCampaigns } = useActiveCampaign();

  const scope = computeUserScopeLabel(user, locale);

  const rawCampaignName = activeCampaign?.name || activeCampaign?.code || null;
  const campaignName = (() => {
    if (!rawCampaignName) return null;
    if (activeCampaign?.code) {
      return activeCampaign.code.toLowerCase().includes("campagne") ? activeCampaign.code : t("campaignCode", { code: activeCampaign.code });
    }
    const m = rawCampaignName.match(/(PREMIER|DEUXIEME|TROISIEME|QUATRIEME)\s+TRIMESTRE\s+(\d{4})/i);
    if (m) {
      const qMap: Record<string, number> = { premier: 1, deuxieme: 2, troisieme: 3, quatrieme: 4 };
      return t("campaignQuarter", { year: m[2], quarter: qMap[m[1].toLowerCase()] || 1 });
    }
    if (rawCampaignName.length > 22) {
      return rawCampaignName.slice(0, 20) + "…";
    }
    return rawCampaignName;
  })();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      {/* Campaign pill */}
      {showCampaignPill && canReadCampaigns && (
        <Link
          href="/admin/campagnes"
          className="cam-admin-campaign-pill"
          title={rawCampaignName ?? t("noActiveCampaign")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 9999,
            border: "var(--cam-border-width) solid var(--cam-border)",
            background: "var(--cam-surface)",
            color: "var(--cam-text-muted)",
            fontSize: "var(--cam-font-size-2xs)",
            fontWeight: 500,
            maxWidth: 200,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flexShrink: 0,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <span
            className="cam-admin-campaign-pill-dot"
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: activeCampaign ? "var(--cam-gold)" : "var(--cam-border-strong)",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaignLoading ? tCommon("loading") : activeCampaign ? campaignName : t("noActiveCampaign")}
          </span>
        </Link>
      )}

      {/* Territorial scope, stated. It was a chevroned link to /admin/cibles —
          it looked like a scope selector, and 403'd for AUDITOR. The scope is
          fixed by the account; there is nothing to select. */}
      <span
        className="cam-admin-scope"
        title={t("scopeTitle")}
        style={{
          background: "var(--cam-surface)",
          border: "var(--cam-border-width) solid var(--cam-text)",
          color: "var(--cam-text)",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: "var(--cam-font-size-2xs)",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {t("scopeChip", { scope })}
      </span>

      {/* Notification bell — the caller's own in-app inbox (Phase 3). Opens a
          preview panel; /admin/notifications is the full history. It
          previously linked to /admin/activite, which is dossier alerts, not
          notifications addressed to this user. */}
      {showBell && <NotificationBell />}

      {/* Search element: text input box or compact button */}
      {showSearchInput ? (
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 12, color: "var(--cam-placeholder)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const query = e.currentTarget.value.trim();
                router.push(query ? `/admin/dossiers?q=${encodeURIComponent(query)}` : "/admin/dossiers");
              }
            }}
            style={{
              padding: "6px 14px 6px 34px",
              borderRadius: 9999,
              border: "var(--cam-border-width) solid var(--cam-border)",
              background: "var(--cam-surface-subtle)",
              fontSize: "var(--cam-font-size-xs)",
              color: "var(--cam-text)",
              outline: "none",
              width: 170,
            }}
          />
        </div>
      ) : (
        <Link
          href="/admin/dossiers"
          aria-label={t("searchAriaLabel")}
          title={t("searchTitle")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "none",
            border: "none",
            color: "var(--cam-text-muted)",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      )}

      {/* Cameroon flag circle */}
      <span
        className="cam-admin-flag-circle"
        role="img"
        aria-label={t("flagAriaLabel")}
        title={t("flagTitle")}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          position: "relative",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
          flexShrink: 0,
        }}
      >
        <span style={{ flex: 1, background: "var(--cam-flag-green)" }} />
        <span style={{ flex: 1, background: "var(--cam-flag-red)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--cam-flag-yellow)", fontSize: "var(--cam-font-size-4xs)", lineHeight: 1, position: "absolute" }}>★</span>
        </span>
        <span style={{ flex: 1, background: "var(--cam-flag-yellow)" }} />
      </span>
    </div>
  );
}
