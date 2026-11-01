import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { assignDossier, getDossierClaimState } from "@/lib/api-client";
import { isDossierRevisionConflict } from "@/lib/dossier-review-state";

export function dossierClaimStateKey(id: string) {
  return ["admin", "dossier-claim-state", id] as const;
}

export function dossierReviewProgressKey(id: string) {
  return ["admin", "dossier-review-progress", id] as const;
}

/** What a claim change makes stale: the same set DossierClaimPanel refreshes. */
function claimRefreshKeys(id: string) {
  return [
    ["admin", "dossier", id],
    dossierClaimStateKey(id),
    dossierReviewProgressKey(id),
    ["admin", "diagnostic", id],
    ["admin", "questionnaires"],
    ["admin", "pilotage", "queues"],
  ] as const;
}

export function useDossierClaim(dossierId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("adminDossierPage");
  const [actionNotice, setActionNotice] = useState("");
  const claimStateQuery = useQuery({
    queryKey: dossierClaimStateKey(dossierId),
    queryFn: () => getDossierClaimState(dossierId),
    enabled: Boolean(dossierId),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const claimMutation = useMutation({
    retry: false,
    mutationFn: (assigneeId: string | null) => assignDossier(dossierId, assigneeId),
    onMutate: () => setActionNotice(""),
    onSuccess: async () => {
      setActionNotice(t("claimSaved"));
      await Promise.all(claimRefreshKeys(dossierId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: async (error: unknown) => {
      setActionNotice(isDossierRevisionConflict(error)
        ? t("claimConflict")
        : t("claimFailed", { message: error instanceof Error ? error.message : t("unknownError") }));
      if (isDossierRevisionConflict(error)) {
        await Promise.all(claimRefreshKeys(dossierId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      }
    },
  });
  return { claimStateQuery, claimMutation, actionNotice };
}
