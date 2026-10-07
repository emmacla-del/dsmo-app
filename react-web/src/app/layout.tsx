import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { QueryProvider } from "./query-provider";
import { AuthInitializer } from "./auth-initializer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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
