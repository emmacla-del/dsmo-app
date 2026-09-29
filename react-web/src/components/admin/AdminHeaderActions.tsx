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
    <>
      {activeCampaign && (
        <span className="cam-admin-campaign-pill" title="Campagne de collecte active">
          <span aria-hidden="true" />
          {activeCampaign.name}
        </span>
      )}
      <span className="cam-admin-scope" title="Ressort territorial de votre compte">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {scope}
      </span>
      <span className="cam-admin-flag-circle" role="img" aria-label="Cameroun" title="Cameroun">
        <span style={{ background: "var(--cam-flag-green)" }} />
        <span style={{ background: "var(--cam-flag-red)" }} />
        <span style={{ background: "var(--cam-flag-yellow)" }} />
      </span>
    </>
  );
}
