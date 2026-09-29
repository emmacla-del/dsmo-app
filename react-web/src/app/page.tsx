import { redirect } from "next/navigation";

// The app boots directly to /login, same as Flutter (see the migration
// plan's "Public / Marketing Pages" note — public/marketing pages are
// dormant and out of scope). Phase 0's proof-of-concept page lived here;
// Phase 1 replaces it with this redirect now that a real login screen
// exists at /login.
export default function RootPage() {
  redirect("/login");
}
