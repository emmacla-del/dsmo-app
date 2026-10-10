"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, localeCookieName, type Locale } from "@/i18n/config";

const localeLabel: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};

export function LocaleSwitcher({ variant = "default" }: { variant?: "default" | "masthead" }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: Locale) {
    if (next === locale) return;
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  const isMasthead = variant === "masthead";

  return (
    <div style={{ display: "flex", gap: 4 }} aria-label="Langue / Language">
      {locales.map((value) => {
        const isCurrent = value === locale;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            disabled={isPending}
            aria-pressed={isCurrent}
            style={{
              padding: isMasthead ? "3px 8px" : "2px 8px",
              borderRadius: isMasthead ? 4 : 6,
              border: isMasthead
                ? isCurrent ? "1px solid var(--cam-surface)" : "1px solid rgba(255, 255, 255, 0.3)"
                : isCurrent ? "1px solid var(--cam-green)" : "1px solid var(--cam-border)",
              background: isMasthead
                ? isCurrent ? "var(--cam-surface)" : "transparent"
                : isCurrent ? "var(--cam-green)" : "transparent",
              color: isMasthead
                ? isCurrent ? "var(--cam-green-dark)" : "var(--cam-surface)"
                : isCurrent ? "var(--cam-surface)" : "inherit",
              fontSize: "var(--cam-font-size-3xs)",
              fontWeight: 700,
              cursor: isPending ? "default" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {localeLabel[value]}
          </button>
        );
      })}
    </div>
  );
}
