"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isRegistrationReviewPath } from "@/lib/registration-trail";
import LoadingRegistrationReview from "./[id]/loading";

/**
 * This boundary also covers /admin/inscriptions/[id]: going from one file to
 * another, or back to a file already opened, the router falls back to it and
 * not to [id]/loading.tsx, whose segment has not arrived yet. The path is
 * already the new one here, so a review shows its own loading state and not
 * the queue's skeleton, which read as a blank page after « Approuver ».
 */
export default function LoadingRegistrations() {
  const t = useTranslations("common");
  const pathname = usePathname();
  if (isRegistrationReviewPath(pathname)) return <LoadingRegistrationReview />;
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
