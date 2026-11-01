"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DossierClaimState } from "@/lib/api-client";
import { NOT_PROVIDED, clockTime } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";
import { canChangeDossierClaim, isActiveDossierClaimOwner } from "@/lib/dossier-review-state";

interface DossierBarClaimProps {
  claim: DossierClaimState;
  userId: string | null | undefined;
  role: string | null | undefined;
  readOnly: boolean;
  /** A claim request or a claim-state refresh is in flight: the control waits. */
  busy: boolean;
  saving: boolean;
  onChange: (assigneeId: string | null) => void;
}

/**
 * The claim, inline in the workspace's decision bar: who holds the file, until
 * when, and the one claim action this reviewer may take. Same rules as
 * DossierClaimPanel (canChangeDossierClaim); the server stays the guard.
 */
export function DossierBarClaim({ claim, userId, role, readOnly, busy, saving, onChange }: DossierBarClaimProps) {
  const t = useTranslations("adminDossierPage");
  const locale = asUiLocale(useLocale());
  // A decided or archived file has no claim to show.
  if (!claim.eligible) return null;

  const ownsClaim = isActiveDossierClaimOwner(claim, userId);
  const canManageClaim = !readOnly && Boolean(userId) && canChangeDossierClaim(claim, userId, role);
  const label = claim.expired
    ? t("claimExpired")
    : ownsClaim
      ? claim.expiresAt
        ? t("claimInlineYou", { time: clockTime(claim.expiresAt, locale) })
        : t("claimInlineYouUntracked")
      : claim.assigneeId
        ? t("claimInlineOther", { name: claim.assigneeName ?? NOT_PROVIDED })
        : t("claimInlineFree");

  return (
    <>
      <span className="cam-admin-meta" role={claim.expired ? "status" : undefined}>{label}</span>
      {canManageClaim && userId && (
        <button type="button" className="cam-text-button" disabled={busy} onClick={() => onChange(ownsClaim ? null : userId)}>
          {saving ? t("claimSaving") : ownsClaim ? t("releaseClaim") : t("claimForMe")}
        </button>
      )}
    </>
  );
}
