"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, recheckDossierCoherence } from "@/lib/api-client";
import { resolveDataState } from "@/lib/admin-data-state";
import { listAnomalyRegistry, resolveAnomalyRecord, type AnomalyRecord } from "@/lib/anomaly-registry";
import { EXPLAIN_NOTE_MAX, ExplainFindingError, explainFindingAnomalies, explainNoteValid } from "@/lib/dossier-explain";

/** The key of a file's explained findings, invalidated with the diagnostic. */
export function explainedFindingsKey(submissionRowId: string) {
  return ["admin", "anomalies", "explained", submissionRowId] as const;
}

/**
 * « Expliquer » on one advisory finding: the claim holder states, in a note,
 * why the figures are right, and every stored anomaly of the finding is
 * closed through the existing resolve route (claim, territory and revision
 * enforced there). Warnings only: a blocking finding is not offered this
 * (owner's decision, docs/plans/dossier-field-observations.md, Part A).
 */
export function ExplainFindingAction({ anomalyIds, revision, sentence, onSettled }: {
  anomalyIds: string[];
  /** The dossier revision the reviewer is reading. */
  revision: number;
  /** The finding as « À vérifier » words it, repeated in the dialog. */
  sentence: string;
  /** Reload the file, its diagnostic and its explained findings. */
  onSettled: () => void;
}) {
  const t = useTranslations("adminDossierPage");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const mutation = useMutation({
    retry: false,
    mutationFn: () => explainFindingAnomalies(anomalyIds, revision, note, resolveAnomalyRecord),
    onSuccess: () => {
      setOpen(false);
      setNote("");
      onSettled();
    },
    // A partial run is real on the server: reload so the page shows it.
    onError: () => onSettled(),
  });
  const error = mutation.error;
  const done = error instanceof ExplainFindingError ? error.done : 0;
  const stale = error instanceof ExplainFindingError && error.reason instanceof ApiError && error.reason.status === 409;

  return (
    <>
      <button
        type="button"
        className="cam-text-button"
        onClick={() => { mutation.reset(); setOpen(true); }}
      >
        {t("explainButton")}
      </button>
      <AdminDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("explainTitle")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setOpen(false)}>
              {t("explainCancel")}
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={mutation.isPending || !explainNoteValid(note)}
              onClick={() => mutation.mutate()}
            >
              {t("explainConfirm")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{sentence}</p>
        <p className="cam-admin-meta">{t("explainBody")}</p>
        <label className="cam-admin-form-section">
          <span className="cam-admin-label">{t("explainNoteLabel")} <span aria-hidden="true">*</span></span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={EXPLAIN_NOTE_MAX}
            required
            aria-required="true"
            placeholder={t("explainNotePlaceholder")}
          />
          <span className="cam-admin-meta">{t("explainNoteHelp")}</span>
        </label>
        {mutation.isError && (
          <div role="alert" className="cam-admin-notice cam-admin-notice--error">
            {stale ? t("explainStale") : t("explainFailed", { message: (error as Error)?.message ?? "" })}
            {done > 0 && <> {t("explainPartial", { done, total: anomalyIds.length })}</>}
          </div>
        )}
      </AdminDialog>
    </>
  );
}

function resolverName(record: AnomalyRecord): string | null {
  const person = record.resolvedBy;
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
}

/** The file's explained warnings, one per rule (a rule closed for men, women and total is one). */
export function useExplainedFindings(submissionRowId: string | null | undefined) {
  const query = useQuery({
    queryKey: explainedFindingsKey(submissionRowId ?? ""),
    queryFn: () => listAnomalyRegistry({ submissionId: submissionRowId!, status: "RESOLVED", isBlocking: false, limit: 100 }),
    enabled: Boolean(submissionRowId),
  });
  const byRule = new Map<string, AnomalyRecord>();
  for (const item of query.data?.items ?? []) if (!byRule.has(item.ruleCode)) byRule.set(item.ruleCode, item);
  return { query, items: [...byRule.values()] };
}

/**
 * The advisory findings already explained on this file, with the reviewer's
 * note, who and when.
 */
export function ExplainedFindings({ explained, sentence }: {
  explained: ReturnType<typeof useExplainedFindings>;
  sentence: (ruleCode: string, description: string) => string;
}) {
  const t = useTranslations("adminDossierPage");
  const locale = useLocale().startsWith("en") ? "en-GB" : "fr-FR";
  const { query, items } = explained;
  const state = resolveDataState({ isLoading: query.isLoading, isError: query.isError, error: query.error });
  // A role that may not read the registry simply sees open findings only.
  if (state === "loading" || state === "forbidden") return null;
  if (state !== "ready") {
    return <DataState dense state={state} resource={t("explainedResource")} error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (items.length === 0) return null;
  return (
    <div className="cam-dossier-findings-group">
      <h3 className="cam-admin-label">{t("settledHeading", { count: items.length })}</h3>
      {items.map((item) => (
        <div key={item.ruleCode} className="is-explained" title={item.ruleCode}>
          <p>{sentence(item.ruleCode, item.description)}</p>
          {item.resolutionType === "RULE_RECHECK" ? (
            // Closed by the system: the figures agree with the current rule.
            <p className="cam-admin-meta">
              {t("closedByRecheck", { date: item.resolvedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.resolvedAt)) : "—" })}
            </p>
          ) : (
            <>
              {item.resolutionNote && <p>« {item.resolutionNote} »</p>}
              <p className="cam-admin-meta">
                {t("explainedBy", {
                  name: resolverName(item) ?? "—",
                  date: item.resolvedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.resolvedAt)) : "—",
                })}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * « Recalculer les contrôles »: the server re-runs the coherence checks on
 * this pending file with the current rules, adds the warnings now due and
 * closes those whose figures agree (CLAUDE.md §21, 2026-11-01). The result is
 * said in words; the page then reloads the findings.
 */
export function RecheckCoherenceAction({ dossierId, onSettled }: { dossierId: string; onSettled: () => void }) {
  const t = useTranslations("adminDossierPage");
  const mutation = useMutation({
    retry: false,
    mutationFn: () => recheckDossierCoherence(dossierId),
    onSettled: () => onSettled(),
  });
  const result = mutation.data;
  return (
    <div className="cam-dossier-recheck">
      <button type="button" className="cam-text-button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? t("recheckRunning") : t("recheckButton")}
      </button>
      {result && (
        <p className="cam-admin-meta" role="status">
          {result.added === 0 && result.closed === 0 ? t("recheckNoChange") : t("recheckResult", { added: result.added, closed: result.closed })}
        </p>
      )}
      {mutation.isError && (
        <p className="cam-admin-meta" role="alert">{t("recheckFailed", { message: (mutation.error as Error)?.message ?? "" })}</p>
      )}
    </div>
  );
}
