/**
 * The workspace's « À vérifier » list: open findings, blocking before
 * advisory, each severity grouped by rule family in the order the families
 * first appear. The diagnostic returns open anomalies only, so there is no
 * resolution status to show here; a resolved or waived anomaly leaves the list.
 */
export interface DossierFinding {
  /** The stored anomaly row, which the resolve route acts on. */
  id?: string;
  ruleCode: string;
  ruleFamily?: string | null;
  description?: string | null;
  observedValue?: unknown;
  expectedValue?: unknown;
}

export type DossierFindingSeverity = "blocking" | "warning";

export interface DossierFindingGroup<T extends DossierFinding = DossierFinding> {
  severity: DossierFindingSeverity;
  /** Null when the anomaly carries no family. */
  family: string | null;
  findings: T[];
}

/**
 * Whether J / K may act on this key press. Single-letter shortcuts stay inside
 * the findings and the review panel (WCAG 2.1.4): anywhere else on the page a
 * stray letter, from dictation say, must do nothing. Never while typing.
 */
export function findingKeysApply(target: Element | null): boolean {
  if (!target || (target as HTMLElement).isContentEditable) return false;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return false;
  return target.closest("[id^='finding-'], #dossier-review-panel") !== null;
}

export function groupDossierFindings<T extends DossierFinding>(blocking: T[], warnings: T[]): DossierFindingGroup<T>[] {
  const bySeverity = (severity: DossierFindingSeverity, findings: T[]) => {
    const groups = new Map<string | null, T[]>();
    for (const finding of findings) {
      const family = finding.ruleFamily?.trim() || null;
      const group = groups.get(family);
      if (group) group.push(finding);
      else groups.set(family, [finding]);
    }
    return [...groups].map(([family, items]) => ({ severity, family, findings: items }));
  };
  return [...bySeverity("blocking", blocking), ...bySeverity("warning", warnings)];
}

export type FindingSex = "male" | "female" | "total";

/**
 * The sex a stored employer warning is about: the server writes its figures as
 * « (S22Q03: 0, male) » (employer rules) or « (4.1: 12, hommes) » (VT rules).
 */
export function findingSex(description: string | null | undefined): FindingSex | null {
  const match = /\([^():]+:\s*\d+,\s*(male|female|total|hommes|femmes)\)/i.exec(String(description ?? ""));
  if (!match) return null;
  const word = match[1].toLowerCase();
  return word === "male" || word === "hommes" ? "male" : word === "female" || word === "femmes" ? "female" : "total";
}

export interface MergedFinding<T extends DossierFinding = DossierFinding> {
  ruleCode: string;
  /** The first anomaly of the rule, for its wording. */
  finding: T;
  /** Every stored anomaly the rule raised, men before women before total. */
  anomalies: T[];
  /** One line per sex the rule fired for, men before women before total. */
  rows: Array<{ sex: FindingSex | null; observed: unknown; expected: unknown }>;
}

/**
 * The same rule fired once per sex is one problem, not three: merged into one
 * finding with a line per sex, so « À vérifier » counts what the reviewer must
 * look at.
 */
export function mergeSameRule<T extends DossierFinding>(findings: T[]): MergedFinding<T>[] {
  const order: Record<string, number> = { male: 0, female: 1, total: 2 };
  const merged = new Map<string, MergedFinding<T>>();
  for (const finding of findings) {
    const row = { sex: findingSex(finding.description), observed: finding.observedValue, expected: finding.expectedValue };
    const existing = merged.get(finding.ruleCode);
    if (existing) {
      existing.rows.push(row);
      existing.anomalies.push(finding);
    } else merged.set(finding.ruleCode, { ruleCode: finding.ruleCode, finding, anomalies: [finding], rows: [row] });
  }
  const rank = (sex: FindingSex | null) => order[sex ?? ""] ?? 3;
  for (const entry of merged.values()) {
    entry.rows.sort((a, b) => rank(a.sex) - rank(b.sex));
    entry.anomalies.sort((a, b) => rank(findingSex(a.description)) - rank(findingSex(b.description)));
  }
  return [...merged.values()];
}
