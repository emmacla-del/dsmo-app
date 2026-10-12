import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";

// Shared institutional identity block for the CAMLEAP authentication family
// (Register/Forgot Password/agent sign-up): the CAMLEAP logo, then ONEFOP
// in words. These pages are the front door, where the endorsement belongs
// (docs/standards/brand.md) -- but this header is one line, with room for
// about 32px of the ONEFOP seal, well under the legibility floor, so the
// endorsement is carried by the words. It also replaces the platform's full
// name, which the wizard header could only show truncated ("Cameroon Labour
// and Employ..."); the name is on the page already, in the rail's lockup on
// a wide screen and in the CAMLEAP logo on a phone.
//
// `wordmarkAs` controls the heading level of the CAMLEAP logo. Login
// has no other page-specific heading, so it renders the wordmark as the
// page's single <h1>. Everywhere else the page has its own more specific
// <h1> -- the wizard's section title (StepHeader), the registration receipt,
// "Email vérifié", the forgot-password title -- so the wordmark there renders
// as a non-heading element to avoid two <h1>s per page.
export function AuthHeader({ wordmarkAs = "div" }: { wordmarkAs?: "h1" | "div" }) {
  const t = useTranslations();

  return (
    <header className="masthead">
      <BrandLockup size="compact" nameAs={wordmarkAs} />
      <p className="brand-sub">{t("landingPage.endorsement")}</p>
    </header>
  );
}
