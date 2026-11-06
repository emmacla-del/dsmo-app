import { collectionPeriodFromQuarterCode } from '../campaign/campaign-period.helper';

export interface PeriodFile {
  quarterCode?: string | null;
  submissionDate: Date;
}

/**
 * The file to compare a submission with: the same establishment's endorsed file
 * for the latest round that ended before this one began. `candidates` come
 * newest filed first, so ties go to the latest filing.
 *
 * The round is read from each file's own code, because filing order does not
 * follow it: a correction of T3 can be filed after T4 was endorsed. Two
 * campaigns of one quarter (…_T4_001 and …_T4_002) are the same round, so neither
 * is the other's previous period. Only when a round cannot be read does filing
 * date decide: a file with no readable code, or a current file without one.
 */
export function pickPreviousPeriod<T extends PeriodFile & { id: string }>(
  current: PeriodFile,
  candidates: readonly T[],
): string | null {
  const earlierFiling = candidates.find((file) => file.submissionDate < current.submissionDate);
  const round = collectionPeriodFromQuarterCode(current.quarterCode);
  if (!round) return earlierFiling?.id ?? null;

  let best: { id: string; end: number } | null = null;
  for (const file of candidates) {
    const period = collectionPeriodFromQuarterCode(file.quarterCode);
    if (!period || period.periodEnd >= round.periodStart) continue;
    if (!best || period.periodEnd.getTime() > best.end) best = { id: file.id, end: period.periodEnd.getTime() };
  }
  if (best) return best.id;
  const unreadable = candidates.find(
    (file) => !collectionPeriodFromQuarterCode(file.quarterCode) && file.submissionDate < current.submissionDate,
  );
  return unreadable?.id ?? null;
}
