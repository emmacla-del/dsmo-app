"use client";

import { createContext, useContext } from "react";

/**
 * Lets Mode Guidé intercept wizard/section navigation so the summary table
 * opens for confirmation before leaving the section or table.
 */
export interface GuidedReviewHandle {
  tableId: string;
  isReviewing: boolean;
  allAnswered: boolean;
  openReview: () => void;
  exitReview: () => void;
  /**
   * One-question-per-screen stepping, driven by the wizard's bottom
   * Continuer / Précédent. Return true when the table handled the step
   * (moved to another question, showed a validation message, or opened /
   * closed its summary); false lets the section move to the next/previous table.
   */
  advance?: () => boolean;
  retreat?: () => boolean;
}

export interface GuidedReviewRegistry {
  register: (id: string, handle: GuidedReviewHandle) => void;
  unregister: (id: string) => void;
  getHandles: () => GuidedReviewHandle[];
}

export const GuidedReviewGateContext =
  createContext<GuidedReviewRegistry | null>(null);

export function useGuidedReviewGate() {
  return useContext(GuidedReviewGateContext);
}

