// Declare: the three routes into the collection, and what each one needs.
import { PortalDoors } from "@/components/landing/portal/PortalDoors";
import { PortalNotices } from "@/components/landing/portal/PortalNotices";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navDeclare", "doorsIntro");

export default function PortalDeclarePage() {
  return (
    <>
      <PortalDoors />
      <PortalNotices />
    </>
  );
}
