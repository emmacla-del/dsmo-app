"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns } from "@/lib/campaigns";
import { CAMPAIGN_ROLES, hasRole } from "@/lib/roles";
import { NotificationBell } from "./NotificationBell";

import { computeUserScopeLabel } from "@/lib/admin-data-state";

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
  const user = useAuthStore((s) => s.user);
  const { activeCampaign, isLoading: campaignLoading, canReadCampaigns } = useActiveCampaign();

  const scope = computeUserScopeLabel(user);

  const rawCampaignName = activeCampaign?.name || activeCampaign?.code || null;
  const campaignName = (() => {
    if (!rawCampaignName) return null;
    if (activeCampaign?.code) {
      return activeCampaign.code.toLowerCase().includes("campagne") ? activeCampaign.code : `Campagne ${activeCampaign.code}`;
    }
    const m = rawCampaignName.match(/(PREMIER|DEUXIEME|TROISIEME|QUATRIEME)\s+TRIMESTRE\s+(\d{4})/i);
    if (m) {
      const qMap: Record<string, string> = { premier: "T1", deuxieme: "T2", troisieme: "T3", quatrieme: "T4" };
      return `Campagne ${m[2]}-${qMap[m[1].toLowerCase()] || "T1"}`;
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
          title={rawCampaignName ?? "Aucune campagne active"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 9999,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: activeCampaign ? "#374151" : "#6b7280",
            fontSize: 12,
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
              background: activeCampaign ? "#f59e0b" : "#9ca3af",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaignLoading ? "Chargement…" : activeCampaign ? campaignName : "Aucune campagne active"}
          </span>
        </Link>
      )}

      {/* Territorial scope, stated. It was a chevroned link to /admin/cibles —
          it looked like a scope selector, and 403'd for AUDITOR. The scope is
          fixed by the account; there is nothing to select. */}
      <span
        className="cam-admin-scope"
        title="Ressort territorial"
        style={{
          background: "#ffffff",
          border: "1px solid #111827",
          color: "#111827",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        Ressort : {scope}
      </span>

      {/* Notification bell — the caller's own in-app inbox (Phase 3). Opens a
          preview panel; /admin/notifications is the full history. It
          previously linked to /admin/activite, which is dossier alerts, not
          notifications addressed to this user. */}
      {showBell && <NotificationBell />}

      {/* Search element: text input box or compact button */}
      {showSearchInput ? (
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 12, color: "#9ca3af", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const query = e.currentTarget.value.trim();
                router.push(query ? `/admin/dossiers?q=${encodeURIComponent(query)}` : "/admin/dossiers");
              }
            }}
            style={{
              padding: "6px 14px 6px 34px",
              borderRadius: 9999,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontSize: 13,
              color: "#111827",
              outline: "none",
              width: 170,
            }}
          />
        </div>
      ) : (
        <Link
          href="/admin/dossiers"
          aria-label="Recherche"
          title="Rechercher"
          style={{
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
        aria-label="Cameroun"
        title="République du Cameroun"
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
        <span style={{ flex: 1, background: "#007a5e" }} />
        <span style={{ flex: 1, background: "#b3261e", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#f0b429", fontSize: 9, lineHeight: 1, position: "absolute" }}>★</span>
        </span>
        <span style={{ flex: 1, background: "#f0b429" }} />
      </span>
    </div>
  );
}
