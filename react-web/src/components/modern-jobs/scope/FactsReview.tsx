"use client";

import { useTranslations } from "next-intl";
import { QuizAnswerReview } from "@/components/onefop/QuizAnswerReview";
import type { TrackerRow, PrimaryQuestionId, BeatDefinition } from "./ScopeTypes";
import { toQuizAnswerRows } from "./FactsTracker";

interface FactsReviewProps {
  rows: TrackerRow[];
  onSelectBeat: (beat: BeatDefinition) => void;
  hasDroppedDataWarning: boolean;
  onConfirmProceed: () => void;
}

/** Employer quiz data adapter for the shared answer review. */
export function FactsReview({
  rows,
  onSelectBeat,
  hasDroppedDataWarning,
  onConfirmProceed,
}: FactsReviewProps) {
  const t = useTranslations("modernJobs.factsReview");
  const tFacts = useTranslations("modernJobs.facts");

  return (
    <QuizAnswerReview
      rows={toQuizAnswerRows(rows, {
        colTypes: tFacts("colTypes"),
        dimContracts: tFacts("dimContracts"),
        dimReasons: tFacts("dimReasons"),
        dimInternships: tFacts("dimInternships"),
        dimCategories: tFacts("dimCategories"),
        dimAges: tFacts("dimAges"),
        dimDiplomas: tFacts("dimDiplomas"),
        dimSpecific: tFacts("dimSpecific"),
      })}
      warning={hasDroppedDataWarning ? t("warning") : undefined}
      onSelect={(id) => onSelectBeat({ mainId: id as PrimaryQuestionId })}
      onProceed={onConfirmProceed}
    />
  );
}
