import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Each public page has its own browser title in the visitor's language:
// "Le programme · CAMLEAP" — the page first, the platform second.
export async function siteMetadata(titleKey: string, descriptionKey: string): Promise<Metadata> {
  const t = await getTranslations("site");
  return {
    title: `${t(titleKey)} · CAMLEAP`,
    description: t(descriptionKey),
  };
}
