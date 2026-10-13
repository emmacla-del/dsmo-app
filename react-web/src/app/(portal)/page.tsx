// Home: what CAMLEAP is, what phase 1 does, and how declaring works.
//
// The task itself is one route away (/declarer) rather than halfway down this
// page: the nav carries it, so the home view can open on the programme
// without a declarant under a deadline having to scroll past it.
import { PortalHero } from "@/components/landing/portal/PortalHero";
import { PortalStatusBand } from "@/components/landing/portal/PortalStatusBand";
import { PortalJourney } from "@/components/landing/portal/PortalJourney";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navHome", "lede");

export default function PortalHomePage() {
  return (
    <>
      <PortalHero />
      <PortalStatusBand />
      <PortalJourney />
    </>
  );
}
