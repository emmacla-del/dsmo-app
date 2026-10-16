import type { MouseEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { LanguageLink } from "@/components/LanguageLink";

// Shared institutional identity block for the CAMLEAP authentication family
// (Register/Forgot Password/agent sign-up): the CAMLEAP logo or text title,
// and optional ONEFOP endorsement. Includes language switcher for bilingual parity across auth flows.
export function AuthHeader({
  wordmarkAs = "div",
  title,
  showEndorsement = true,
  onHomeClick,
}: {
  wordmarkAs?: "h1" | "div";
  title?: string;
  showEndorsement?: boolean;
  // Lets a form with unsaved answers intercept the logo's way home (the
  // registration wizard asks before leaving); call preventDefault to stay.
  onHomeClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useTranslations();
  const Heading = wordmarkAs;

  return (
    <header className="masthead">
      <Link href="/" className="masthead-lockup" aria-label={title || "CAMLEAP"} onClick={onHomeClick}>
        {title ? (
          <Heading className="masthead-title">{title}</Heading>
        ) : (
          <BrandLockup size="compact" nameAs={wordmarkAs} />
        )}
      </Link>
      {showEndorsement && !title && <p className="brand-sub">{t("landingPage.endorsement")}</p>}
      <div className="masthead-locale">
        <LanguageLink />
      </div>
    </header>
  );
}
