"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { approveDossier, getAdminDossier, getDossierClaimState, getDossierDiagnostic, type AdminDossier } from "@/lib/api-client";
import { DossierClaimPanel, dossierClaimStateKey } from "@/components/admin/DossierClaimPanel";
import { asUiLocale } from "@/lib/register-i18n";
import { NOT_PROVIDED, stamp } from "@/lib/admin-data-state";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { hasRole, SURVEY_ROLES } from "@/lib/roles";
import { isActiveDossierClaimOwner } from "@/lib/dossier-review-state";

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
  onClose,
}: DossierPreviewDrawerProps) {
  const t = useTranslations("adminDossiersPage");
  const tDetail = useTranslations("adminDossierPage");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const checksSectionRef = useRef<HTMLElement>(null);
  const dossierQuery = useQuery({
    queryKey: ["admin", "dossier", dossierId, false],
    queryFn: () => getAdminDossier(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
  });
  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", dossierId, false],
    queryFn: () => getDossierDiagnostic(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
  });
  const claimStateQuery = useQuery({
    queryKey: dossierClaimStateKey(dossierId),
    queryFn: () => getDossierClaimState(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: Infinity,
  });

  const dossier: AdminDossier | undefined = dossierQuery.data;
  const status = dossier?.status ?? summary?.adminStatus;
  const entityName = summary?.companyName || dossier?.respondent?.respondentName || dossier?.submissionId || summary?.submissionId || NOT_PROVIDED;
  const region = dossier?.region ?? summary?.region;
  const department = dossier?.department ?? summary?.department;
  const formType = summary?.formTypeLabel ?? dossier?.formType ?? summary?.formType;
  const submittedAt = dossier?.submissionDate ?? summary?.submittedAt;
  const diagnostic = diagnosticQuery.data;
  const blockingCount = diagnostic?.blockingAnomalies?.length ?? summary?.blockingCount ?? 0;
  const warningCount = diagnostic?.warningAnomalies?.length ?? summary?.warningCount ?? 0;
  const diagnosticsReady = Boolean(diagnostic && !diagnosticQuery.isLoading && !diagnosticQuery.isError);
  const hasBlockingIssues = (diagnostic?.blockingAnomalies.length ?? 0) > 0;
  const hasOpenWarnings = (diagnostic?.warningAnomalies.length ?? 0) > 0;
  const canApproveHere = hasRole(role, SURVEY_ROLES) && status === "PENDING_REVIEW" &&
    isActiveDossierClaimOwner(claimStateQuery.data, userId) && diagnosticsReady && !hasBlockingIssues &&
    Number.isSafeInteger(dossier?.revision);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [dossierId]);
  useEffect(() => {
    if (!focusChecks || diagnosticQuery.isLoading) return;
    checksSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [diagnosticQuery.isLoading, focusChecks, dossierId, dossier, summary]);

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
    onSuccess: (approvedData: any) => {
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
    },
    onError: (error: unknown) => setDecisionError(error instanceof Error ? error.message : tDetail("unknownError")),
  });

  const openApprovalConfirmation = () => {
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
          <p className="cam-dossier-filter-sidebar-description">{t("previewReference", { id: dossier?.submissionId ?? summary?.submissionId ?? dossierId })}</p>
        </div>
        <button ref={closeButtonRef} type="button" className="cam-dossier-filter-close" aria-label={t("closePreview")} onClick={onClose}><X aria-hidden="true" /></button>
      </div>

      <div className="cam-dossier-preview-content">
        {dossierQuery.isError && <p className="cam-admin-notice cam-admin-notice--error" role="alert">{t("previewLoadError")}</p>}
        {dossierQuery.isLoading && !summary && <p className="cam-admin-meta" role="status">{t("previewLoading")}</p>}

        {(dossier || summary) && <>
          <section className="cam-dossier-preview-section" aria-labelledby="cam-dossier-preview-status-heading">
            <h3 id="cam-dossier-preview-status-heading" className="cam-dossier-preview-section-title">{t("previewStatusHeading")}</h3>
            <Badge className={`cam-dossier-status-badge cam-dossier-status-badge--${statusClass(status)}`} variant="neutral">{t(statusLabelKey(status))}</Badge>
            <dl className="cam-dossier-preview-facts">
              <div><dt>{t("respondentColumn")}</dt><dd>{dossier?.respondent?.respondentName ?? summary?.respondentName ?? NOT_PROVIDED}</dd></div>
              <div><dt>{t("entityTypeColumn")}</dt><dd>{formType ?? NOT_PROVIDED}</dd></div>
              <div><dt>{t("territoryColumn")}</dt><dd>{[region, department].filter(Boolean).join(" / ") || NOT_PROVIDED}</dd></div>
              <div><dt>{t("submittedAtColumn")}</dt><dd>{submittedAt ? stamp(submittedAt, true, locale) : NOT_PROVIDED}</dd></div>
            </dl>
          </section>

          <section ref={checksSectionRef} tabIndex={-1} className="cam-dossier-preview-section" aria-labelledby="cam-dossier-preview-checks-heading">
            <h3 id="cam-dossier-preview-checks-heading" className="cam-dossier-preview-section-title">{t("reviewStatusChecksColumn")}</h3>
            {diagnosticQuery.isLoading && <p className="cam-admin-meta" role="status">{t("previewChecksLoading")}</p>}
            {(diagnosticQuery.isError || (!diagnosticQuery.isLoading && !diagnostic && summary && !summary.validationDataAvailable)) && (
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

          {hasRole(role, SURVEY_ROLES) && status === "PENDING_REVIEW" && isActiveDossierClaimOwner(claimStateQuery.data, userId) && (
            <section className="cam-dossier-preview-decision" aria-labelledby="cam-dossier-preview-decision-heading">
              <h3 id="cam-dossier-preview-decision-heading" className="cam-dossier-preview-section-title">{tDetail("validateArchiveButton")}</h3>
              {!diagnosticsReady && <p className="cam-admin-meta">{tDetail("approvalChecksUnavailableOrBlocked")}</p>}
              {diagnosticsReady && hasBlockingIssues && <p className="cam-admin-notice cam-admin-notice--error" role="status">{tDetail("blockingIssuesMustBeResolved")}</p>}
              {canApproveHere && <Button type="button" className="cam-dossier-preview-approve" onClick={openApprovalConfirmation}>
                {tDetail("validateArchiveButton")}
              </Button>}
            </section>
          )}

          <DossierClaimPanel dossierId={dossierId} userId={userId} role={role} revision={dossierQuery.isFetching ? null : dossier?.revision ?? null} />
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
      eyebrow={t("previewReference", { id: dossier?.submissionId ?? summary?.submissionId ?? dossierId })}
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
            {approvalMutation.isPending ? tDetail("validating") : tDetail("confirmValidation")}
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
