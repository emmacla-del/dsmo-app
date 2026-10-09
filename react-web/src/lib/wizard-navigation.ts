// Pure navigation helpers shared by the ONEFOP declaration wizards
// (ModernJobsWizard for the non-VT entities, WizardShell for training
// centres). No React, no DOM access at import time — unit-tested with
// `npm test` (wizard-navigation.test.ts).

/** The minimum a field needs to be matched against a validation issue. */
export interface IssueOwnerField {
  id: string;
  paperCode?: string | null;
  type?: string;
  table?: { id?: string | null; matrix?: string[][] | null } | null;
}

/**
 * Whether `field` is the field a validation issue belongs to.
 *
 * Issues carry a `fieldId` that is either the field itself (its id or paper
 * code), or — for statistical tables — a single cell key. Cell keys are
 * prefixed by the field id, the paper code or the table id followed by "_"
 * (e.g. "s4q1_doctorat_male" for VT4_1 / table s4q1), and are always listed
 * in the table's matrix. Comparison is case-insensitive.
 */
export function fieldOwnsIssue(field: IssueOwnerField, issueFieldId: string): boolean {
  const issueId = issueFieldId.toLowerCase();
  const id = field.id.toLowerCase();
  const paperCode = field.paperCode?.toLowerCase();
  const tableId = field.table?.id?.toLowerCase();
  if (id === issueId || (paperCode && paperCode === issueId)) return true;
  if (issueId.startsWith(id + "_")) return true;
  if (paperCode && issueId.startsWith(paperCode + "_")) return true;
  if (tableId && issueId.startsWith(tableId + "_")) return true;
  return !!field.table?.matrix?.some((row) => row.some((cell) => cell.toLowerCase() === issueId));
}

/** The first field of `fields` that owns the issue, if any. */
export function findIssueOwner<F extends IssueOwnerField>(fields: readonly F[], issueFieldId: string): F | undefined {
  return fields.find((f) => fieldOwnsIssue(f, issueFieldId));
}

/** The section (index + owning field) that holds an issue, or null. */
export function locateIssue<F extends IssueOwnerField>(
  sections: readonly { fields: readonly F[] }[],
  issueFieldId: string,
): { sectionIndex: number; field: F } | null {
  for (let i = 0; i < sections.length; i++) {
    const field = findIssueOwner(sections[i].fields, issueFieldId);
    if (field) return { sectionIndex: i, field };
  }
  return null;
}

/** Whether an owner field is a statistical table (switches the table deck). */
export function isTableField(field: IssueOwnerField | undefined): boolean {
  return !!field && (!!field.table || field.type === "table");
}

/**
 * Where the non-VT preliminary quiz sits in the section sequence: right
 * after the section whose id starts with "section1" (section1_entreprise,
 * section1_projectProgram, ...). Null when the entity has no such section
 * or it is the last one.
 */
export function preliminaryQuizSlot(
  sections: readonly { id: string }[],
): { previousSectionIndex: number; nextSectionIndex: number } | null {
  const idx = sections.findIndex((s) => /^section1(?![0-9])/i.test(s.id));
  if (idx === -1 || idx + 1 >= sections.length) return null;
  return { previousSectionIndex: idx, nextSectionIndex: idx + 1 };
}

/** One element lookup in the issue focus chain. */
export type IssueFocusCandidate = { kind: "id"; value: string } | { kind: "name"; value: string };

/**
 * The ordered lookups that find the element to focus for a validation
 * issue: the issue's own element first (plain field, `field-` wrapper, form
 * control name, table cell input, guided table), then the owning table's
 * wrapper and guided view. Duplicates are removed, order is kept.
 */
export function issueFocusCandidates(issueFieldId: string, ownerId?: string | null): IssueFocusCandidate[] {
  const out: IssueFocusCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: IssueFocusCandidate) => {
    const key = `${c.kind}:${c.value}`;
    if (!c.value || seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  push({ kind: "id", value: issueFieldId });
  push({ kind: "id", value: `field-${issueFieldId}` });
  push({ kind: "name", value: issueFieldId });
  push({ kind: "id", value: `cell-input-${issueFieldId}` });
  push({ kind: "id", value: `guided-table-${issueFieldId}` });
  if (ownerId) {
    push({ kind: "id", value: ownerId });
    push({ kind: "id", value: `guided-table-${ownerId}` });
    push({ kind: "id", value: `field-${ownerId}` });
  }
  return out;
}

/** The first candidate `lookup` resolves, in chain order. */
export function resolveFirstCandidate<T>(
  candidates: readonly IssueFocusCandidate[],
  lookup: (candidate: IssueFocusCandidate) => T | null | undefined,
): T | null {
  for (const c of candidates) {
    const found = lookup(c);
    if (found) return found;
  }
  return null;
}

/** The parts of a wizard step the polite live region announces. */
export type WizardStepDescriptor =
  | { kind: "section"; index: number; total: number; title: string }
  | { kind: "label"; label: string }
  | { kind: "none" };

/**
 * Live-region text for a wizard step. Sections go through `formatSection`
 * (a localized message such as "{title} ({current} of {total})"), with a
 * 1-based position and whitespace-collapsed title; a quiz or review step is
 * announced by its label.
 */
export function wizardStepAnnouncement(
  step: WizardStepDescriptor,
  formatSection: (values: { current: number; total: number; title: string }) => string,
): string {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  if (step.kind === "label") return clean(step.label);
  if (step.kind === "section") {
    return clean(formatSection({ current: step.index + 1, total: step.total, title: clean(step.title) }));
  }
  return "";
}
