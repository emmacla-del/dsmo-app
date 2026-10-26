"use client";

import { useTranslations } from "next-intl";

export default function LoadingNewRegistration() {
  const t = useTranslations("common");
  return (
    <div className="cam-admin-page cam-registration-route-loading" aria-busy="true">
      <span className="sr-only" role="status">{t("loading")}</span>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-5 h-4 w-64 rounded bg-muted" />
        <div className="mb-4 h-9 w-72 rounded bg-muted" />
        <div className="mb-8 h-5 w-full max-w-2xl rounded bg-muted" />
        <div className="mb-6 h-52 rounded-xl border bg-card" />
        <div className="mb-6 h-64 rounded-xl border bg-card" />
        <div className="h-40 rounded-xl border bg-card" />
      </div>
    </div>
  );
}
