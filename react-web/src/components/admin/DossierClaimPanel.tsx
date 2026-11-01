"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getDossierClaimState, saveDossierReviewProgress } from "@/lib/api-client";
import { canSaveDossierReviewProgress, isDossierRevisionConflict } from "@/lib/dossier-review-state";
import { dossierClaimStateKey, dossierReviewProgressKey } from "@/lib/use-dossier-claim";

interface DossierClaimPanelProps {
  dossierId: string;
  userId: string | null | undefined;
  role: string | null | undefined;
  revision: number | null;
}

export { dossierClaimStateKey, dossierReviewProgressKey };

/**
 * The review-progress note form. The claim lives in the workspace's decision
 * bar (DossierBarClaim) and the saved notes are listed in the workspace's
 * single « Notes et historique » list, so this component writes notes only.
 * Who may write is unchanged: the active claim holder, with a survey role and
 * a known revision (canSaveDossierReviewProgress); the server stays the guard.
 */
export function DossierClaimPanel({ dossierId, userId, role, revision }: DossierClaimPanelProps) {
  const t = useTranslations("adminDossierPage");
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

  const refreshDossierData = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", dossierId] }),
    queryClient.invalidateQueries({ queryKey: dossierClaimStateKey(dossierId) }),
    queryClient.invalidateQueries({ queryKey: dossierReviewProgressKey(dossierId) }),
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", dossierId] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] }),
  ]);

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

  const canSaveProgress = canSaveDossierReviewProgress(claimState, userId, role, revision);

  return (
    <div>
      {actionNotice && <p className="cam-admin-notice" role="status">{actionNotice}</p>}

      {canSaveProgress && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSaveDossierReviewProgress(claimState, userId, role, revision) || progressMutation.isPending || claimStateQuery.isFetching) return;
            progressMutation.mutate({ note: note.trim(), expectedRevision: revision });
          }}
          style={{ display: "grid", gap: "var(--cam-space-2)" }}
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
    </div>
  );
}
