// src/lib/onefop-formulas.ts
//
// Ported from lib/core/focus/utils/table_calculator.dart (the formulas) and
// lib/core/focus/renderers/table_spec_builder.dart (the real, on-screen
// cell-ID/column structure — NOT lib/core/focus/compiler/
// form_schema_compiler.dart's GridSchema, which turned out to be
// keyboard-navigation-only and to disagree with table_spec_builder.dart in
// several confirmed ways; see the per-function notes below for exactly
// where and why). "sum-of-siblings" is the one formula kind confirmed to
// exist anywhere in the ONEFOP domain — do not add other computation kinds
// here without the same level of source verification.

export type CellValues = Record<string, number>;

const GENDERS = ["male", "female", "total"] as const;
const AGE_BANDS = ["15_24", "25_34", "35_plus"] as const;

function num(values: CellValues, key: string): number {
  return values[key] ?? 0;
}

// ── Matrix builders — mirror table_spec_builder.dart's own cell-id
// builders (_genderAgeRow, _statusGenderRow, _genderRow) exactly, since
// that file is what actually renders the grid the user sees, and it does
// not always agree with FormSchemaCompiler's GridSchema (extracted into
// onefop.schema.json's `table.matrix`). Building the matrix here directly
// — rather than trusting the extracted matrix — removes that discrepancy
// as a source of bugs, at the cost of this being a second (documented,
// verified) place these shapes live.

export function genderAgeRow(prefix: string, rowKey: string): string[] {
  const ids: string[] = [];
  for (const g of GENDERS) {
    for (const age of AGE_BANDS) ids.push(`${prefix}_${rowKey}_${g}_${age}`);
    ids.push(`${prefix}_${rowKey}_${g}_total`);
  }
  return ids;
}

export function genderRow(prefix: string, rowKey: string): string[] {
  return GENDERS.map((g) => `${prefix}_${rowKey}_${g}`);
}

/** table_spec_builder.dart's _statusGenderRow — THREE status groups
 * (permanent/temporary/total), not the two form_schema_compiler.dart's
 * GridSchema has. Confirmed by direct inspection of _buildCspStatusGender
 * and _buildVulnerableNamedRows, both of which render this 9-cell shape,
 * not the 6-cell one this file shipped with previously. */
export function statusGenderRow(prefix: string, rowKey: string): string[] {
  const ids: string[] = [];
  for (const status of ["permanent", "temporary", "total"] as const) {
    for (const g of GENDERS) ids.push(`${prefix}_${rowKey}_${status}_${g}`);
  }
  return ids;
}

export function typeGenderRow(prefix: string, rowKey: string, types: readonly string[]): string[] {
  const ids: string[] = [];
  for (const type of types) for (const g of GENDERS) ids.push(`${prefix}_${rowKey}_${type}_${g}`);
  return ids;
}

/**
 * Mirrors TableCalculator.recalculateCspGenderAge exactly — confirmed
 * matching table_spec_builder.dart's _buildCspGenderAge/_buildDiploma (both
 * use this exact row×gender×age shape with a trailing "total" row).
 */
export function recalculateCspGenderAge(
  current: CellValues,
  prefix: string,
  rows: string[],
): CellValues {
  const updated: CellValues = { ...current };

  for (const row of rows) {
    for (const gender of GENDERS) {
      if (gender === "total") continue;
      let sum = 0;
      for (const age of AGE_BANDS) sum += num(updated, `${prefix}_${row}_${gender}_${age}`);
      updated[`${prefix}_${row}_${gender}_total`] = sum;
    }
  }

  for (const row of rows) {
    for (const age of AGE_BANDS) {
      const male = num(updated, `${prefix}_${row}_male_${age}`);
      const female = num(updated, `${prefix}_${row}_female_${age}`);
      updated[`${prefix}_${row}_total_${age}`] = male + female;
    }
  }

  for (const row of rows) {
    let sum = 0;
    for (const age of AGE_BANDS) sum += num(updated, `${prefix}_${row}_total_${age}`);
    updated[`${prefix}_${row}_total_total`] = sum;
  }

  for (const gender of GENDERS) {
    if (gender === "total") continue;
    for (const age of AGE_BANDS) {
      let sum = 0;
      for (const row of rows) sum += num(updated, `${prefix}_${row}_${gender}_${age}`);
      updated[`${prefix}_total_${gender}_${age}`] = sum;
    }
    let genderSum = 0;
    for (const age of AGE_BANDS) genderSum += num(updated, `${prefix}_total_${gender}_${age}`);
    updated[`${prefix}_total_${gender}_total`] = genderSum;
  }

  for (const age of AGE_BANDS) {
    let sum = 0;
    for (const gender of GENDERS) {
      if (gender === "total") continue;
      sum += num(updated, `${prefix}_total_${gender}_${age}`);
    }
    updated[`${prefix}_total_total_${age}`] = sum;
  }

  let grandTotal = 0;
  for (const gender of GENDERS) {
    if (gender === "total") continue;
    grandTotal += num(updated, `${prefix}_total_${gender}_total`);
  }
  updated[`${prefix}_total_total_total`] = grandTotal;

  return updated;
}

export function isComputedCspCell(cellId: string): boolean {
  // "total" covers most cells here. departure_table's 5th column group is
  // named "ensemble" (whole) rather than "total": table_spec_builder.dart's
  // own _cell()/_isTotal() would technically leave it enabled (_isTotal
  // only matches "_total"), but recalculateDeparture always overwrites it
  // from its siblings on every change regardless — so treating it as
  // computed/read-only here matches the actual DATA behavior (never
  // independently settable) even though Flutter's widget doesn't disable
  // the input. Flagging this nuance rather than silently picking a side.
  const id = cellId.toLowerCase();
  return id.includes("total") || id.includes("ensemble");
}

/**
 * Mirrors TableCalculator.recalculateCspStatusGender IN FULL — corrected
 * from an earlier version of this file that only ported the first two
 * blocks (per-row status totals, per-column status totals) on the mistaken
 * assumption that the combined "Total" status group wasn't part of the
 * rendered grid. It is: table_spec_builder.dart's _statusGenderRow
 * produces THREE status groups (permanent/temporary/total), and this
 * function's remaining two blocks are exactly what populate that third
 * group's cells. Used for both csp_status_gender_table (S22Q04) and
 * vulnerable_named_rows_table (S22Q05) — table_spec_builder.dart's
 * _buildCspStatusGender and _buildVulnerableNamedRows both call
 * _statusGenderRow, so both share this one function.
 */
const STATUSES = ["permanent", "temporary"] as const;

export function recalculateCspStatusGender(
  current: CellValues,
  prefix: string,
  rows: string[],
): CellValues {
  const updated: CellValues = { ...current };

  for (const row of rows) {
    for (const status of STATUSES) {
      let sum = 0;
      for (const gender of GENDERS) {
        if (gender === "total") continue;
        sum += num(updated, `${prefix}_${row}_${status}_${gender}`);
      }
      updated[`${prefix}_${row}_${status}_total`] = sum;
    }
    for (const gender of GENDERS) {
      let sum = 0;
      for (const status of STATUSES) sum += num(updated, `${prefix}_${row}_${status}_${gender}`);
      updated[`${prefix}_${row}_total_${gender}`] = sum;
    }
  }

  for (const status of STATUSES) {
    for (const gender of GENDERS) {
      let sum = 0;
      for (const row of rows) sum += num(updated, `${prefix}_${row}_${status}_${gender}`);
      updated[`${prefix}_total_${status}_${gender}`] = sum;
    }
  }

  for (const gender of GENDERS) {
    let sum = 0;
    for (const status of STATUSES) sum += num(updated, `${prefix}_total_${status}_${gender}`);
    updated[`${prefix}_total_total_${gender}`] = sum;
  }

  return updated;
}

/**
 * Mirrors TableCalculator.recalculateDeparture exactly (S3Q01) — confirmed
 * matching table_spec_builder.dart's _buildDeparture (same 5 type-groups
 * incl. computed "ensemble", same trailing "total" row).
 */
const DEPARTURE_TYPES = ["dismissal", "resignation", "retirement", "other", "ensemble"] as const;

export function recalculateDeparture(current: CellValues, prefix: string, rows: string[]): CellValues {
  const updated: CellValues = { ...current };

  for (const row of rows) {
    for (const type of DEPARTURE_TYPES) {
      if (type === "ensemble") continue;
      let sum = 0;
      for (const gender of GENDERS) {
        if (gender === "total") continue;
        sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      }
      updated[`${prefix}_${row}_${type}_total`] = sum;
    }
    for (const gender of GENDERS) {
      let sum = 0;
      for (const type of DEPARTURE_TYPES) {
        if (type === "ensemble") continue;
        sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      }
      updated[`${prefix}_${row}_ensemble_${gender}`] = sum;
    }
  }

  for (const type of DEPARTURE_TYPES) {
    for (const gender of GENDERS) {
      let sum = 0;
      for (const row of rows) sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      updated[`${prefix}_total_${type}_${gender}`] = sum;
    }
  }

  return updated;
}

/**
 * Mirrors TableCalculator.recalculateDismissalUnemployment exactly
 * (S3Q03) — confirmed matching table_spec_builder.dart's
 * _buildDismissalUnemployment (3 type-groups incl. computed "total").
 */
const DU_TYPES = ["dismissal", "technical_unemployment"] as const;

export function recalculateDismissalUnemployment(
  current: CellValues,
  prefix: string,
  rows: string[],
): CellValues {
  const updated: CellValues = { ...current };

  for (const row of rows) {
    for (const type of DU_TYPES) {
      let sum = 0;
      for (const gender of GENDERS) {
        if (gender === "total") continue;
        sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      }
      updated[`${prefix}_${row}_${type}_total`] = sum;
    }
    for (const gender of GENDERS) {
      let sum = 0;
      for (const type of DU_TYPES) sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      updated[`${prefix}_${row}_total_${gender}`] = sum;
    }
  }

  for (const type of DU_TYPES) {
    for (const gender of GENDERS) {
      let sum = 0;
      for (const row of rows) sum += num(updated, `${prefix}_${row}_${type}_${gender}`);
      updated[`${prefix}_total_${type}_${gender}`] = sum;
    }
  }

  for (const gender of GENDERS) {
    let sum = 0;
    for (const type of DU_TYPES) sum += num(updated, `${prefix}_total_${type}_${gender}`);
    updated[`${prefix}_total_total_${gender}`] = sum;
  }

  return updated;
}

/**
 * Adapted from TableCalculator.recalculateFirstTimeWorkers (S23Q02), with
 * one deliberate correction: the Dart source writes its per-contract
 * summary row to `${contract}_subtotal_...`, but table_spec_builder.dart's
 * _buildFirstTimeWorkers — the function that actually renders this
 * table — builds that same row's cell IDs as `${contract}_total_...`
 * instead (see its line `_genderAgeRow(prefix, '${c}_total')`). Those two
 * Dart files disagree with each other; since the rendered row is what a
 * real user's data lives under, this port computes into `_total_`, not
 * `_subtotal_`, matching what's actually on screen. Flagging this as a
 * likely Flutter-side bug (the calculator appears to write to a key
 * nothing displays) rather than silently picking one.
 */
const CONTRACTS = ["permanent", "temporary"] as const;

export function recalculateFirstTimeWorkers(
  current: CellValues,
  prefix: string,
  rows: string[],
): CellValues {
  const updated: CellValues = { ...current };

  for (const contract of CONTRACTS) {
    for (const row of rows) {
      for (const gender of GENDERS) {
        if (gender === "total") continue;
        let sum = 0;
        for (const age of AGE_BANDS) sum += num(updated, `${prefix}_${contract}_${row}_${gender}_${age}`);
        updated[`${prefix}_${contract}_${row}_${gender}_total`] = sum;
      }
    }
    for (const row of rows) {
      for (const age of AGE_BANDS) {
        let sum = 0;
        for (const gender of GENDERS) {
          if (gender === "total") continue;
          sum += num(updated, `${prefix}_${contract}_${row}_${gender}_${age}`);
        }
        updated[`${prefix}_${contract}_${row}_total_${age}`] = sum;
      }
    }
    for (const row of rows) {
      let sum = 0;
      for (const age of AGE_BANDS) sum += num(updated, `${prefix}_${contract}_${row}_total_${age}`);
      updated[`${prefix}_${contract}_${row}_total_total`] = sum;
    }
    for (const gender of GENDERS) {
      if (gender === "total") continue;
      for (const age of AGE_BANDS) {
        let sum = 0;
        for (const row of rows) sum += num(updated, `${prefix}_${contract}_${row}_${gender}_${age}`);
        updated[`${prefix}_${contract}_total_${gender}_${age}`] = sum;
      }
      let sum = 0;
      for (const age of AGE_BANDS) sum += num(updated, `${prefix}_${contract}_total_${gender}_${age}`);
      updated[`${prefix}_${contract}_total_${gender}_total`] = sum;
    }
    for (const age of AGE_BANDS) {
      let sum = 0;
      for (const gender of GENDERS) {
        if (gender === "total") continue;
        sum += num(updated, `${prefix}_${contract}_total_${gender}_${age}`);
      }
      updated[`${prefix}_${contract}_total_total_${age}`] = sum;
    }
    let sum = 0;
    for (const gender of GENDERS) {
      if (gender === "total") continue;
      sum += num(updated, `${prefix}_${contract}_total_${gender}_total`);
    }
    updated[`${prefix}_${contract}_total_total_total`] = sum;
  }

  return updated;
}

/**
 * VT tables' one confirmed formula (verified this session: all 15
 * formula-bearing cells across VT's tables are exactly this pattern) — a
 * "computed" cell's value is the sum of its row's "number"-kind sibling
 * cells (e.g. total = male + female). Generic across every vt_* template
 * because VtCellDef.kind is itself already a uniform abstraction in
 * Flutter — no per-template config needed, unlike the classic tables.
 * Assumes exactly one computed value per row (every table checked this
 * session fits that shape); a future template with a genuinely different
 * per-row computation would need its own function, not a silent stretch
 * of this one.
 */
export function recalculateVtRow(
  rowCellIds: string[],
  cellKinds: string[],
  current: CellValues,
): CellValues {
  const updated: CellValues = { ...current };
  let sum = 0;
  for (let i = 0; i < rowCellIds.length; i++) {
    if (cellKinds[i] === "number") sum += num(updated, rowCellIds[i]);
  }
  for (let i = 0; i < rowCellIds.length; i++) {
    if (cellKinds[i] === "computed") updated[rowCellIds[i]] = sum;
  }
  return updated;
}

/** kpi_period_table has no computed cells at all — table_spec_builder
 * .dart's _buildKpiPeriod comment confirms "no computed total row/column
 * (the paper form has none)". Every cell is plain user input; this is a
 * no-op so TableRenderer's dispatch can still use one uniform recalc
 * signature without pretending a formula exists where none does. */
export function recalculateNone(current: CellValues): CellValues {
  return current;
}

/** Mirrors TableCalculator.recalculateInternship exactly — row × gender
 * only, no age dimension. Also reused as-is for reasons_table,
 * skills_table, and training_table, which table_spec_builder.dart's
 * _buildReasons/_buildSkills/_buildTraining all build with this identical
 * _genderRow shape (row × male/female/total), just different row keys. */
export function recalculateGenderOnly(current: CellValues, prefix: string, rows: string[]): CellValues {
  const updated: CellValues = { ...current };

  for (const row of rows) {
    let sum = 0;
    for (const gender of GENDERS) {
      if (gender === "total") continue;
      sum += num(updated, `${prefix}_${row}_${gender}`);
    }
    updated[`${prefix}_${row}_total`] = sum;
  }

  for (const gender of GENDERS) {
    let sum = 0;
    for (const row of rows) sum += num(updated, `${prefix}_${row}_${gender}`);
    updated[`${prefix}_total_${gender}`] = sum;
  }

  return updated;
}
