import { redirect } from "next/navigation";

// Merged into Le programme (2026-10-14): the roadmap is its "Les phases"
// section. Kept as a redirect so links already shared keep working.
export default function PortalProgrammeRedirect() {
  redirect("/programme");
}
