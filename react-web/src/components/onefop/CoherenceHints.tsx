"use client";

import { CoherenceReviewList } from "./coherence/Coherence";

/**
 * Kept for compatibility: coherence anomalies are now shown on the cells
 * themselves (CoherenceTd tooltips + CoherenceChip) and listed at the
 * review step. This renders that same review list from CoherenceProvider.
 */
export function CoherenceHints() {
  return <CoherenceReviewList />;
}
