// About: what the platform is for, where the collection has come from, how it
// is being modernised, and what phase 1 has actually delivered.
import { PortalAbout } from "@/components/landing/portal/PortalAbout";
import { PortalTransformation } from "@/components/landing/portal/PortalTransformation";
import { PortalProgress } from "@/components/landing/portal/PortalProgress";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navAbout", "aboutBody");

export default function PortalAboutPage() {
  return (
    <>
      <PortalAbout />
      <PortalTransformation />
      <PortalProgress />
    </>
  );
}
