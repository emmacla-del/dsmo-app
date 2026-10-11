import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, localeCookieName, preferredLocale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  // A language the visitor chose (login page switcher) wins; until then,
  // the browser's own language, and French when it is neither.
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : preferredLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
