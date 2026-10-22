import type { QuizAnswerRow } from "@/components/onefop/QuizAnswerReview";
import type { TrackerChipItem, TrackerRow } from "./ScopeTypes";

function chipText(value: string | TrackerChipItem): string {
  return typeof value === "string" ? value : value.tooltip || value.label;
}

function joinChips(values: (string | TrackerChipItem)[] | undefined): string {
  if (!values?.length) return "";
  return values.map(chipText).filter(Boolean).join(", ");
}

/** Convert employer-specific quiz answers to the shared review row shape. */
export function toQuizAnswerRows(
  rows: TrackerRow[],
  labels: Record<string, string>,
): QuizAnswerRow[] {
  return rows.map((row) => {
    const facets: QuizAnswerRow["facets"] = [];
    if (row.reponse !== "Non") {
      const typesText = joinChips(row.typesMotifs);
      if (typesText) {
        let facetLabel = labels.colTypes;
        if (row.mainId === "recruitment" || row.mainId === "primo_workers") facetLabel = labels.dimContracts;
        else if (row.mainId === "departures") facetLabel = labels.dimReasons;
        else if (row.mainId === "interns") facetLabel = labels.dimInternships;
        facets.push({ key: "types", label: facetLabel, value: typesText });
      }
      const groups = [
        ["personnels", labels.dimCategories, joinChips(row.personnels)],
        ["ages", labels.dimAges, joinChips(row.ages)],
        ["diplomes", labels.dimDiplomas, joinChips(row.diplomes)],
        ["autre", labels.dimSpecific, (row.autre ?? []).map(chipText).filter(Boolean).join(" · ")],
      ] as const;
      for (const [key, facetLabel, value] of groups) {
        if (value) facets.push({ key, label: facetLabel, value });
      }
    }

    return {
      id: row.mainId,
      title: row.title,
      answer: row.reponse === "Oui" ? "yes" : row.reponse === "Non" ? "no" : null,
      facets,
    };
  });
}