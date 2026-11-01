"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  assignDossier,
  getDossierClaimState,
  listDossierReviewProgress,
  saveDossierReviewProgress,
} from "@/lib/api-client";
import { NOT_PROVIDED, stamp } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";
import {
  canChangeDossierClaim,
  canSaveDossierReviewProgress,
  isActiveDossierClaimOwner,
  isDossierRevisionConflict,
} from "@/lib/dossier-review-state";

interface DossierClaimPanelProps {
  dossierId: string;
  userId: string | null | undefined;
  role: string | null | undefined;
  revision: number | null;
}

export function dossierClaimStateKey(id: string) {
  return ["admin", "dossier-claim-state", id] as const;
}

export function dossierReviewProgressKey(id: string) {
  return ["admin", "dossier-review-progress", id] as const;
}

export function DossierClaimPanel({
  dossierId,
  userId,
  role,
  revision,
}: DossierClaimPanelProps) {
  const t = useTranslations("adminDossierPage");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const claimStateQuery = useQuery({
    queryKey: dossierClaimStateKey(dossierId),
    queryFn: () => getDossierClaimState(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: Infinity,
  });
  const claimState = claimStateQuery.data;

  const progressQuery = useQuery({
    queryKey: dossierReviewProgressKey(dossierId),
    queryFn: () => listDossierReviewProgress(dossierId),
    enabled: Boolean(dossierId),
  });

  const refreshDossierData = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", dossierId] }),
    queryClient.invalidateQueries({ queryKey: dossierClaimStateKey(dossierId) }),
    queryClient.invalidateQueries({ queryKey: dossierReviewProgressKey(dossierId) }),
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", dossierId] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] }),
  ]);

  const claimMutation = useMutation({
    retry: false,
    mutationFn: (assigneeId: string | null) => assignDossier(dossierId, assigneeId),
    onMutate: () => setActionNotice(""),
    onSuccess: () => {
      setActionNotice(t("claimSaved"));
      return refreshDossierData();
    },
    onError: (error: unknown) => {
      if (isDossierRevisionConflict(error)) {
        setActionNotice(t("claimConflict"));
        return refreshDossierData();
      }
      setActionNotice(t("claimFailed", { message: error instanceof Error ? error.message : t("unknownError") }));
    },
  });

  const progressMutation = useMutation({
    retry: false,
    mutationFn: (payload: { note: string; expectedRevision: number }) =>
      saveDossierReviewProgress(dossierId, payload.note, payload.expectedRevision),
    onMutate: () => setActionNotice(""),
    onSuccess: (result) => {
      if (Number.isSafeInteger(result.revision) && result.revision >= 0) {
        queryClient.setQueriesData({ queryKey: ["admin", "dossier", dossierId] }, (old: unknown) =>
          old && typeof old === "object" ? { ...old, revision: result.revision } : old,
        );
      }
      setNote("");
      setActionNotice(t("progressSaved"));
      return refreshDossierData();
    },
    onError: (error: unknown) => {
      if (isDossierRevisionConflict(error)) {
        setActionNotice(t("progressConflict"));
        return refreshDossierData();
      }
      setActionNotice(t("progressFailed", { message: error instanceof Error ? error.message : t("unknownError") }));
    },
  });

  const ownsClaim = isActiveDossierClaimOwner(claimState, userId);
  const canManageClaim = canChangeDossierClaim(claimState, userId, role);
  const canSaveProgress = canSaveDossierReviewProgress(claimState, userId, role, revision);
  const progressItems = progressQuery.data?.items ?? [];

  return (
    <section className="cam-dash-card" aria-labelledby="dossier-claim-title">
      <h2 id="dossier-claim-title" className="cam-dossier-card-title">{t("claimPanelTitle")}</h2>
      {claimStateQuery.isLoading ? (
        <p className="cam-admin-meta" role="status">{t("claimLoading")}</p>
      ) : claimStateQuery.isError ? (
        <p className="cam-admin-notice cam-admin-notice--error" role="alert">{t("claimStateFailed")}</p>
      ) : claimState ? (
        <>
          <p className="cam-admin-meta">
            <strong>{t("claimOwnerLabel")}:</strong>{" "}
            {claimState.assigneeId
              ? claimState.assigneeName ?? (claimState.assigneeId === userId ? t("claimYou") : NOT_PROVIDED)
              : t("claimUnassigned")}
          </p>
          {claimState.expired && <p className="cam-admin-notice" role="status">{t("claimExpired")}</p>}
          {!claimState.eligible && <p className="cam-admin-meta">{t("claimUnavailable")}</p>}
          {claimState.eligible && claimState.expiresAt && !claimState.expired && (
            <p className="cam-admin-meta">{t("claimExpiresAt", { date: stamp(claimState.expiresAt, true, locale) })}</p>
          )}
          {canManageClaim && userId && (
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              disabled={claimMutation.isPending || claimStateQuery.isFetching}
              onClick={() => {
                claimMutation.mutate(ownsClaim ? null : userId);
              }}
            >
              {claimMutation.isPending
                ? t("claimSaving")
                : ownsClaim
                  ? t("releaseClaim")
                  : t("claimForMe")}
            </button>
          )}
        </>
      ) : null}

      {actionNotice && <p className="cam-admin-notice" role="status">{actionNotice}</p>}

      {canSaveProgress && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSaveDossierReviewProgress(claimState, userId, role, revision) || progressMutation.isPending || claimStateQuery.isFetching) return;
            progressMutation.mutate({ note: note.trim(), expectedRevision: revision });
          }}
          style={{ display: "grid", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-3)" }}
        >
          <label className="cam-admin-label" htmlFor="dossier-progress-note">{t("progressNoteLabel")}</label>
          <textarea
            id="dossier-progress-note"
            className="cam-admin-textarea"
            minLength={10}
            maxLength={2000}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div>
            <button
              type="submit"
              className="cam-button cam-button-secondary cam-button-sm"
              disabled={claimStateQuery.isFetching || progressMutation.isPending || note.trim().length < 10 || note.trim().length > 2000}
            >
              {progressMutation.isPending ? t("progressSaving") : t("progressSave")}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: "var(--cam-space-3)" }}>
        <h3 className="cam-admin-label">{t("progressHistoryTitle")}</h3>
        {progressQuery.isLoading ? (
          <p className="cam-admin-meta" role="status">{t("progressLoading")}</p>
        ) : progressQuery.isError ? (
          <p className="cam-admin-meta" role="alert">{t("progressHistoryFailed")}</p>
        ) : progressItems.length === 0 ? (
          <p className="cam-admin-meta">{t("progressEmpty")}</p>
        ) : (
          <ul className="cam-dossier-history">
            {progressItems.map((item) => (
              <li key={item.id}>
                <span className="cam-dossier-history-dot" aria-hidden="true" />
                <div>
                  <strong>{stamp(item.createdAt, true, locale)}</strong>
                  <p className="cam-dossier-note">{item.note ?? (item.progressType === "ANOMALY_RESOLVED"
                    ? t("progressAnomalyResolved", { id: item.anomalyId ?? "" })
                    : t("progressActivityRecorded"))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
