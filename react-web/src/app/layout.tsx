import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

export const metadata: Metadata = {
  title: "CAM-LEAP",
  description: "Système national de déclaration du marché du travail",
};

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
