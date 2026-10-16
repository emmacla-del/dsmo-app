"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { OnefopSubmission } from "@/lib/api-client";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { shortRecordId, stamp } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

/**
 * Shown instead of the wizard when the period's declaration is awaiting
 * review or endorsed (lib/onefop-submitted-lock.ts). It can no longer be
 * changed, so nothing here is editable; when ONEFOP returns it for
 * correction, the wizard opens again from its draft.
 */
export function OnefopSubmittedNotice({ submission }: { submission: OnefopSubmission }) {
  const t = useTranslations("onefopSubmittedLock");
  const locale = asUiLocale(useLocale());
  const ref = String(submission.submissionId ?? submission.id);
  const values = {
    period: referencePeriodLabel(submission.quarterCode, locale),
    date: stamp(submission.submittedAt ?? submission.createdAt, false, locale),
    ref: shortRecordId(ref),
  };
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--cam-space-4)",
        maxWidth: "var(--cam-container-wizard)",
        margin: "0 auto",
        padding: "var(--cam-space-7) var(--cam-space-4)",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "var(--cam-font-size-xl)" }}>{t("title")}</h1>
      <p style={{ margin: 0 }}>
        {t("submitted", values)} {submission.status === "APPROVED" ? t("approved") : t("pending")}
      </p>
      <p style={{ margin: 0 }}>{t("locked")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-3)" }}>
        <Link href="/home" className="cam-button cam-button-primary">
          {t("home")}
        </Link>
        <Link href="/home/declarations" className="cam-button cam-button-secondary">
          {t("declarations")}
        </Link>
      </div>
    </main>
  );
}
