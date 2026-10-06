// src/lib/ui-locale.ts
//
// The console locale for code that runs outside React — the fetch helpers in
// api-client.ts build their error messages when a request fails, where
// useLocale() cannot be called. It reads the same NEXT_LOCALE cookie that
// src/i18n/request.ts reads for the provider, so a message thrown here is in
// the language the page around it renders in. On the server, or with no
// cookie, it is French: src/i18n/config.ts's defaultLocale.
import { localeCookieName } from "@/i18n/config";
import { asUiLocale, type UiLocale } from "./register-i18n";

export function currentUiLocale(): UiLocale {
  if (typeof document === "undefined") return "fr";
  const prefix = `${localeCookieName}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return asUiLocale(entry ? decodeURIComponent(entry.slice(prefix.length)) : null);
}
