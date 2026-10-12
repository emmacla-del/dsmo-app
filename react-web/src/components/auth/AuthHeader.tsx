import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";

// Shared institutional identity block for the CAMLEAP authentication family
// (Register/Forgot Password/agent sign-up): the ONEFOP | CAMLEAP lockup at
// its compact size, then the platform's full name. These pages are the
// front door, where both marks show (docs/standards/brand.md).
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
      <p className="brand-sub">{t("authShared.subtitle")}</p>
    </header>
  );
}
