import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Each portal route has its own browser title, in the visitor's language: the
// locale comes from the NEXT_LOCALE cookie or the browser (src/i18n/request.ts),
// so it is resolved per request rather than exported as static metadata.
//
// "Accueil · CAMLEAP": the view first, the platform second, so a strip of
// several open views stays readable. The platform's name is CAMLEAP, one word
// (docs/standards/brand.md) — never CAM-LEAP.
export async function portalMetadata(
  navKey: string,
  descriptionKey: string,
): Promise<Metadata> {
  const t = await getTranslations("portalPage");
  return {
    title: `${t(navKey)} · CAMLEAP`,
    description: t(descriptionKey),
  };
}
