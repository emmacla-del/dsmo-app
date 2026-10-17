// Le programme: why, the two pillars, the three phases, for whom.
import { ProgrammeView } from "@/components/landing/site/ProgrammeView";
import { siteMetadata } from "@/components/landing/site/site-metadata";

export const generateMetadata = () => siteMetadata("progTitle", "progLede");

export default function PortalProgrammePage() {
  return <ProgrammeView />;
}
