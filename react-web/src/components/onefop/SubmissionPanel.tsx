"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { stamp } from "@/lib/admin-data-state";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormData, OnefopEntity } from "@/lib/onefop-schema";
import {
  fetchDeclarationPreviewPdf,
  formatSubmissionError,
  getActiveQuarter,
  saveDraftToBackend,
  submitDeclaration,
  supportsBackendSubmission,
} from "@/lib/onefop-submission";
import { clearDraft } from "@/lib/onefop-drafts";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { ValidationSummary } from "./ValidationSummary";

interface SubmissionPanelProps {
  entityType: string;
  // Accepted but currently unused internally — kept because callers in
  // page.tsx pass it and it's cheap to accept; remove only if you also
  // remove it from every call site (there are currently two, both under
  // active edit elsewhere — check before deleting again).
  entity: OnefopEntity;
  data: FormData;
  /** Computed by the parent page, not here — it's also shown inline by
   * whichever presentation mode is active, a sibling of this panel, so the
   * single source of truth has to live in their shared parent. */
  validationIssues: ValidationIssue[];
  attemptedSubmit: boolean;
  onAttemptSubmit: () => void;
  /** Stable per-session idempotency key from useOnefopDraft (P4 fix). */
  formId?: string;
  onSubmitted?: () => Promise<void> | void;
}

const buttonStyle: React.CSSProperties = {
  height: "var(--cam-form-field-height)",
  padding: "0 var(--cam-space-4)",
  borderRadius: "var(--cam-radius-sm)",
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  cursor: "pointer",
  border: "var(--cam-border-width) solid var(--cam-border-strong)",
  background: "var(--cam-surface)",
  color: "var(--cam-text)",
};

/**
 * Real backend submission wiring, deliberately separated from the local
 * IndexedDB autosave (use-onefop-draft.ts) — that one is a per-device,
 * pre-server scratchpad; this panel is what actually reaches
 * src/onefop/onefop.controller.ts's /draft endpoint and src/
 * questionnaires/questionnaires.controller.ts's /submit endpoint on the
 * real backend. "Submit" is a genuinely consequential, hard-to-reverse
 * action (a real, permanent OnefopSubmission row, gated by an actual open
 * campaign round) — confirmed with a native browser confirm() before
 * firing, on top of only ever being enabled for the 4 entity types
 * OnefopSubmissionDto actually accepts.
 */
export function SubmissionPanel({
  entityType,
  entity,
  data,
  validationIssues,
  attemptedSubmit,
  onAttemptSubmit,
  formId,
  onSubmitted,
}: SubmissionPanelProps) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const [lastResult, setLastResult] = useState<string | null>(null);
  const quarterQuery = useQuery({ queryKey: ["onefop", "active-quarter"], queryFn: getActiveQuarter });

  // Null until the backend confirms the active period — never fall back to a
  // hardcoded quarter string, because a wrong value would attribute drafts
  // and submissions to the wrong campaign period in the database.
  const effectiveQuarter: string | undefined = quarterQuery.data?.code ?? undefined;
  const periodIsClosed = quarterQuery.data?.isOpen === false;

  const draftMutation = useMutation({
    mutationFn: () => {
      if (!effectiveQuarter) return Promise.reject(new Error("Active quarter not loaded"));
      return saveDraftToBackend(entityType, effectiveQuarter, data, entity);
    },
    onSuccess: () => setLastResult(t("submissionPanel.draftSavedMessage")),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!effectiveQuarter) return Promise.reject(new Error("Active quarter not loaded"));
      return submitDeclaration(entityType, effectiveQuarter, data, false, entity, formId);
    },
    onSuccess: (result) => {
      // Clear the local IndexedDB draft so stale prior-quarter data is not
      // reloaded when the respondent opens this entity type next quarter.
      Promise.resolve(onSubmitted?.()).catch(() => {});
      if (effectiveQuarter) clearDraft(entityType, effectiveQuarter).catch(() => {});
      setLastResult(
        t("submissionPanel.submissionSuccessWithId", { message: result.message, submissionId: result.submissionId }),
      );
    },
  });

  // POST /onefop/preview — non-mutating, no round/entity-type restriction
  // (unlike final submit), so it's offered for every entity type. Opens the
  // real, official-template PDF (see fetchDeclarationPreviewPdf's comment)
  // in a new tab rather than downloading it — the sandboxed artifact runtime
  // this app itself runs under blocks script-driven downloads, and an
  // inline tab is also just the more useful default for a "check before you
  // submit" preview.
  const pdfMutation = useMutation({
    mutationFn: () => fetchDeclarationPreviewPdf(entityType, data, quarterQuery.data?.code ?? null, undefined, entity),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });

  // canSubmit is false when the period is explicitly closed; it stays true
  // while the quarter is loading (isOpen is undefined) so the button is
  // available once the period is confirmed open.
  const canSubmit = supportsBackendSubmission(entityType) && !periodIsClosed;

  return (
    <div
      style={{
        border: "var(--cam-border-width) solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md)",
        padding: "var(--cam-space-4)",
        marginBottom: "var(--cam-space-6)",
        background: "var(--cam-surface)",
      }}
    >
      <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
        {t("submissionPanel.heading")}
      </h2>

      {attemptedSubmit && <ValidationSummary issues={validationIssues} />}

      {quarterQuery.isLoading && (
        <p style={{ fontSize: "var(--cam-font-size-sm)" }}>{t("submissionPanel.checkingPeriod")}</p>
      )}
      {quarterQuery.isError && (
        <p
          role="alert"
          style={{
            fontSize: "var(--cam-font-size-sm)",
            color: "var(--cam-error)",
            background: "var(--cam-error-bg)",
            padding: "var(--cam-space-2) var(--cam-space-3)",
            borderRadius: "var(--cam-radius-sm)",
            margin: "0 0 var(--cam-space-3)",
          }}
        >
          {t("submissionPanel.quarterLoadError")}
        </p>
      )}
      {quarterQuery.data && (
        <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-3)" }}>
          {quarterQuery.data.isOpen
            ? t("submissionPanel.periodOpenMessage", {
                code: quarterQuery.data.code ?? "",
                // The console locale, not the browser's (G12).
                deadline: stamp(quarterQuery.data.deadline, false, locale),
              })
            : (quarterQuery.data.message ?? t("submissionPanel.noPeriodOpen"))}
        </p>
      )}

      <div style={{ display: "flex", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={!effectiveQuarter || draftMutation.isPending}
          onClick={() => draftMutation.mutate()}
        >
          {draftMutation.isPending ? t("submissionPanel.savingButton") : t("submissionPanel.saveDraftButton")}
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={pdfMutation.isPending}
          onClick={() => pdfMutation.mutate()}
        >
          {pdfMutation.isPending ? t("submissionPanel.generatingButton") : t("submissionPanel.pdfPreviewButton")}
        </button>

        {supportsBackendSubmission(entityType) && (
          <button
            type="button"
            style={{
              ...buttonStyle,
              background: canSubmit ? "var(--cam-green)" : "var(--cam-border)",
              color: canSubmit ? "#fff" : "var(--cam-text-muted)",
              borderColor: canSubmit ? "var(--cam-green)" : "var(--cam-border-strong)",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            disabled={!canSubmit || !effectiveQuarter || submitMutation.isPending}
            onClick={() => {
              onAttemptSubmit();
              if (validationIssues.length > 0) return;
              if (window.confirm(t("submissionPanel.confirmSubmitMessage"))) {
                submitMutation.mutate();
              }
            }}
          >
            {submitMutation.isPending ? t("submissionPanel.submittingButton") : t("submissionPanel.submitFinalButton")}
          </button>
        )}
      </div>

      {!supportsBackendSubmission(entityType) && (
        <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", marginTop: "var(--cam-space-2)" }}>
          {t("submissionPanel.finalSubmissionUnavailable")}
        </p>
      )}

      {lastResult && (
        <p
          role="status"
          style={{
            marginTop: "var(--cam-space-3)",
            padding: "var(--cam-space-2) var(--cam-space-3)",
            background: "var(--cam-success-bg)",
            color: "var(--cam-success)",
            borderRadius: "var(--cam-radius-sm)",
            fontSize: "var(--cam-font-size-sm)",
          }}
        >
          {lastResult}
        </p>
      )}
      {(draftMutation.isError || submitMutation.isError || pdfMutation.isError) &&
        (() => {
          const { summary, items } = formatSubmissionError(
            draftMutation.error ?? submitMutation.error ?? pdfMutation.error,
          );
          return (
            <div
              role="alert"
              style={{
                marginTop: "var(--cam-space-3)",
                padding: "var(--cam-space-2) var(--cam-space-3)",
                background: "var(--cam-error-bg)",
                color: "var(--cam-error)",
                borderRadius: "var(--cam-radius-sm)",
                fontSize: "var(--cam-font-size-sm)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>{summary}</p>
              {items.length > 0 && (
                <ul style={{ margin: "var(--cam-space-2) 0 0", paddingLeft: "var(--cam-space-5)" }}>
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
    </div>
  );
}
