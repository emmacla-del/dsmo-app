import { redirect } from "next/navigation";

// The sign-in form lives on the landing page at "/". This route is kept so
// that every existing link and redirect to /login still works: the admin
// sign-out, the registration receipt, the password and email pages, and any
// bookmark. The identifier handed over from registration (login-handoff.ts)
// is read by the landing page after this redirect.
export default function LoginPage() {
  redirect("/");
}
