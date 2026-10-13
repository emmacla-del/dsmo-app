// Roadmap: the four phases, each carrying the state it is actually in.
import { PortalRoadmap } from "@/components/landing/portal/PortalRoadmap";
import { portalMetadata } from "@/components/landing/portal/portal-metadata";

export const generateMetadata = () => portalMetadata("navRoadmap", "roadmapIntro");

export default function PortalRoadmapPage() {
  return <PortalRoadmap />;
}
