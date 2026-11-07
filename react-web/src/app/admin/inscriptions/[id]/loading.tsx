"use client";

import { useTranslations } from "next-intl";
import { REGISTRATION_QUEUE_HREF } from "@/lib/registration-trail";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataState } from "@/components/admin/DataState";

/**
 * Shown while a file's route loads, after a decision or on reopening a file.
 * Most of those navigations reach it through ../loading.tsx, which delegates
 * here (see there). It repeats the page's own loading state, so the screen does
 * not change shape when the file's request takes over, and it offers no
 * decision, so a file just decided cannot be acted on again. The back link is
 * the queue's default: reading returnTo here would need a Suspense boundary.
 */
export default function LoadingRegistrationReview() {
  const t = useTranslations("adminRegistrationReview");
  const tRoot = useTranslations();
  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[
          { label: tRoot("adminNav.hubs.inscriptions") },
          { label: tRoot("adminNav.routes.inscriptions"), href: REGISTRATION_QUEUE_HREF },
        ]}
        backHref={REGISTRATION_QUEUE_HREF}
        title={t("loadingTitle")}
      />
      <DataState state="loading" resource={t("resource")} />
    </div>
  );
}
