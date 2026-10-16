"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { locales, type Locale } from "@/i18n/config";
import { setClientLocaleCookie } from "@/lib/ui-locale";

const localeLabel: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};

export function LocaleSwitcher({ variant = "default" }: { variant?: "default" | "masthead" | "portal" }) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const transitionResolverRef = useRef<(() => void) | null>(null);

  // When currentLocale updates to match the requested locale, resolve view transition
  useEffect(() => {
    if (transitionResolverRef.current) {
      transitionResolverRef.current();
      transitionResolverRef.current = null;
    }
  }, [currentLocale]);

  // Optimistic switch: show target locale immediately while transition is pending
  const activeLocale = isPending && pendingLocale ? pendingLocale : currentLocale;

  function handleChange(next: Locale) {
    if (next === activeLocale || isPending) return;
    setPendingLocale(next);
    setClientLocaleCookie(next);

    const startUpdate = () => {
      startTransition(() => {
        router.refresh();
      });
    };

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      const updatePromise = new Promise<void>((resolve) => {
        transitionResolverRef.current = resolve;
        startUpdate();
        // Fallback safety timeout to ensure view transition completes if RSC is delayed
        setTimeout(() => {
          if (transitionResolverRef.current === resolve) {
            resolve();
            transitionResolverRef.current = null;
          }
        }, 1200);
      });

      try {
        (document as unknown as { startViewTransition: (cb: () => Promise<void>) => void }).startViewTransition(
          () => updatePromise
        );
      } catch {
        startUpdate();
      }
    } else {
      startUpdate();
    }
  }

  const isMasthead = variant === "masthead";
  const isPortal = variant === "portal";

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
      }}
      role="group"
      aria-label="Langue / Language"
    >
      {locales.map((value) => {
        const isCurrent = value === activeLocale;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            disabled={isPending}
            aria-pressed={isCurrent}
            style={{
              padding: isPortal ? "var(--cam-space-1) var(--cam-space-3)" : isMasthead ? "3px 8px" : "2px 8px",
              borderRadius: isPortal
                ? "var(--cam-radius-control)"
                : isMasthead
                ? "var(--cam-radius-md)"
                : "var(--cam-radius-control)",
              border: isPortal
                ? "none"
                : isMasthead
                ? isCurrent ? "1px solid var(--cam-surface)" : "1px solid rgba(255, 255, 255, 0.3)"
                : isCurrent ? "1px solid var(--cam-green)" : "1px solid var(--cam-border)",
              background: isPortal
                ? isCurrent ? "var(--cam-portal-panel, var(--cam-surface))" : "transparent"
                : isMasthead
                ? isCurrent ? "var(--cam-surface)" : "transparent"
                : isCurrent ? "var(--cam-green)" : "transparent",
              color: isPortal
                ? isCurrent ? "var(--cam-portal-ink, var(--cam-text))" : "var(--cam-portal-muted, var(--cam-text-muted))"
                : isMasthead
                ? isCurrent ? "var(--cam-green-dark)" : "var(--cam-surface)"
                : isCurrent ? "var(--cam-surface)" : "inherit",
              fontSize: isPortal ? "var(--cam-font-size-xs)" : "var(--cam-font-size-3xs)",
              fontWeight: 700,
              boxShadow: isPortal && isCurrent ? "var(--cam-shadow-sm)" : "none",
              cursor: isPending ? "default" : "pointer",
              transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
            }}
          >
            {localeLabel[value]}
          </button>
        );
      })}
    </div>
  );
}
