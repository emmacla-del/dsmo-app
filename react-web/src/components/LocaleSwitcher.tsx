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
                ? isCurrent ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.3)"
                : "1px solid var(--cam-border, #d0d5dd)",
              background: isMasthead
                ? isCurrent ? "#ffffff" : "transparent"
                : isCurrent ? "var(--cam-primary, #1d4ed8)" : "transparent",
              color: isMasthead
                ? isCurrent ? "#0e3d23" : "#ffffff"
                : isCurrent ? "#fff" : "inherit",
              fontSize: 11,
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
