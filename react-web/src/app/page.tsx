// The front door, served at "/".
//
// Until phase 1 of this work the sign-in form sat here and /login redirected
// back. The form now lives at /login and this route is the portal: the three
// declaration routes first, the programme's phases below them.
//
// The page itself stays a server component; Portal is the client half,
// because the locale switcher and the lockup read from next-intl.
import { Portal } from "@/components/landing/Portal";

export default function LandingPage() {
  return <Portal />;
}
