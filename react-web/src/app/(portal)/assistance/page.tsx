// Support: the one published channel, and the way in.
import { PortalSupport } from "@/components/landing/portal/PortalSupport";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navSupport", "helpBody");

export default function PortalSupportPage() {
  return <PortalSupport />;
}
