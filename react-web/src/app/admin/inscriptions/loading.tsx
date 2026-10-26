"use client";

import { useTranslations } from "next-intl";

export default function LoadingRegistrations() {
  const t = useTranslations("common");
  return (
    <div className="cam-admin-page cam-registration-route-loading" aria-busy="true">
      <span className="sr-only" role="status">{t("loading")}</span>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-8 h-9 w-56 rounded bg-muted" />
        <div className="mb-8 h-12 rounded-lg bg-muted" />
        <div className="mb-4 h-8 w-72 rounded bg-muted" />
        <div className="h-48 rounded-xl border bg-card" />
      </div>
    </div>
  );
}
