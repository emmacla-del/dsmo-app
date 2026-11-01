"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { approveDossier, getAdminDossier, getDossierClaimState, getDossierDiagnostic, getDossierNeighbours, type AdminDossier } from "@/lib/api-client";
import type { DossierNeighbourQuery } from "@/lib/dossier-neighbour-query";
import { DossierClaimPanel, dossierClaimStateKey } from "@/components/admin/DossierClaimPanel";
import { DataState } from "@/components/admin/DataState";
import { asUiLocale } from "@/lib/register-i18n";
import { NOT_PROVIDED, resolveDataState, stamp } from "@/lib/admin-data-state";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { hasRole, SURVEY_ROLES } from "@/lib/roles";
import { isActiveDossierClaimOwner } from "@/lib/dossier-review-state";
import { allowedDecisions } from "@/lib/dossier-axes";

export interface DossierPreviewSummary {
  companyName: string | null;
  respondentName: string | null;
  submissionId: string;
  formType: string | null;
  formTypeLabel?: string | null;
  adminStatus: string | null;
  region: string | null;
  department: string | null;
  submittedAt: string | null;
  blockingCount: number;
  warningCount: number;
  validationDataAvailable: boolean;
}

interface DossierPreviewDrawerProps {
  dossierId: string;
  summary?: DossierPreviewSummary;
  fullDossierHref: string;
  userId: string | null | undefined;
  role: string | null | undefined;
  focusChecks?: boolean;
  nextDossierId?: string | null;
  neighboursLoaded?: boolean;
  neighbourFilters: DossierNeighbourQuery["filters"];
  previewPosition?: number | null;
  previewTotal?: number;
  notice?: string | null;
  onAdvance?: (id: string | null, validatedRef: string) => void;
  onClose: () => void;
}

function statusLabelKey(status: string | null | undefined): "badgePending" | "badgeCorrection" | "badgeEndorsed" | "badgeRejected" | "badgeSuperseded" | "badgeNoStatus" {
  if (status === "PENDING_REVIEW") return "badgePending";
  if (status === "CORRECTION_REQUESTED") return "badgeCorrection";
  if (status === "APPROVED") return "badgeEndorsed";
  if (status === "REJECTED") return "badgeRejected";
  if (status === "SUPERSEDED") return "badgeSuperseded";
  return "badgeNoStatus";
}

function statusClass(status: string | null | undefined) {
  if (status === "PENDING_REVIEW") return "pending";
  if (status === "CORRECTION_REQUESTED") return "correction";
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "SUPERSEDED") return "superseded";
  return "neutral";
}

export function DossierPreviewDrawer({
  dossierId,
  summary,
  fullDossierHref,
  userId,
  role,
  focusChecks = false,
  nextDossierId = null,
  neighboursLoaded = false,
  neighbourFilters,
  previewPosition = null,
  previewTotal = 0,
  notice = null,
  onAdvance,
  onClose,
}: DossierPreviewDrawerProps) {
  const t = useTranslations("adminDossiersPage");
  const tDetail = useTranslations("adminDossierPage");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approveAndNext, setApproveAndNext] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const checksSectionRef = useRef<HTMLElement>(null);
  const dossierQuery = useQuery({
    queryKey: ["admin", "dossier", dossierId, false],
    queryFn: () => getAdminDossier(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: 0,
  });
  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", dossierId, false],
    queryFn: () => getDossierDiagnostic(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: 0,
  });
  const claimStateQuery = useQuery({
    queryKey: dossierClaimStateKey(dossierId),
    queryFn: () => getDossierClaimState(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: 0,
  });

  const dossier: AdminDossier | undefined = dossierQuery.data;
  const visibleSummary = summary;
  const status = dossier?.status ?? visibleSummary?.adminStatus;
  const entityName = visibleSummary?.companyName || dossier?.respondent?.respondentName || dossier?.submissionId || visibleSummary?.submissionId || NOT_PROVIDED;
  const region = dossier?.region ?? visibleSummary?.region;
  const department = dossier?.department ?? visibleSummary?.department;
  const formType = visibleSummary?.formTypeLabel ?? dossier?.formType ?? visibleSummary?.formType;
  const submittedAt = dossier?.submissionDate ?? visibleSummary?.submittedAt;
  const diagnostic = diagnosticQuery.data;
  const blockingCount = diagnostic?.blockingAnomalies?.length ?? visibleSummary?.blockingCount ?? 0;
  const warningCount = diagnostic?.warningAnomalies?.length ?? visibleSummary?.warningCount ?? 0;
  const diagnosticsReady = Boolean(diagnostic && !diagnosticQuery.isLoading && !diagnosticQuery.isFetching && !diagnosticQuery.isError);
  const dossierDataState = resolveDataState({
    isLoading: dossierQuery.isLoading,
    isError: dossierQuery.isError && !dossierQuery.data,
    error: dossierQuery.error,
  });
  const hasBlockingIssues = (diagnostic?.blockingAnomalies.length ?? 0) > 0;
  const hasOpenWarnings = (diagnostic?.warningAnomalies.length ?? 0) > 0;
  const canApproveHere = hasRole(role, SURVEY_ROLES) && status === "PENDING_REVIEW" &&
    isActiveDossierClaimOwner(claimStateQuery.data, userId) && diagnosticsReady && !hasBlockingIssues &&
    Number.isSafeInteger(dossier?.revision);
  const decisions = allowedDecisions(status);
  const canDecideHere = !claimStateQuery.isFetching && hasRole(role, SURVEY_ROLES) && isActiveDossierClaimOwner(claimStateQuery.data, userId);
  const decisionHref = (param: "openCorrection" | "openReject") =>
    `${fullDossierHref}${fullDossierHref.includes("?") ? "&" : "?"}${param}=1`;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [dossierId]);
  useEffect(() => {
    if (!focusChecks || diagnosticQuery.isLoading || diagnosticQuery.isFetching) return;
    checksSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [diagnosticQuery.isLoading, diagnosticQuery.isFetching, focusChecks, dossierId, dossier, visibleSummary]);

  const approvalMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!dossier || !Number.isSafeInteger(dossier.revision)) throw new Error(tDetail("revisionUnavailable"));
      const latestDiagnostic = await getDossierDiagnostic(dossierId);
      queryClient.setQueryData(["admin", "diagnostic", dossierId, false], latestDiagnostic);
      if (latestDiagnostic.blockingAnomalies.length > 0) throw new Error(tDetail("blockingIssuesMustBeResolved"));
      if (latestDiagnostic.warningAnomalies.length > 0 && !approveComment.trim()) throw new Error(tDetail("warningJustificationRequired"));
      return approveDossier(dossierId, dossier.revision, approveComment);
    },
    onSuccess: async (approvedData: any) => {
      const reviewedAt = approvedData?.reviewedAt ?? new Date().toISOString();
      queryClient.setQueryData(["admin", "dossier", dossierId, false], (old: any) => old ? {
        ...old,
        status: "APPROVED",
        revision: approvedData?.revision ?? old.revision,
        reviewedAt,
        reviewedBy: approvedData?.reviewedBy ?? old.reviewedBy,
      } : old);
      queryClient.setQueryData(["admin", "dossier-claim-state", dossierId], (old: any) => old ? {
        ...old,
        status: "APPROVED",
        eligible: false,
        assigneeId: null,
        assigneeName: null,
      } : old);
      setApproveSuccess(true);
      setApproveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      const validatedRef = dossier?.submissionId ?? visibleSummary?.submissionId ?? dossierId;
      const neighbours = await getDossierNeighbours(dossierId, neighbourFilters);
      onAdvance?.(neighbours.next?.id ?? null, validatedRef);
    },
    onError: (error: unknown) => setDecisionError(error instanceof Error ? error.message : tDetail("unknownError")),
  });

  const openApprovalConfirmation = () => {
    setApproveAndNext(Boolean(nextDossierId));
    setApproveComment("");
    setDecisionError("");
    approvalMutation.reset();
    setApproveOpen(true);
  };

  return (
    <>
    <aside
      id="cam-dossier-preview-panel"
      className="cam-dossier-filter-sidebar cam-dossier-preview-sidebar is-open"
      aria-labelledby="cam-dossier-preview-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="cam-dossier-filter-sidebar-head">
        <div className="cam-dossier-preview-heading">
          <span className="cam-dossier-preview-eyebrow">{t("previewEyebrow")}</span>
          <h2 id="cam-dossier-preview-title" className="cam-dossier-filter-sidebar-title">{entityName}</h2>
          <p className="cam-dossier-filter-sidebar-description">{t("previewReference", { id: dossier?.submissionId ?? visibleSummary?.submissionId ?? dossierId })}</p>
          {previewPosition !== null && previewTotal > 0 && (
            <p className="cam-admin-meta">{t("previewPosition", { position: previewPosition, total: previewTotal })}</p>
          )}
        </div>
        <button ref={closeButtonRef} type="button" className="cam-dossier-filter-close" aria-label={t("closePreview")} onClick={onClose}><X aria-hidden="true" /></button>
      </div>

      <div className="cam-dossier-preview-content">
        {dossierDataState !== "ready" && <DataState
          state={dossierDataState}
          resource={t("previewEyebrow")}
          title={dossierDataState === "loading" ? t("previewLoading") : t("previewLoadError")}
          error={dossierQuery.error}
          onRetry={() => void dossierQuery.refetch()}
          dense
        />}
        {notice && <p className="cam-admin-notice cam-admin-notice--success" role="status">{notice}</p>}

        {(dossier || visibleSummary) && <>
          <section className="cam-dossier-preview-section" aria-labelledby="cam-dossier-preview-status-heading">
            <h3 id="cam-dossier-preview-status-heading" className="cam-dossier-preview-section-title">{t("previewStatusHeading")}</h3>
            <Badge className={`cam-dossier-status-badge cam-dossier-status-badge--${statusClass(status)}`} variant="neutral">{t(statusLabelKey(status))}</Badge>
            <dl className="cam-dossier-preview-facts">
              <div><dt>{t("respondentColumn")}</dt><dd>{dossier?.respondent?.respondentName ?? visibleSummary?.respondentName ?? NOT_PROVIDED}</dd></div>
              <div><dt>{t("entityTypeColumn")}</dt><dd>{formType ?? NOT_PROVIDED}</dd></div>
              <div><dt>{t("territoryColumn")}</dt><dd>{[region, department].filter(Boolean).join(" / ") || NOT_PROVIDED}</dd></div>
              <div><dt>{t("submittedAtColumn")}</dt><dd>{submittedAt ? stamp(submittedAt, true, locale) : NOT_PROVIDED}</dd></div>
            </dl>
          </section>

          <section ref={checksSectionRef} tabIndex={-1} className="cam-dossier-preview-section" aria-labelledby="cam-dossier-preview-checks-heading">
            <h3 id="cam-dossier-preview-checks-heading" className="cam-dossier-preview-section-title">{t("reviewStatusChecksColumn")}</h3>
            {diagnosticQuery.isLoading && <p className="cam-admin-meta" role="status">{t("previewChecksLoading")}</p>}
            {(diagnosticQuery.isError || (!diagnosticQuery.isLoading && !diagnostic && visibleSummary && !visibleSummary.validationDataAvailable)) && (
              <div className="cam-admin-notice cam-admin-notice--warn" role="status">
                <span>{t("checksUnavailableRecovery")}</span>
                <Button type="button" size="sm" variant="outline" disabled={diagnosticQuery.isFetching} onClick={() => void diagnosticQuery.refetch()}>
                  {diagnosticQuery.isFetching ? t("previewChecksLoading") : t("retryChecks")}
                </Button>
              </div>
            )}
            <div className="cam-dossier-preview-check-counts">
              {blockingCount > 0 && <Badge variant="danger">{t("blockingAnomalies", { count: blockingCount })}</Badge>}
              {warningCount > 0 && <Badge variant="warning">{t("warnings", { count: warningCount })}</Badge>}
              {diagnostic && blockingCount === 0 && warningCount === 0 && <p className="cam-dossier-preview-clean">{t("noOpenIssuesRecorded")}</p>}
            </div>
            {diagnostic && <>
              {blockingCount > 0 && <ul className="cam-admin-issues">
                {diagnostic.blockingAnomalies.map((anomaly: { ruleCode?: string | null; description?: string | null }, index: number) => <li key={`${anomaly.ruleCode ?? "blocking"}-${index}`} title={anomaly.ruleCode ?? undefined}>{coherenceWarningText(tDetail, anomaly.ruleCode, anomaly.description) || anomaly.ruleCode || t("blockingAnomalies", { count: blockingCount })}</li>)}
              </ul>}
              {warningCount > 0 && <ul className="cam-admin-issues is-warn">
                {diagnostic.warningAnomalies.map((anomaly: { ruleCode?: string | null; description?: string | null }, index: number) => <li key={`${anomaly.ruleCode ?? "warning"}-${index}`} title={anomaly.ruleCode ?? undefined}>{coherenceWarningText(tDetail, anomaly.ruleCode, anomaly.description) || anomaly.ruleCode || t("warnings", { count: warningCount })}</li>)}
              </ul>}
            </>}
          </section>

          {approveSuccess && <p className="cam-admin-notice cam-admin-notice--success" role="status">{tDetail("approveSuccess")}</p>}
          {decisionError && <p className="cam-admin-notice cam-admin-notice--error" role="alert">{decisionError}</p>}

          {canDecideHere && (decisions.reject || decisions.requestCorrection || decisions.approve) && (
            <section className="cam-dossier-preview-decision" aria-labelledby="cam-dossier-preview-decision-heading">
              <h3 id="cam-dossier-preview-decision-heading" className="cam-dossier-preview-section-title">{t("previewDecisionHeading")}</h3>
              {nextDossierId === null && previewPosition !== null && neighboursLoaded && (
                <p className="cam-admin-meta">{t("noNextPendingFile")}</p>
              )}
              {decisions.reject && (
                <Button asChild variant="outline" className="cam-dossier-preview-decision-action">
                  <Link href={decisionHref("openReject")}>{tDetail("rejectFormButton")}</Link>
                </Button>
              )}
              {decisions.requestCorrection && (
                <Button asChild variant="outline" className="cam-dossier-preview-decision-action">
                  <Link href={decisionHref("openCorrection")}>{tDetail("requestCorrectionButton")}</Link>
                </Button>
              )}
              {decisions.approve && (
                <>
                  {!diagnosticsReady && <p className="cam-admin-meta">{tDetail("approvalChecksUnavailableOrBlocked")}</p>}
                  {diagnosticsReady && hasBlockingIssues && <p className="cam-admin-notice cam-admin-notice--error" role="status">{tDetail("blockingIssuesMustBeResolved")}</p>}
                  {canApproveHere && (
                    <Button type="button" className="cam-dossier-preview-approve" onClick={openApprovalConfirmation}>
                      {nextDossierId ? t("validateAndNext") : tDetail("validateArchiveButton")}
                    </Button>
                  )}
                </>
              )}
            </section>
          )}

          <DossierClaimPanel dossierId={dossierId} userId={userId} role={role} revision={dossier?.revision ?? null} />
        </>}
      </div>

      <div className="cam-dossier-filter-sidebar-footer cam-dossier-preview-footer">
        <Button asChild type="button" className="cam-dossier-preview-full-link">
          <Link href={fullDossierHref}>{t("openFullDossier")}</Link>
        </Button>
      </div>
    </aside>
    <AdminDialog
      open={approveOpen}
      onClose={() => setApproveOpen(false)}
      title={tDetail("validateArchiveButton")}
      eyebrow={t("previewReference", { id: dossier?.submissionId ?? visibleSummary?.submissionId ?? dossierId })}
      footer={
        <>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setApproveOpen(false)}>
            {tDetail("closeButton")}
          </button>
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            onClick={() => approvalMutation.mutate()}
            disabled={approvalMutation.isPending || !canApproveHere || (hasOpenWarnings && !approveComment.trim())}
          >
            {approvalMutation.isPending ? tDetail("validating") : approveAndNext ? t("validateAndNext") : tDetail("confirmValidation")}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{tDetail("approveBody")}</p>
      {hasOpenWarnings && (
        <label className="cam-admin-form-section">
          <span className="cam-admin-label">{tDetail("warningJustificationLabel")} <span aria-hidden="true">*</span></span>
          <Textarea
            value={approveComment}
            onChange={(event) => setApproveComment(event.target.value)}
            maxLength={2000}
            required
            aria-required="true"
            aria-invalid={!approveComment.trim()}
            placeholder={tDetail("warningJustificationPlaceholder")}
          />
          <span className="cam-admin-meta">{tDetail("warningJustificationHelp", { count: warningCount })}</span>
        </label>
      )}
      {approvalMutation.isError && <p className="cam-admin-notice cam-admin-notice--error" role="alert">
        {tDetail("approveFailed", { message: decisionError || tDetail("unknownError") })}
      </p>}
    </AdminDialog>
    </>
  );
}
