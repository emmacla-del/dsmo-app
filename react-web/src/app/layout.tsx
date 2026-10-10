import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { QueryProvider } from "./query-provider";
import { AuthInitializer } from "./auth-initializer";

// Inter, self-hosted, HINTED (owner, 2026-10-10). The four weights the type
// scale uses (400/500/600/700), from the official Inter 4.1 release
// (github.com/rsms/inter, extras/woff-hinted; SIL Open Font License 1.1,
// see fonts/Inter-LICENSE.txt). The unhinted variable file used before
// rendered soft on Windows at 125% scaling: without hinting instructions
// (fpgm/cvt) the glyph edges fall between pixels. Each file is subset with
// fontTools to Latin, French accents, punctuation, arrows and the few
// symbols the app draws, keeping the hinting and the tnum feature the
// statistical tables use: about 34 KB a weight, 137 KB for all four.
// Weights outside 400-700 (the documented scale) draw at the nearest one.
const inter = localFont({
  src: [
    { path: "./fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Inter-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const zillaSlab = localFont({
  src: [
    { path: "./fonts/ZillaSlab-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ZillaSlab-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-zilla-slab",
  display: "swap",
});

// The description is the platform's full name in the visitor's language
// (authShared.subtitle), not a fixed string: the locale comes from the
// NEXT_LOCALE cookie (src/i18n/request.ts), so it has to be resolved per
// request rather than exported as static metadata.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("authShared");
  return {
    title: "CAM-LEAP",
    description: t("subtitle"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`h-full ${inter.variable} ${zillaSlab.variable}`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <AuthInitializer />
            {children}
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
