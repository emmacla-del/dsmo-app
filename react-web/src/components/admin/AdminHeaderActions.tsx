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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
      {activeCampaign && (
        <span className="cam-admin-campaign-pill" title="Campagne de collecte active">
          <span aria-hidden="true" />
          {activeCampaign.name}
        </span>
      )}

      {/* Territory selector */}
      <div
        className="cam-admin-scope"
        title="Ressort territorial"
        style={{ cursor: "pointer", background: "var(--cam-surface)" }}
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
          color: "var(--cam-text-muted)",
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
            background: "var(--cam-error)",
          }}
        />
      </button>

      {/* Cameroon flag circle */}
      <span className="cam-admin-flag-circle" role="img" aria-label="Cameroun" title="République du Cameroun">
        <span style={{ background: "var(--cam-flag-green)" }} />
        <span style={{ background: "var(--cam-flag-red)" }} />
        <span style={{ background: "var(--cam-flag-yellow)" }} />
      </span>
    </div>
  );
}
