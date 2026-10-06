import { redirect } from "next/navigation";

// The directory moved into the admin console (/admin/annuaire). This route
// stays so existing links and bookmarks — including the /home shell's own
// nav (role-navigation.ts) — keep working; the tab choice is carried over.
export default async function HomeAnnuaireRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  redirect(tab === "users" || tab === "companies" ? `/admin/annuaire?tab=${tab}` : "/admin/annuaire");
}
