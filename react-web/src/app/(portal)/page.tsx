// Accueil: what CAMLEAP is, two paths (register, or read about the
// programme), who responds, and the promise made about their data.
import { HomeView } from "@/components/landing/site/HomeView";
import { siteMetadata } from "@/components/landing/site/site-metadata";
import { CamleapHeroAnimation } from "@/components/landing/site/hero-animation/CamleapHeroAnimation";

export const generateMetadata = () => siteMetadata("homeTitle", "homeLede");

export default function PortalHomePage() {
  return <HomeView visual={<CamleapHeroAnimation />} />;
}
