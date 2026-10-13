// Declare: the routes into the collection, what each one needs, and the
// questions people ask before taking one.
import { PortalDeclare } from "@/components/landing/portal/PortalDeclare";
import { PortalNotices } from "@/components/landing/portal/PortalNotices";
import { PortalFaq } from "@/components/landing/portal/PortalFaq";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navDeclare", "doorsIntro");

export default function PortalDeclarePage() {
  return (
    <>
      <PortalDeclare />
      <PortalNotices />
      <PortalFaq />
    </>
  );
}
