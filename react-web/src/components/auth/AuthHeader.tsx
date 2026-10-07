import { useTranslations } from "next-intl";

// Shared institutional identity block for the CAM-LEAP authentication family
// (Login/Register/Verify Email/Forgot Password): wordmark + subtitle.
//
// The Figma foundation also has a MINEFOP / ONEFOP emblem above the wordmark.
// Until the real artwork exists there is nothing here: the dashed "emblem"
// circle and its "to be added" note were a reminder for the team, and every
// respondent saw them first on the sign-in page.
//
// `wordmarkAs` controls the heading level of the "CAM-LEAP" wordmark. Login
// has no other page-specific heading, so it renders the wordmark as the
// page's single <h1>. Everywhere else the page has its own more specific
// <h1> -- the wizard's section title (StepHeader), the registration receipt,
// "Email vérifié", the forgot-password title -- so the wordmark there renders
// as a non-heading element to avoid two <h1>s per page.
export function AuthHeader({ wordmarkAs = "div" }: { wordmarkAs?: "h1" | "div" }) {
  const t = useTranslations();
  const Wordmark = wordmarkAs;

  return (
    <header className="masthead">
      <Wordmark className="brand-name">{t("authShared.wordmark")}</Wordmark>
      <p className="brand-sub">{t("authShared.subtitle")}</p>
    </header>
  );
}
