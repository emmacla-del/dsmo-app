import { useTranslations } from "next-intl";

// Shared institutional identity block for the CAM-LEAP authentication family
// (Login/Register/Verify Email/Forgot Password), per the locked Figma
// foundation: tricolor accent bar + emblem placeholder + wordmark + subtitle.
//
// `wordmarkAs` controls the heading level of the "CAM-LEAP" wordmark. Login
// has no other page-specific heading, so it renders the wordmark as the
// page's single <h1> (matching its pre-existing structure). Register/Verify
// Email/Forgot Password each already have their own more specific <h1>
// (e.g. "Répondant", "Email vérifié") immediately below this header, so the
// wordmark there renders as a non-heading element to avoid two <h1>s per page.
export function AuthHeader({ wordmarkAs = "div" }: { wordmarkAs?: "h1" | "div" }) {
  const t = useTranslations();
  const Wordmark = wordmarkAs;

  return (
    <header className="masthead">
      <div className="seal" aria-hidden="true">emblem</div>
      <div className="seal-note">{t("authShared.emblemPlaceholder")}</div>
      <Wordmark className="brand-name">{t("authShared.wordmark")}</Wordmark>
      <p className="brand-sub">{t("authShared.subtitle")}</p>
    </header>
  );
}
