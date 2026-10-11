// src/lib/ui-locale.ts
//
// The console locale for code that runs outside React — the fetch helpers in
// api-client.ts build their error messages when a request fails, where
// useLocale() cannot be called. It reads the same NEXT_LOCALE cookie that
// src/i18n/request.ts reads for the provider, so a message thrown here is in
// the language the page around it renders in. With no cookie it follows the
// browser's language, as request.ts does; on the server it is French.
import { localeCookieName, preferredLocale } from "@/i18n/config";
import { asUiLocale, type UiLocale } from "./register-i18n";

export function currentUiLocale(): UiLocale {
  if (typeof document === "undefined") return "fr";
  const prefix = `${localeCookieName}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (entry) return asUiLocale(decodeURIComponent(entry.slice(prefix.length)));
  return preferredLocale(typeof navigator === "undefined" ? null : navigator.languages);
}
