// Training-centre (VT) advisory coherence, shown while the tables are filled.
//
// The server compares 4.2 with the entrants of 4.7 and of 4.8, and the
// leavers of 4.7 with 4.10 (checkVtCoherence,
// src/questionnaires/questionnaires.service.ts). Those comparisons set
// different populations or reference periods side by side and await domain
// review, so they stay ADVISORY (CLAUDE.md §7): never a blocking error, and
// never mixed with the blocking same-population checks of vt-cross-table.ts.
//
// The rules stay on the server, the one source: the wizard asks
// POST /onefop/coherence-preview (previewCoherence) and only decides here
// which flag belongs on which table screen, and when asking is worth it.
import type { FormData, OnefopField } from "./onefop-schema";
import type { CoherenceFlag } from "./onefop-submission";
import { missingVtTableCells } from "./vt-quiz";

/** The two tables each advisory rule compares, in paper order. */
export const VT_ADVISORY_COHERENCE_TABLES: Readonly<Record<string, readonly [string, string]>> = {
  VT_TRAINEE_AGE_ENTRANT_MISMATCH: ["VT4_2", "VT4_7"],
  VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH: ["VT4_2", "VT4_8"],
  VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH: ["VT4_7", "VT4_10"],
};

/** The paper number of each table taking part. */
export const VT_ADVISORY_TABLE_CODES: Readonly<Record<string, string>> = {
  VT4_2: "4.2",
  VT4_7: "4.7",
  VT4_8: "4.8",
  VT4_10: "4.10",
};

/**
 * The server's flags the wizard shows on the table screens: the advisory
 * rules only. The server also returns the same-population rules (4.1/4.2,
 * 8.1/8.2…), which the wizard already blocks on itself (vt-cross-table.ts):
 * saying them again in amber would contradict the red message.
 */
export function vtAdvisoryFlags(flags: readonly CoherenceFlag[]): CoherenceFlag[] {
  return flags.filter((f) => f.code in VT_ADVISORY_COHERENCE_TABLES);
}

/**
 * What the advisory check reads, as one string that changes exactly when a
 * cell of 4.2, 4.7, 4.8 or 4.10 changes; null while no compared pair is
 * complete. Like vt-cross-table.ts, a comparison waits for both of its
 * tables: while a table still has cells to fill, asking would only report
 * a total the respondent has not finished typing.
 */
export function vtAdvisoryCheckKey(fields: readonly OnefopField[], data: FormData): string | null {
  const tables = new Map<string, OnefopField>();
  for (const f of fields) if (f.id in VT_ADVISORY_TABLE_CODES) tables.set(f.id, f);
  const complete = (id: string) => {
    const field = tables.get(id);
    return !!field && missingVtTableCells(field, data).length === 0;
  };
  const anyPairComplete = Object.values(VT_ADVISORY_COHERENCE_TABLES).some(([a, b]) => complete(a) && complete(b));
  if (!anyPairComplete) return null;
  const values: unknown[] = [];
  for (const id of Object.keys(VT_ADVISORY_TABLE_CODES)) {
    for (const row of tables.get(id)?.table?.matrix ?? []) {
      for (const cell of row) values.push(data[cell] ?? null);
    }
  }
  return JSON.stringify(values);
}

export interface VtAdvisoryItem {
  flag: CoherenceFlag;
  /** The compared table(s) not on screen, to open from the notice. */
  otherTables: Array<{ code: string; fieldId: string }>;
}

/** The advisory flags that concern a table on screen, each with the other table it names. */
export function vtAdvisoryItemsForTables(
  flags: readonly CoherenceFlag[],
  onScreenFieldIds: readonly string[],
): VtAdvisoryItem[] {
  const onScreen = new Set(onScreenFieldIds);
  const items: VtAdvisoryItem[] = [];
  for (const flag of flags) {
    const pair = VT_ADVISORY_COHERENCE_TABLES[flag.code];
    if (!pair || !pair.some((id) => onScreen.has(id))) continue;
    items.push({
      flag,
      otherTables: pair
        .filter((id) => !onScreen.has(id))
        .map((fieldId) => ({ code: VT_ADVISORY_TABLE_CODES[fieldId], fieldId })),
    });
  }
  return items;
}
