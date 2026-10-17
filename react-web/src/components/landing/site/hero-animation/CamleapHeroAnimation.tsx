// The animated "CAMLEAP · Project journey" in the home hero: six scenes,
// a 33-second CSS-only loop. The SVG stays a raw string, as delivered, and
// its stylesheet is plain global CSS whose selectors are all scoped under
// .camleap-anim, so class and keyframe names reach the markup unchanged.
//
// A server component, so the two 75 KB strings never reach the client
// bundle; HomeView receives it as its `visual` prop.
import { preconnect } from "react-dom";
import { getLocale } from "next-intl/server";
import { camleapHeroSvgEn } from "./camleap-hero-svg.en";
import { camleapHeroSvgFr } from "./camleap-hero-svg.fr";
import "./camleap-hero.css";

// The CSS names these families directly ("DM Sans", "Fraunces", "Caveat"),
// which next/font would rename, so they load from Google Fonts as the
// snippet does. The site loads none of the three elsewhere.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@500;600&display=swap";

export async function CamleapHeroAnimation() {
  const locale = await getLocale();
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });

  return (
    <>
      <link rel="stylesheet" href={FONTS_HREF} precedence="default" />
      <div
        className="camleap-anim"
        dangerouslySetInnerHTML={{
          __html: locale.startsWith("fr") ? camleapHeroSvgFr : camleapHeroSvgEn,
        }}
      />
    </>
  );
}
