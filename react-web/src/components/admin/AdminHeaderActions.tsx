"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns } from "@/lib/campaigns";
import type { UserRole } from "@/lib/user-types";

// Mirrors @Roles on GET /campaigns (campaign.controller.ts).
const CAMPAIGN_READER_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL"];

/**
 * The active campaign, or undefined when there is none or the user's role
 * cannot read campaigns. Shares its query key with every other caller, so the
 * header and page content trigger a single GET /campaigns?status=ACTIVE.
 */
export function useActiveCampaign() {
  const user = useAuthStore((s) => s.user);
  const canReadCampaigns = !!user && CAMPAIGN_READER_ROLES.includes(user.role);
  const query = useQuery({
    queryKey: ["campaigns", "ACTIVE"],
    queryFn: () => listCampaigns("ACTIVE"),
    enabled: canReadCampaigns,
  });
  return { canReadCampaigns, activeCampaign: query.data?.[0], isLoading: query.isLoading };
}

/**
 * Right-hand chips shared by every admin page header: active campaign pill,
 * the account's territorial scope, and the Cameroon flag.
 */
export function AdminHeaderActions() {
  const user = useAuthStore((s) => s.user);
  const { activeCampaign } = useActiveCampaign();

  const scope = user?.department
    ? `Département ${user.department}`
    : user?.region
      ? `Région ${user.region}`
      : "National";

  const rawCampaignName = activeCampaign?.name || activeCampaign?.code || "Campagne 2026-T1";
  const campaignName = (() => {
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
      <span
        className="cam-admin-campaign-pill"
        title={rawCampaignName}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 9999,
          border: "1px solid #d1d5db",
          background: "#ffffff",
          color: "#374151",
          fontSize: 12,
          fontWeight: 500,
          maxWidth: 200,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexShrink: 0,
        }}
      >
        <span className="cam-admin-campaign-pill-dot" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {campaignName}
        </span>
      </span>

      {/* Territory selector */}
      <div
        className="cam-admin-scope"
        title="Ressort territorial"
        style={{
          cursor: "pointer",
          background: "#ffffff",
          border: "1px solid #111827",
          color: "#111827",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>Ressort : {scope}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Notification bell */}
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications et alertes de validation"
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
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#dc2626",
          }}
        />
      </button>

      {/* Search icon */}
      <button
        type="button"
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
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

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
