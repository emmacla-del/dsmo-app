export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeCookieName = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * The first supported language in a browser's preference list, or the
 * default. `preferences` is either an Accept-Language header
 * ("en-US,en;q=0.9,fr;q=0.8") or navigator.languages. It applies only
 * while the visitor has not chosen a language (no NEXT_LOCALE cookie).
 */
export function preferredLocale(preferences: string | readonly string[] | null | undefined): Locale {
  if (!preferences) return defaultLocale;
  const ranked =
    typeof preferences === "string"
      ? preferences
          .split(",")
          .map((part, index) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
            const weight = q ? Number(q.slice(2)) : 1;
            return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
          })
          .filter((entry) => entry.weight > 0)
          .sort((a, b) => b.weight - a.weight || a.index - b.index)
          .map((entry) => entry.tag)
      : preferences;
  for (const tag of ranked) {
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return defaultLocale;
}
