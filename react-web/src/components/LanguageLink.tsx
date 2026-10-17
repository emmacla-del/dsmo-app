"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type Locale } from "@/i18n/config";
import { setClientLocaleCookie } from "@/lib/ui-locale";

// The other language's name, written in that language, so a reader who
// cannot read the current one still recognises it (Canada.ca's
// "Français" / "English" link).
const OTHER: Record<Locale, { locale: Locale; name: string }> = {
  fr: { locale: "en", name: "English" },
  en: { locale: "fr", name: "Français" },
};

// One quiet text link to the other official language -- the convention of
// bilingual government services, where the choice stays on every page, forms
// included (owner, 2026-10-15). It replaced the FR/EN pill pair
// (LocaleSwitcher) everywhere: the portal masthead, the sign-in family,
// the registration wizard, the respondent space and the staff console.
//
// A button, not a link: it changes the language of this page in place, it
// does not go anywhere. The switch is the same as LocaleSwitcher's -- the
// cookie, then a refresh of the server components -- so the page is not
// remounted and a form in progress keeps its answers (see layout.tsx).
export function LanguageLink({ ariaLabel }: { ariaLabel?: string } = {}) {
  const t = useTranslations("common");
  const current = (useLocale() as Locale) ?? "fr";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const other = OTHER[current] ?? OTHER.fr;

  return (
    <button
      type="button"
      className="cam-language-link"
      // The accessible name is in the page's current language ("Lire en
      // anglais"), so no lang attribute on the button itself.
      aria-label={ariaLabel ?? t("languageLinkAria")}
      // Not `disabled`: that would drop keyboard focus mid-switch.
      aria-busy={isPending || undefined}
      onClick={() => {
        if (isPending) return;
        setClientLocaleCookie(other.locale);
        startTransition(() => router.refresh());
      }}
    >
      {other.name}
    </button>
  );
}
