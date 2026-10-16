import { redirect } from "next/navigation";

// The survey's "how to respond" now lives on Assistance (2026-10-14). Kept
// as a redirect so links already shared keep working.
export default function PortalSurveyRedirect() {
  redirect("/assistance#comment");
}
