"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getOwnClaimLapses, ownLapseCount, type ClaimLapseKind } from "@/lib/claim-lapses";

/**
 * The officer's own missed deadlines, on the queue they work from: « 2
 * réclamations ont expiré sans décision ces 30 derniers jours ». Their own
 * figure only; colleagues never see it, supervisors read it on the team page
 * (CLAUDE.md §21, 2026-11-09). Says nothing when there is nothing to say, or
 * when the server is older than the count (a refused read is not « zero »).
 */
export function OwnClaimLapseNote({ kind, enabled = true }: { kind: ClaimLapseKind; enabled?: boolean }) {
  const t = useTranslations("adminClaimLapses");
  const query = useQuery({
    queryKey: ["claims", "lapses", "me"],
    queryFn: getOwnClaimLapses,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const lapsed = ownLapseCount(query.data, kind);
  if (!query.data || lapsed === 0) return null;
  return (
    <p className="cam-claim-lapse-note" role="note">
      {t(kind === "registrations" ? "ownRegistrations" : "ownSubmissions", { count: lapsed, days: query.data.days })}
    </p>
  );
}
