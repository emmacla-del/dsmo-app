// About: why the platform exists, where the collection has come from, and
// what phase 1 has actually delivered.
import { PortalTransformation } from "@/components/landing/portal/PortalTransformation";
import { PortalProgress } from "@/components/landing/portal/PortalProgress";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navAbout", "transformIntro");

export default function PortalAboutPage() {
  return (
    <>
      <PortalTransformation />
      <PortalProgress />
    </>
  );
}
