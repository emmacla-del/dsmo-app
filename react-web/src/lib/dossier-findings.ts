/**
 * The workspace's « À vérifier » list: open findings, blocking before
 * advisory, each severity grouped by rule family in the order the families
 * first appear. The diagnostic returns open anomalies only, so there is no
 * resolution status to show here; a resolved or waived anomaly leaves the list.
 */
export interface DossierFinding {
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
