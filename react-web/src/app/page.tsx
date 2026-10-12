import { redirect } from "next/navigation";

// The front door, served at "/".
//
// Phase 1 of the portal work moved the sign-in form out of here and into
// /login, which until then was only a redirect back to "/". This route keeps
// every existing link working by sending "/" on to the form, so the move
// changes no behaviour on its own.
//
// Phase 2 replaces this redirect with the three-door portal page.
export default function LandingPage() {
  redirect("/login");
}
