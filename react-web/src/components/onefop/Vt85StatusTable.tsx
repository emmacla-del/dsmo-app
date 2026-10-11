"use client";

import { useCallback, useMemo } from "react";
import type { FormData } from "@/lib/onefop-schema";
import { useEntryMode } from "@/lib/use-entry-mode";
import { EntryModeSwitch } from "./EntryModeSwitch";
import { AdaptiveStatisticalTable } from "./tables/AdaptiveStatisticalTable";
import { buildVt85TrainerStatusDefinition } from "./tables/StatisticalTableDefinition";

/** 8.5's six schema fields: status (part-time vocational, part-time non-vocational, permanent) × sex. */
export const VT85_FIELD_IDS = [
  "VT8_5_VP_M",
  "VT8_5_VP_F",
  "VT8_5_VNP_M",
  "VT8_5_VNP_F",
  "VT8_5_PERM_M",
  "VT8_5_PERM_F",
] as const;

const SAVED = new Set<string>(VT85_FIELD_IDS);

/**
 * 8.5 Trainers by professional status: the schema's six number fields shown
 * as one status × sex table, Tableau or Guidé like the other VT tables.
 *
 * Only the six fields are ever written. The row totals are shown, not saved:
 * the schema has no total field for 8.5, so a total key would reach the
 * declaration as data no questionnaire variable describes.
 */
export function Vt85StatusTable({
  data,
  onChange,
  issueMessages,
}: {
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  /** Validation messages of the six fields, by field id (shown only after an attempt). */
  issueMessages: Map<string, string>;
}) {
  const [entryMode, setEntryMode] = useEntryMode();

  const definition = useMemo(
    // Built without a field: the six fields' labels are per-cell ("… — hommes"),
    // so the table keeps its own 8.5 title. A recalc that returns nothing: no
    // total is written by the guided entry's batch commit.
    () => ({ ...buildVt85TrainerStatusDefinition(), recalc: () => ({}) }),
    [],
  );

  const shown = useMemo(() => {
    const out: FormData = { ...data };
    for (const row of definition.rows) {
      let sum = 0;
      let any = false;
      for (const cell of Object.values(row.cells)) {
        if (cell.kind !== "number") continue;
        const raw = data[cell.fieldKey];
        if (raw === undefined || raw === null || raw === "") continue;
        const n = Number(raw);
        if (Number.isFinite(n)) {
          sum += n;
          any = true;
        }
      }
      const total = Object.values(row.cells).find((c) => c.kind === "computed");
      if (total) out[total.fieldKey] = any ? sum : null;
    }
    return out;
  }, [data, definition]);

  // The guided entry writes a total with its split; only the six fields are kept.
  const save = useCallback(
    (key: string, value: unknown) => {
      if (SAVED.has(key)) onChange(key, value);
    },
    [onChange],
  );

  const firstIssueId = VT85_FIELD_IDS.find((id) => issueMessages.has(id));
  const messages = VT85_FIELD_IDS.flatMap((id) => (issueMessages.has(id) ? [issueMessages.get(id)!] : []));

  return (
    // In Tableau each cell has its own id (cell-input-…); in Guidé this
    // wrapper is what "go to the first problem" finds.
    <div id={`field-${firstIssueId ?? VT85_FIELD_IDS[0]}`} tabIndex={-1} style={{ outline: "none" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <EntryModeSwitch mode={entryMode} onChange={setEntryMode} />
      </div>
      <AdaptiveStatisticalTable
        definition={definition}
        data={shown}
        onChange={save}
        mode={entryMode}
        onModeChange={setEntryMode}
        tableFieldId="VT8_5"
      />
      {messages.length > 0 && (
        <ul
          role="alert"
          style={{
            margin: "var(--cam-space-2) 0 0",
            paddingLeft: "var(--cam-space-5)",
            color: "var(--cam-error)",
            fontSize: "var(--cam-font-size-sm)",
          }}
        >
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
