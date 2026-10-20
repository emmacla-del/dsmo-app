import { redirect } from "next/navigation";

export default function ParametresRedirectPage() {
  redirect("/home/etablissement?tab=settings");
}
