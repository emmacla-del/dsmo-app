"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getDossierDiagnostic } from "@/lib/api-client";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import { mergeSameRule } from "@/lib/dossier-findings";
import { resolveDataState } from "@/lib/admin-data-state";
import { DataState } from "@/components/admin/DataState";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * The instruction desk's preview, for the registration queue and the
 * dossier queue (owner, 2026-11-11: « Preview only »).
 *
 * Opened from a queue row's name, it shows what the agent needs to pick the
 * next file without leaving the queue: the reference and the filing date,
 * what the file asks the agent to check, and the facts the row shows (passed
 * in by the queue, so the two never disagree). « Précédent » / « Suivant »
 * step through the queue in its current order.
 *
 * It decides nothing. Approval, correction and rejection stay on the review
 * page, after the claim, with their findings and audit trail
 * (admin-layout-spec §12); the panel's one action is the row's own button.
 * The shared Sheet traps focus and closes on Escape; on close, focus goes
 * back to the name of the file last shown (`data-preview-opener`).
 */
export interface QueuePreviewFact {
  label: string;
  value: ReactNode;
}

export function QueuePreviewPanel({
  openerKey,
  title,
  reference,
  filedOn,
  description,
  children,
  factsTitle,
  facts,
  decisionNote,
  openFile,
  action,
  position,
  onPrevious,
  onNext,
  onClose,
}: {
  /** The value of the row name's `data-preview-opener`. */
  openerKey: string;
  title: string;
  reference: string | null;
  filedOn: string | null;
  /** Read to screen readers when the panel opens. */
  description: string;
  /** Sections above the facts: what to check. */
  children?: ReactNode;
  factsTitle: string;
  facts: QueuePreviewFact[];
  decisionNote: string;
  /** The complete file, as a link; omitted when the row's action already opens it. */
  openFile?: { href: string; label: string };
  /** The row's own primary button. */
  action: ReactNode;
  position: { index: number; total: number };
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}) {
  const t = useTranslations("adminQueuePreview");

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="cam-dossier-preview"
        onCloseAutoFocus={(event) => {
          const opener = document.querySelector<HTMLElement>(`[data-preview-opener="${CSS.escape(openerKey)}"]`);
          if (opener) {
            event.preventDefault();
            opener.focus();
          }
        }}
      >
        <div className="cam-dossier-preview-nav">
          <span className="cam-dossier-preview-position">{t("position", { index: position.index + 1, total: position.total })}</span>
          <span className="cam-dossier-preview-steps">
            <button type="button" className="cam-text-button" disabled={!onPrevious} onClick={onPrevious ?? undefined}>{t("previous")}</button>
            <button type="button" className="cam-text-button" disabled={!onNext} onClick={onNext ?? undefined}>{t("next")}</button>
            <button type="button" className="cam-text-button" onClick={onClose}>{t("close")}</button>
          </span>
        </div>

        <header className="cam-dossier-preview-head">
          {(reference || filedOn) && (
            <p className="cam-dossier-preview-filed">
              {reference && <span className="cam-record-cell-ref">{reference}</span>}
              {filedOn && <span>{t("filedOn", { date: filedOn })}</span>}
            </p>
          )}
          <SheetTitle className="cam-dossier-preview-title">{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </header>

        {children}

        <section className="cam-dossier-preview-section" aria-labelledby="queue-preview-facts">
          <h3 id="queue-preview-facts" className="cam-dossier-preview-h3">{factsTitle}</h3>
          <dl className="cam-dossier-preview-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="cam-dossier-preview-foot">
          <p className="cam-dossier-preview-muted">{decisionNote}</p>
          <div className="cam-dossier-preview-actions">
            {openFile && <Link className="cam-text-button" href={openFile.href}>{openFile.label}</Link>}
            {action}
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

/** A plain list of points to check, for a preview section. */
export function QueuePreviewPoints({
  title,
  points,
  emptyText,
}: {
  title: string;
  points: Array<{ key: string; blocking: boolean; label: string; text: ReactNode }>;
  emptyText: string;
}) {
  return (
    <section className="cam-dossier-preview-section" aria-labelledby="queue-preview-points">
      <h3 id="queue-preview-points" className="cam-dossier-preview-h3">{title}</h3>
      {points.length === 0 ? (
        <p className="cam-dossier-preview-muted">{emptyText}</p>
      ) : (
        <ul className="cam-dossier-preview-findings">
          {points.map((p) => (
            <li key={p.key} className={p.blocking ? "is-blocking" : "is-warning"}>
              <span className="cam-dossier-preview-severity">{p.label}</span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A declaration's coherence findings, in the review page's own words, loaded
 * under the review page's query key so opening the file reuses them.
 */
export function DossierPreviewChecks({ dossierId }: { dossierId: string }) {
  const t = useTranslations("adminDossiersPage");
  const tFile = useTranslations("adminDossierPage");
  const diagnostic = useQuery({
    queryKey: ["admin", "diagnostic", dossierId, false],
    queryFn: () => getDossierDiagnostic(dossierId, false),
    staleTime: 30_000,
  });
  const sentence = (ruleCode: string, description: string | null | undefined) =>
    tFile.has(`findingRule.${ruleCode}`) ? tFile(`findingRule.${ruleCode}`) : coherenceWarningText(tFile, ruleCode, description);

  // Loading, failure, refusal and absence each say so (G10), as on the
  // review page; only a loaded diagnostic lists findings.
  const state = resolveDataState({ isPending: diagnostic.isPending, isError: diagnostic.isError, error: diagnostic.error });
  if (state !== "ready" || !diagnostic.data) {
    return (
      <section className="cam-dossier-preview-section" aria-labelledby="queue-preview-points">
        <h3 id="queue-preview-points" className="cam-dossier-preview-h3">{t("previewChecks")}</h3>
        <DataState state={state} resource={t("previewChecksResource")} error={diagnostic.error} onRetry={() => void diagnostic.refetch()} dense />
      </section>
    );
  }
  const points = [
    ...mergeSameRule(diagnostic.data.blockingAnomalies ?? []).map((item) => ({ key: `b-${item.ruleCode}`, blocking: true, label: t("previewBlocking"), text: sentence(item.ruleCode, item.finding.description) })),
    ...mergeSameRule(diagnostic.data.warningAnomalies ?? []).map((item) => ({ key: `w-${item.ruleCode}`, blocking: false, label: t("previewWarning"), text: sentence(item.ruleCode, item.finding.description) })),
  ];
  return <QueuePreviewPoints title={t("previewChecks")} points={points} emptyText={t("previewChecksNone")} />;
}
