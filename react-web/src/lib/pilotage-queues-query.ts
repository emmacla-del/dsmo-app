import { getPilotageQueuesForView } from "@/lib/api-client";

/** Every queue-count query starts with this, so one invalidation reaches them all. */
export const PILOTAGE_QUEUES_KEY = ["admin", "pilotage", "queues"] as const;

/**
 * The queue counts, as every admin screen reads them. The shell, the page
 * header, the pilotage page and the dossier list all want the same figures, so
 * they share this key and a page opens with one request instead of two. Each
 * request is several database reads on the server, and the page's other calls
 * queue behind them.
 */
export function pilotageQueuesOptions(view: "queue" | "completed" = "queue", includeArchived = false) {
  return {
    queryKey: [...PILOTAGE_QUEUES_KEY, view, includeArchived] as const,
    queryFn: () => getPilotageQueuesForView(view, includeArchived),
    staleTime: 60_000,
  };
}
