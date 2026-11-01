/**
 * The figures a stored VT coherence warning compares, read from its text.
 * The server writes each VT rule as « … (4.1: 12, hommes) … (4.2: 10,
 * hommes). » (QuestionnairesService.checkVtCoherence), so the warning carries
 * both tables and both totals; after a re-check (2026-11-01) they are the
 * current rules' figures. VT rules compare whole-table totals by sex, not
 * single cells, so the review marks the tables and lists the totals.
 */
export interface VtFigure {
  /** The table's paper number, as the review shows it (« 4.5 »). */
  code: string;
  /** How the warning names it (« 4.5 FI », « 4.7 entrants »). */
  label: string;
  value: number;
  sex: "male" | "female";
}

const FIGURE = /\(((\d+(?:\.\d+)+)[^:()]*?):\s*(\d+),\s*(hommes|femmes)\)/g;

export function vtFindingFigures(description: string | null | undefined): VtFigure[] {
  const figures: VtFigure[] = [];
  for (const match of String(description ?? "").matchAll(FIGURE)) {
    figures.push({ label: match[1].trim(), code: match[2], value: Number(match[3]), sex: match[4] === "hommes" ? "male" : "female" });
  }
  return figures;
}

/** The anchor a VT table carries in the workspace, from its paper number. */
export function vtTableAnchor(code: string): string {
  return `dossier-vt-${code.replace(/\./g, "-")}`;
}
