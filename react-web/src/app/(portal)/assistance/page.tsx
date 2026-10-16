// Assistance: who responds, how to respond, FAQ, contacts.
import { HelpView } from "@/components/landing/site/HelpView";
import { siteMetadata } from "@/components/landing/site/site-metadata";

export const generateMetadata = () => siteMetadata("helpTitle", "helpLede");

export default function PortalHelpPage() {
  return <HelpView />;
}
