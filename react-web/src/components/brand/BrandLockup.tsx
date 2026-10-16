// The front-door lockup: the ONEFOP emblem, a thin rule, the CAMLEAP logo,
// read as one unit. ONEFOP owns the platform; CAMLEAP is the platform
// (docs/standards/brand.md, owner, 2026-10-12). Only the front door — the
// landing page, sign-in and registration — shows both marks; working
// screens show CAMLEAP alone.
//
// `nameAs` sets the element around the CAMLEAP logo, so a page whose only
// heading is the platform's name (sign-in) can make it its <h1>; the image's
// alt text, "CAMLEAP", is then the heading's text.

import { useTranslations } from "next-intl";

export type BrandLockupSize = "hero" | "panel" | "compact";

export function BrandLockup({
  size,
  nameAs: Name = "div",
  emblem = true,
}: {
  size: BrandLockupSize;
  nameAs?: "h1" | "div";
  // False draws CAMLEAP alone, for a place that names ONEFOP in words
  // instead (the registration panel, owner 2026-10-15).
  emblem?: boolean;
}) {
  const t = useTranslations();
  // The emblem is a seal: below --cam-brand-emblem-min its ring lettering is
  // an illegible smear. The compact header is one line with room for about
  // 32px, so it leaves the emblem out and names ONEFOP in words instead
  // (AuthHeader). See docs/standards/brand.md.
  const showEmblem = emblem && size !== "compact";
  return (
    <div className={`cam-brand-lockup cam-brand-lockup--${size}`}>
      {showEmblem && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cam-brand-lockup-emblem"
            src="/images/onefop_logo.png"
            alt={t("landingPage.emblemLabel")}
            width={218}
            height={214}
          />
          <span className="cam-brand-lockup-rule" aria-hidden="true" />
        </>
      )}
      <Name className="cam-brand-lockup-name">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={270} height={38} />
      </Name>
    </div>
  );
}
