/**
 * The workspace's single « Notes et historique » list: the file's own
 * milestones (received, decided) and the reviewers' progress notes, newest
 * first. A step is shown only for a timestamp the record carries.
 */
export interface DossierHistoryEntry {
  key: string;
  title: string;
  detail: string | null;
  /** Display date, already formatted. */
  stamp: string;
  /** History dot modifier (is-current, is-rejected or none). */
  dot: string;
  /** ISO date used only for ordering. */
  at: string;
}

export interface DossierProgressItem {
  id: string;
  createdAt: string;
  note: string | null;
  progressType: string;
  anomalyId: string | null;
}

export function mergeDossierHistory(
  milestones: DossierHistoryEntry[],
  progressItems: DossierProgressItem[],
  describe: {
    noteTitle: string;
    anomalyResolved: (anomalyId: string) => string;
    activityRecorded: string;
    stamp: (iso: string) => string;
  },
): DossierHistoryEntry[] {
  const notes = progressItems.map((item): DossierHistoryEntry => ({
    key: `note-${item.id}`,
    title: describe.noteTitle,
    detail: item.note
      ?? (item.progressType === "ANOMALY_RESOLVED" ? describe.anomalyResolved(item.anomalyId ?? "") : describe.activityRecorded),
    stamp: describe.stamp(item.createdAt),
    dot: "",
    at: item.createdAt,
  }));
  const time = (iso: string) => {
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? 0 : value;
  };
  // Newest first; a tie keeps the milestone before the note written with it.
  return [...milestones, ...notes]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => time(b.entry.at) - time(a.entry.at) || a.index - b.index)
    .map(({ entry }) => entry);
}
