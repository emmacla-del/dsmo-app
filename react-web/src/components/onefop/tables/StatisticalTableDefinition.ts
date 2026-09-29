// src/components/onefop/tables/StatisticalTableDefinition.ts

import type { FormData, LocalizedText, OnefopField } from "@/lib/onefop-schema";
import { SEX_COLUMN_LABELS } from "@/lib/onefop-tables";

export type StatisticalTableType =
  | "fixed-matrix"
  | "dynamic-rows"
  | "nominal-roster";

export type StatisticalCellKind =
  | "number"
  | "text"
  | "computed"
  | "readonly"
  | "select";

export interface StatisticalCellDefinition {
  key: string;
  fieldKey: string;
  kind: StatisticalCellKind;
  required?: boolean;
  min?: number;
  max?: number;
  formula?: "sum-of-siblings" | string;
}

export interface StatisticalColumnDefinition {
  key: string;
  header: LocalizedText;
  subHeader?: LocalizedText;
  kind: StatisticalCellKind;
  align?: "left" | "center" | "right";
  width?: string | number;
  group?: LocalizedText;
}

export interface StatisticalRowDefinition {
  id: string;
  label: LocalizedText;
  code?: string;
  isTotal?: boolean;
  isSubtotal?: boolean;
  cells: Record<string, StatisticalCellDefinition>;
  /**
   * Free-text label typed by the respondent for this row (reasons / skill or
   * training domains), bound to the AST's own text field — e.g.
   * S3Q02_REASON_1_TEXT. Used by Guided mode to ask for the text with the count.
   */
  labelText?: { fieldKey: string; label: LocalizedText; placeholder: LocalizedText };
}

export interface HeaderGroupDefinition {
  title: LocalizedText;
  colSpan: number;
}

export type CalculationPersistenceMode = "materialized" | "derived" | "none";

export type CalculationFunction = (
  current: Record<string, number>,
  prefix: string,
  rows: string[]
) => Record<string, number>;

export interface StatisticalCalculationDefinition {
  mode: CalculationPersistenceMode;
  sourceFieldKeys?: string[];
  computedFieldKeys?: string[];
  calculate: CalculationFunction;
}

export type TablePresentationMode = "grid" | "guided";

/**
 * Explicit strategy metadata defining presentation capabilities and preferences for a statistical table.
 */
export interface AdaptiveStrategyMetadata {
  /** Explicit preferred presentation mode. */
  preferredMode?: TablePresentationMode;
  /** Whether the table is suitable for tabular spreadsheet rendering. Default true for fixed-matrix. */
  gridSuitable?: boolean;
  /** Whether the table is suitable for step-by-step card entry. Default true for fixed-matrix. */
  guidedSuitable?: boolean;
  /** Whether the respondent is permitted to manually toggle between modes. Default true if both suitable. */
  allowUserToggle?: boolean;
  /** Recommended mode for narrow/mobile viewports (<768px). */
  mobileMode?: TablePresentationMode;
  /** Recommended mode for wide/desktop viewports (>=768px). */
  desktopMode?: TablePresentationMode;
}

export interface AdaptiveDecision {
  /** The final active presentation mode to render ("grid" | "guided") */
  mode: TablePresentationMode;
  /** Whether the definition can be rendered as a Grid */
  canGrid: boolean;
  /** Whether the definition can be rendered as Guided cards */
  canGuided: boolean;
  /** Whether the user is allowed to toggle presentation modes */
  allowToggle: boolean;
  /** Architectural rationale for this decision */
  reason: string;
}

export interface AdaptiveContext {
  /** Viewport indicator: true if mobile (<768px), false if desktop (>=768px), undefined if SSR */
  isMobile?: boolean;
  /** Optional manual user override */
  userOverride?: TablePresentationMode | null;
}

/**
 * Resolves the presentation mode and capability flags for a statistical table definition.
 *
 * Implements the Phase 8 Adaptive Strategy:
 * 1. Checks renderer capabilities (gridSuitable, guidedSuitable).
 * 2. Checks user override if user toggle is permitted.
 * 3. Checks explicit desktop/mobile product preferences.
 * 4. Applies structural complexity heuristics when explicit viewport preferences are not defined:
 *    - Wide tables (>4 columns or multi-tier header groups) default to "guided" on mobile.
 *    - Compact tables (<=4 columns without header groups) default to "grid" on mobile.
 *    - Desktop defaults to "grid" for high-efficiency direct keyboard entry.
 */
export function resolveAdaptiveStrategy(
  definition: FixedMatrixDefinition,
  context?: AdaptiveContext
): AdaptiveDecision {
  const adaptive = definition.adaptive;
  const canGrid = adaptive?.gridSuitable ?? true;
  const canGuided = adaptive?.guidedSuitable ?? true;

  // Degenerate case: neither mode marked suitable
  if (!canGrid && !canGuided) {
    return {
      mode: "grid",
      canGrid: false,
      canGuided: false,
      allowToggle: false,
      reason: "Degenerate configuration: neither mode marked suitable, falling back to grid",
    };
  }

  // Single capability case
  if (!canGrid) {
    return {
      mode: "guided",
      canGrid: false,
      canGuided: true,
      allowToggle: false,
      reason: "Guided entry is the only supported renderer for this table",
    };
  }
  if (!canGuided) {
    return {
      mode: "grid",
      canGrid: true,
      canGuided: false,
      allowToggle: false,
      reason: "Grid table is the only supported renderer for this table",
    };
  }

  const allowToggle = adaptive?.allowUserToggle ?? true;

  // Manual user override
  if (allowToggle && context?.userOverride) {
    if (context.userOverride === "grid" && canGrid) {
      return {
        mode: "grid",
        canGrid,
        canGuided,
        allowToggle,
        reason: "User explicitly selected Grid presentation",
      };
    }
    if (context.userOverride === "guided" && canGuided) {
      return {
        mode: "guided",
        canGrid,
        canGuided,
        allowToggle,
        reason: "User explicitly selected Guided presentation",
      };
    }
  }

  // Viewport-based resolution
  if (context?.isMobile === true) {
    // Mobile viewport
    if (adaptive?.mobileMode) {
      return {
        mode: adaptive.mobileMode,
        canGrid,
        canGuided,
        allowToggle,
        reason: `Explicit mobile presentation mode '${adaptive.mobileMode}' from definition metadata`,
      };
    }
    if (definition.defaultMobileView) {
      return {
        mode: definition.defaultMobileView,
        canGrid,
        canGuided,
        allowToggle,
        reason: `Legacy defaultMobileView '${definition.defaultMobileView}' from definition`,
      };
    }
    // Complexity heuristic for mobile
    const isComplex =
      definition.columns.length > 4 ||
      Boolean(definition.headerGroups && definition.headerGroups.length > 0);
    if (isComplex) {
      return {
        mode: "guided",
        canGrid,
        canGuided,
        allowToggle,
        reason: `Table has ${definition.columns.length} columns and header groups; defaulting to Guided cards on mobile to avoid horizontal panning fatigue`,
      };
    }
    return {
      mode: "grid",
      canGrid,
      canGuided,
      allowToggle,
      reason: `Compact table (${definition.columns.length} columns); defaulting to Grid on mobile`,
    };
  }

  if (context?.isMobile === false) {
    // Desktop viewport
    if (adaptive?.desktopMode) {
      return {
        mode: adaptive.desktopMode,
        canGrid,
        canGuided,
        allowToggle,
        reason: `Explicit desktop presentation mode '${adaptive.desktopMode}' from definition metadata`,
      };
    }
    if (adaptive?.preferredMode) {
      return {
        mode: adaptive.preferredMode,
        canGrid,
        canGuided,
        allowToggle,
        reason: `Preferred presentation mode '${adaptive.preferredMode}' from definition metadata`,
      };
    }
    return {
      mode: "grid",
      canGrid,
      canGuided,
      allowToggle,
      reason: "Defaulting to Grid on desktop for efficient spreadsheet entry",
    };
  }

  // Viewport unspecified (e.g. SSR)
  if (adaptive?.preferredMode) {
    return {
      mode: adaptive.preferredMode,
      canGrid,
      canGuided,
      allowToggle,
      reason: `Preferred presentation mode '${adaptive.preferredMode}' from definition metadata`,
    };
  }
  if (definition.defaultMobileView === "guided") {
    return {
      mode: "guided",
      canGrid,
      canGuided,
      allowToggle,
      reason: "Initial render using defaultMobileView 'guided'",
    };
  }

  return {
    mode: "grid",
    canGrid,
    canGuided,
    allowToggle,
    reason: "Default initial presentation mode is Grid",
  };
}

export interface BaseStatisticalTableDefinition {
  id: string;
  paperCode: string;
  title: LocalizedText;
  caption?: LocalizedText;
  rowHeaderLabel?: LocalizedText;
  defaultMobileView?: "grid" | "guided";
  calculationMode?: CalculationPersistenceMode;
  adaptive?: AdaptiveStrategyMetadata;
}

export interface FixedMatrixDefinition extends BaseStatisticalTableDefinition {
  type: "fixed-matrix";
  rowHeaderLabel: LocalizedText;
  headerGroups?: HeaderGroupDefinition[];
  columns: StatisticalColumnDefinition[];
  rows: StatisticalRowDefinition[];
  hasTotalRow?: boolean;
  totalRowLabel?: LocalizedText;
  rawRows?: string[];
  recalc?: CalculationFunction;
  calculation?: StatisticalCalculationDefinition;
  /** When defined, table supports switching across multiple CSP slices (e.g. S22Q03 4D) */
  cspSlices?: string[];
  activeCsp?: string;
  onSelectCsp?: (csp: string) => void;
  buildRowsForCsp?: (csp: string) => StatisticalRowDefinition[];
  recalcForCsp?: (csp: string) => CalculationFunction;
}

export type StatisticalTableCompletion = "not-started" | "in-progress" | "complete";

/**
 * Whether a fixed-matrix statistical table has actually been filled in.
 *
 * This is the single source of truth for table completion — it inspects the
 * table's own entry cells rather than proxying through `data[field.id]`,
 * which is never set for a table-shaped field (its data lives under many
 * separately-keyed cell fields instead, e.g. `s21q01_cadres_15_24_masculin`).
 * Total/subtotal rows and computed/readonly cells are excluded since they
 * are never user-entered. Every place in the wizard that needs to know
 * "is this table done" (the table's own status badge, the section's step
 * pills, its completed-tables count, its per-card status chip) should call
 * this rather than re-deriving its own heuristic, so they can't drift out
 * of sync with each other.
 */
export function getStatisticalTableCompletion(
  definition: FixedMatrixDefinition,
  data: FormData
): StatisticalTableCompletion {
  const enterableCells: string[] = [];
  const rows = (definition.cspSlices?.length && definition.buildRowsForCsp)
    ? definition.cspSlices.flatMap((csp) => definition.buildRowsForCsp!(csp))
    : definition.rows;
  for (const row of rows) {
    if (row.isTotal || row.isSubtotal) continue;
    for (const cell of Object.values(row.cells)) {
      if (cell.kind === "computed" || cell.kind === "readonly") continue;
      enterableCells.push(cell.fieldKey);
    }
  }
  if (enterableCells.length === 0) return "complete";

  const answeredCount = enterableCells.filter((fieldKey) => {
    const v = data[fieldKey];
    return v !== undefined && v !== null && v !== "";
  }).length;

  if (answeredCount === 0) return "not-started";
  if (answeredCount === enterableCells.length) return "complete";
  return "in-progress";
}

export interface DynamicRowsTableDefinition extends BaseStatisticalTableDefinition {
  type: "dynamic-rows";
  columns: StatisticalColumnDefinition[];
  maxRows?: number;
  minRows?: number;
  rowTemplate: {
    cells: Record<string, StatisticalCellDefinition>;
  };
  rowLabelPrefix?: LocalizedText;
}

export type RosterFieldKind = "text" | "number" | "select" | "boolean" | "radio";

export interface RosterFieldOption {
  value: string;
  code?: string;
  label: LocalizedText;
}

export interface RosterFieldDefinition {
  key: string;
  label: LocalizedText;
  kind: RosterFieldKind;
  required?: boolean;
  options?: RosterFieldOption[];
  placeholder?: LocalizedText;
  helpText?: LocalizedText;
  min?: number;
  max?: number;
}

export interface RosterRowSlot {
  slotIndex: number;
  rowId: string;
  label?: LocalizedText;
  cellKeys: Record<string, string>;
}

export interface NominalRosterDefinition extends BaseStatisticalTableDefinition {
  type: "nominal-roster";
  rosterCapacity: number;
  primaryKeyField: string;
  fields: RosterFieldDefinition[];
  slots: RosterRowSlot[];
  recordNoun?: LocalizedText;
  singularRecordNoun?: LocalizedText;
  emptyStateMessage?: LocalizedText;
  removeConfirmationMessage?: LocalizedText;
  titleBuilder?: (recordValues: Record<string, unknown>) => string;
  subtitleBuilder?: (recordValues: Record<string, unknown>) => string;
  // Backwards compatibility:
  columns?: StatisticalColumnDefinition[];
  idFieldKey?: string;
  fieldsPerRow?: string[];
}

export type StatisticalTableDefinition =
  | FixedMatrixDefinition
  | DynamicRowsTableDefinition
  | NominalRosterDefinition;

export interface TableDefinitionValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  field?: string;
}

export interface TableDefinitionValidationResult {
  valid: boolean;
  errors: TableDefinitionValidationIssue[];
  warnings: TableDefinitionValidationIssue[];
}

/**
 * Development-time validation helper for StatisticalTableDefinitions.
 * Catches duplicate IDs, key collisions, missing labels, and structural inconsistencies.
 */
export function validateStatisticalTableDefinition(
  def: StatisticalTableDefinition
): TableDefinitionValidationResult {
  const errors: TableDefinitionValidationIssue[] = [];
  const warnings: TableDefinitionValidationIssue[] = [];

  // 1. Basic identification
  if (!def.id || typeof def.id !== "string") {
    errors.push({ severity: "error", code: "MISSING_ID", message: "Table definition must have an id" });
  }
  if (!def.title?.fr && !def.title?.en) {
    errors.push({ severity: "error", code: "MISSING_TITLE", message: "Table definition must have a localized title" });
  }
  if (!def.rowHeaderLabel?.fr && !def.rowHeaderLabel?.en) {
    warnings.push({ severity: "warning", code: "MISSING_ROW_HEADER", message: "Table definition should have a rowHeaderLabel" });
  }

  // 2. Fixed Matrix Validation
  if (def.type === "fixed-matrix") {
    // Unique Column Keys
    const colKeys = new Set<string>();
    for (const col of def.columns) {
      if (colKeys.has(col.key)) {
        errors.push({
          severity: "error",
          code: "DUPLICATE_COLUMN_KEY",
          message: `Duplicate column key: ${col.key}`,
          field: col.key,
        });
      }
      colKeys.add(col.key);
      if (!col.header?.fr && !col.header?.en) {
        errors.push({
          severity: "error",
          code: "MISSING_COLUMN_HEADER",
          message: `Column ${col.key} is missing a localized header`,
          field: col.key,
        });
      }
    }

    // Header groups check
    if (def.headerGroups && def.headerGroups.length > 0) {
      const totalColSpan = def.headerGroups.reduce((acc, hg) => acc + hg.colSpan, 0);
      const ungroupedCols = def.columns.filter((col) => !col.group).length;
      if (totalColSpan + ungroupedCols !== def.columns.length && totalColSpan !== def.columns.length) {
        errors.push({
          severity: "error",
          code: "INVALID_HEADER_GROUP_SPAN",
          message: `Total header group colSpan (${totalColSpan}) plus ungrouped columns (${ungroupedCols}) does not equal column count (${def.columns.length})`,
        });
      }
    }

    // Unique Row IDs & Cell Consistency
    const rowIds = new Set<string>();
    const seenFieldKeys = new Set<string>();

    for (const row of def.rows) {
      if (rowIds.has(row.id)) {
        errors.push({
          severity: "error",
          code: "DUPLICATE_ROW_ID",
          message: `Duplicate row id: ${row.id}`,
          field: row.id,
        });
      }
      rowIds.add(row.id);

      if (!row.label?.fr && !row.label?.en) {
        errors.push({
          severity: "error",
          code: "MISSING_ROW_LABEL",
          message: `Row ${row.id} is missing a localized label`,
          field: row.id,
        });
      }

      for (const col of def.columns) {
        const cell = row.cells[col.key];
        if (!cell) {
          warnings.push({
            severity: "warning",
            code: "MISSING_CELL",
            message: `Row ${row.id} has no cell for column ${col.key}`,
            field: `${row.id}.${col.key}`,
          });
          continue;
        }

        if (!cell.fieldKey) {
          errors.push({
            severity: "error",
            code: "MISSING_FIELD_KEY",
            message: `Cell ${row.id}.${col.key} missing fieldKey`,
            field: `${row.id}.${col.key}`,
          });
        } else {
          if (seenFieldKeys.has(cell.fieldKey)) {
            errors.push({
              severity: "error",
              code: "DUPLICATE_FIELD_KEY",
              message: `Duplicate fieldKey in FormData: ${cell.fieldKey}`,
              field: cell.fieldKey,
            });
          }
          seenFieldKeys.add(cell.fieldKey);
        }
      }
    }

    // Check rawRows reference validity
    if (def.rawRows) {
      for (const rKey of def.rawRows) {
        if (!rowIds.has(rKey)) {
          errors.push({
            severity: "error",
            code: "INVALID_RAW_ROW_REF",
            message: `rawRows references '${rKey}' which does not exist in rows`,
            field: rKey,
          });
        }
      }
    }

    // Calculation Dependency & Contract Validation
    const editableKeys = new Set<string>();
    const computedKeys = new Set<string>();

    for (const row of def.rows) {
      for (const col of def.columns) {
        const cell = row.cells[col.key];
        if (!cell || !cell.fieldKey) continue;
        if (cell.kind === "number") {
          editableKeys.add(cell.fieldKey);
        } else if (cell.kind === "computed") {
          if (computedKeys.has(cell.fieldKey)) {
            errors.push({
              severity: "error",
              code: "DUPLICATE_COMPUTED_KEY",
              message: `Duplicate computed fieldKey: ${cell.fieldKey}`,
              field: cell.fieldKey,
            });
          }
          computedKeys.add(cell.fieldKey);
        }
      }
    }

    // Input/output overlap check
    for (const k of computedKeys) {
      if (editableKeys.has(k)) {
        errors.push({
          severity: "error",
          code: "INPUT_OUTPUT_OVERLAP",
          message: `Field key '${k}' is marked as both editable input and computed output`,
          field: k,
        });
      }
    }

    // Calculation mode consistency
    const calcMode = def.calculationMode ?? "materialized";
    const hasCalculationFn = Boolean(def.recalc || def.calculation?.calculate);

    if (calcMode === "none") {
      if (hasCalculationFn) {
        errors.push({
          severity: "error",
          code: "INCONSISTENT_CALCULATION_MODE",
          message: `Table with calculationMode 'none' must not define a calculation function`,
        });
      }
      if (computedKeys.size > 0) {
        errors.push({
          severity: "error",
          code: "INCONSISTENT_CALCULATION_MODE",
          message: `Table with calculationMode 'none' must not contain computed cells`,
        });
      }
    } else if (computedKeys.size > 0 && !hasCalculationFn) {
      // Check if row-level sum-of-siblings formulas are present
      const hasSiblingFormulas = def.rows.some((r) =>
        Object.values(r.cells).some((c) => c.kind === "computed" && c.formula === "sum-of-siblings")
      );
      if (!hasSiblingFormulas) {
        errors.push({
          severity: "error",
          code: "MISSING_CALCULATION_FUNCTION",
          message: `Table has ${computedKeys.size} computed cells but no calculation function (recalc) was provided`,
        });
      }
    }

    // Explicit calculation metadata checks (if def.calculation is provided)
    if (def.calculation) {
      if (def.calculation.sourceFieldKeys) {
        for (const srcKey of def.calculation.sourceFieldKeys) {
          if (!seenFieldKeys.has(srcKey)) {
            errors.push({
              severity: "error",
              code: "INPUT_KEY_NOT_IN_TABLE",
              message: `Calculation sourceFieldKey '${srcKey}' does not exist in table`,
              field: srcKey,
            });
          }
        }
      }
      if (def.calculation.computedFieldKeys) {
        for (const outKey of def.calculation.computedFieldKeys) {
          if (!seenFieldKeys.has(outKey)) {
            errors.push({
              severity: "error",
              code: "COMPUTED_KEY_NOT_IN_TABLE",
              message: `Calculation computedFieldKey '${outKey}' does not exist in table`,
              field: outKey,
            });
          }
        }
      }
    }
  } else if (def.type === "nominal-roster") {
    if (!def.rosterCapacity || def.rosterCapacity <= 0) {
      errors.push({
        severity: "error",
        code: "INVALID_ROSTER_CAPACITY",
        message: "Nominal roster must have a positive rosterCapacity",
      });
    }

    if (!def.primaryKeyField) {
      errors.push({
        severity: "error",
        code: "MISSING_PRIMARY_KEY_FIELD",
        message: "Nominal roster must define a primaryKeyField",
      });
    } else if (!def.fields.some((f) => f.key === def.primaryKeyField)) {
      errors.push({
        severity: "error",
        code: "PRIMARY_KEY_NOT_IN_FIELDS",
        message: `primaryKeyField '${def.primaryKeyField}' is not defined in fields`,
      });
    }

    const fieldKeys = new Set<string>();
    for (const f of def.fields) {
      if (fieldKeys.has(f.key)) {
        errors.push({
          severity: "error",
          code: "DUPLICATE_FIELD_KEY",
          message: `Duplicate roster field key: ${f.key}`,
        });
      }
      fieldKeys.add(f.key);

      if (!f.label?.fr && !f.label?.en) {
        errors.push({
          severity: "error",
          code: "MISSING_FIELD_LABEL",
          message: `Roster field '${f.key}' missing localized label`,
        });
      }

      if ((f.kind === "select" || f.kind === "radio") && (!f.options || f.options.length === 0)) {
        errors.push({
          severity: "error",
          code: "MISSING_FIELD_OPTIONS",
          message: `Roster field '${f.key}' of kind '${f.kind}' must define non-empty options`,
        });
      }
    }

    if (def.slots.length !== def.rosterCapacity) {
      errors.push({
        severity: "error",
        code: "SLOT_CAPACITY_MISMATCH",
        message: `Slot count (${def.slots.length}) does not match rosterCapacity (${def.rosterCapacity})`,
      });
    }

    const rowIds = new Set<string>();
    const seenCellKeys = new Set<string>();
    for (const slot of def.slots) {
      if (rowIds.has(slot.rowId)) {
        errors.push({
          severity: "error",
          code: "DUPLICATE_ROW_ID",
          message: `Duplicate roster slot rowId: ${slot.rowId}`,
        });
      }
      rowIds.add(slot.rowId);

      for (const f of def.fields) {
        const cellKey = slot.cellKeys[f.key];
        if (!cellKey) {
          errors.push({
            severity: "error",
            code: "MISSING_SLOT_CELL_KEY",
            message: `Slot ${slot.rowId} is missing cellKey for field '${f.key}'`,
          });
        } else {
          if (seenCellKeys.has(cellKey)) {
            errors.push({
              severity: "error",
              code: "DUPLICATE_FORM_DATA_KEY",
              message: `Duplicate cellKey across slots: ${cellKey}`,
            });
          }
          seenCellKeys.add(cellKey);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface StatisticalCellClassification {
  totalCells: number;
  editableCount: number;
  computedCount: number;
  editableFieldKeys: string[];
  computedFieldKeys: string[];
}

export function extractStatisticalCellClassification(
  def: FixedMatrixDefinition
): StatisticalCellClassification {
  const editableFieldKeys: string[] = [];
  const computedFieldKeys: string[] = [];

  for (const row of def.rows) {
    for (const col of def.columns) {
      const cell = row.cells[col.key];
      if (!cell || !cell.fieldKey) continue;
      if (cell.kind === "number") {
        editableFieldKeys.push(cell.fieldKey);
      } else if (cell.kind === "computed") {
        computedFieldKeys.push(cell.fieldKey);
      }
    }
  }

  return {
    totalCells: editableFieldKeys.length + computedFieldKeys.length,
    editableCount: editableFieldKeys.length,
    computedCount: computedFieldKeys.length,
    editableFieldKeys,
    computedFieldKeys,
  };
}

/**
 * Builds the official StatisticalTableDefinition for Section 4.1
 * (Apprenants par diplôme académique le plus élevé).
 * Maps directly to the real schema field keys: s4q1_<rowKey>_<gender>.
 */
export function buildSection41Definition(field: OnefopField): FixedMatrixDefinition {
  const vt = field.table?.vt;
  const matrix = field.table?.matrix;

  const rowDefs: StatisticalRowDefinition[] = (vt?.rows ?? []).map((r, rIdx) => {
    const maleKey = matrix?.[rIdx]?.[0] ?? `${r.id}_male`;
    const femaleKey = matrix?.[rIdx]?.[1] ?? `${r.id}_female`;
    const totalKey = matrix?.[rIdx]?.[2] ?? `${r.id}_total`;

    return {
      id: r.id,
      label: r.label ?? { fr: r.id, en: r.id },
      cells: {
        male: {
          key: "male",
          fieldKey: maleKey,
          kind: "number",
          min: 0,
        },
        female: {
          key: "female",
          fieldKey: femaleKey,
          kind: "number",
          min: 0,
        },
        total: {
          key: "total",
          fieldKey: totalKey,
          kind: "computed",
          formula: "sum-of-siblings",
        },
      },
    };
  });

  return {
    id: "s4q1",
    paperCode: field.paperCode ?? "4.1",
    title: field.label ?? {
      fr: "Effectifs des apprenants par diplôme académique le plus élevé",
      en: "Number of trainees per academic qualification",
    },
    caption: {
      fr: "Répartition des apprenants selon le diplôme académique d'entrée et le sexe",
      en: "Distribution of trainees by entrance academic diploma and sex",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Diplôme d'entrée",
      en: "Entry Qualification",
    },
    headerGroups: [
      {
        title: { fr: "Sexe", en: "Sex" },
        colSpan: 2,
      },
    ],
    columns: [
      {
        key: "male",
        header: SEX_COLUMN_LABELS.male,
        kind: "number",
        align: "right",
        width: 130,
        group: { fr: "Sexe", en: "Sex" },
      },
      {
        key: "female",
        header: SEX_COLUMN_LABELS.female,
        kind: "number",
        align: "right",
        width: 130,
        group: { fr: "Sexe", en: "Sex" },
      },
      {
        key: "total",
        header: { fr: "Σ Total", en: "Σ Total" },
        kind: "computed",
        align: "right",
        width: 130,
      },
    ],
    rows: rowDefs,
    hasTotalRow: true,
    totalRowLabel: {
      fr: "TOTAL GÉNÉRAL",
      en: "GRAND TOTAL",
    },
    defaultMobileView: "grid", // Section 4.1 is only 3 columns, perfectly usable as a scrollable grid on mobile!
    calculationMode: "materialized",
  };
}

/**
 * Authoritative definition for VT 8.5 trainer status distribution:
 * "Effectifs des formateurs par statut professionnel" (Table 8.5 in official PDF page 17).
 * 3 official rows: Vacataires professionnels, Vacataires non professionnels, Permanents.
 */
export function buildVt85TrainerStatusDefinition(
  field?: OnefopField
): FixedMatrixDefinition {
  const paperCode = field?.paperCode ?? "8.5";
  const rows: StatisticalRowDefinition[] = [
    {
      id: "vacataires_pro",
      label: {
        fr: "Formateurs vacataires professionnels",
        en: "Part-time vocational trainers",
      },
      cells: {
        male: {
          key: "male",
          fieldKey: "VT8_5_VP_M",
          kind: "number",
          min: 0,
        },
        female: {
          key: "female",
          fieldKey: "VT8_5_VP_F",
          kind: "number",
          min: 0,
        },
        total: {
          key: "total",
          fieldKey: "VT8_5_VP_TOTAL",
          kind: "computed",
          formula: "sum-of-siblings",
        },
      },
    },
    {
      id: "vacataires_non_pro",
      label: {
        fr: "Formateurs vacataires non professionnels",
        en: "Part-time non-vocational trainers",
      },
      cells: {
        male: {
          key: "male",
          fieldKey: "VT8_5_VNP_M",
          kind: "number",
          min: 0,
        },
        female: {
          key: "female",
          fieldKey: "VT8_5_VNP_F",
          kind: "number",
          min: 0,
        },
        total: {
          key: "total",
          fieldKey: "VT8_5_VNP_TOTAL",
          kind: "computed",
          formula: "sum-of-siblings",
        },
      },
    },
    {
      id: "permanents",
      label: {
        fr: "Formateurs Permanents",
        en: "Permanent trainers",
      },
      cells: {
        male: {
          key: "male",
          fieldKey: "VT8_5_PERM_M",
          kind: "number",
          min: 0,
        },
        female: {
          key: "female",
          fieldKey: "VT8_5_PERM_F",
          kind: "number",
          min: 0,
        },
        total: {
          key: "total",
          fieldKey: "VT8_5_PERM_TOTAL",
          kind: "computed",
          formula: "sum-of-siblings",
        },
      },
    },
  ];

  return {
    id: "s8q5",
    paperCode,
    title: field?.label ?? {
      fr: "8.5 Effectifs des formateurs par statut professionnel",
      en: "8.5 Number of trainers per occupational status",
    },
    caption: {
      fr: "Répartition des formateurs par statut professionnel et par sexe",
      en: "Distribution of trainers by occupational status and sex",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Statut",
      en: "Status",
    },
    headerGroups: [
      {
        title: { fr: "Effectifs", en: "Numbers" },
        colSpan: 3,
      },
    ],
    columns: [
      {
        key: "male",
        header: SEX_COLUMN_LABELS.male,
        kind: "number",
        align: "right",
        width: 130,
      },
      {
        key: "female",
        header: SEX_COLUMN_LABELS.female,
        kind: "number",
        align: "right",
        width: 130,
      },
      {
        key: "total",
        header: { fr: "Σ Total", en: "Σ Total" },
        kind: "computed",
        align: "right",
        width: 130,
      },
    ],
    rows,
    hasTotalRow: true,
    totalRowLabel: {
      fr: "TOTAL",
      en: "TOTAL",
    },
    defaultMobileView: "grid",
    calculationMode: "materialized",
  };
}

/**
 * Authoritative definition for VT 8.8 staff roster:
 * "Liste nominative des formateurs" (table s8q8, 14 row slots × 7 cell fields = 98 cell keys).
 */
export function buildVt88TrainerRosterDefinition(
  field?: OnefopField
): NominalRosterDefinition {
  const paperCode = field?.paperCode ?? "8.8";
  const capacity = 14;
  const tableId = "s8q8";

  const fields: RosterFieldDefinition[] = [
    {
      key: "lastName",
      label: { fr: "Nom", en: "Last name" },
      kind: "text",
      required: true,
      placeholder: { fr: "Nom de famille", en: "Surname" },
    },
    {
      key: "firstName",
      label: { fr: "Prénom", en: "First name" },
      kind: "text",
      required: false,
      placeholder: { fr: "Prénom(s)", en: "First name(s)" },
    },
    {
      key: "sex",
      label: { fr: "Sexe", en: "Sex" },
      kind: "radio",
      options: [
        { value: "1", code: "1", label: { fr: "Homme", en: "Man" } },
        { value: "2", code: "2", label: { fr: "Femme", en: "Woman" } },
      ],
    },
    {
      key: "trainerStatus",
      label: { fr: "Statut", en: "Status" },
      kind: "select",
      options: [
        { value: "1", code: "1", label: { fr: "Vacataire professionnel", en: "Part-time vocational" } },
        { value: "2", code: "2", label: { fr: "Vacataire non professionnel", en: "Part-time non-vocational" } },
        { value: "3", code: "3", label: { fr: "Permanent", en: "Permanent" } },
      ],
    },
    {
      key: "isAdminPersonnel",
      label: { fr: "Personnel administratif", en: "Administrative staff" },
      kind: "boolean",
    },
    {
      key: "academicDiploma",
      label: { fr: "Diplôme académique", en: "Academic diploma" },
      kind: "select",
      options: [
        { value: "doctorat", code: "1", label: { fr: "Doctorat/PhD", en: "Doctorate/PhD" } },
        { value: "master2", code: "2", label: { fr: "Master II/DEA/DESS", en: "Master II/DEA/DESS" } },
        { value: "maitrise", code: "3", label: { fr: "Maîtrise/Master I", en: "Master I (Maîtrise)" } },
        { value: "licence", code: "4", label: { fr: "Licence", en: "Bachelor" } },
        { value: "deug_dut", code: "5", label: { fr: "DEUG/DUT", en: "DEUG/DUT" } },
        { value: "bacc_general", code: "6", label: { fr: "BACC Général", en: "GCE A-Level (General)" } },
        { value: "bacc_technique", code: "7", label: { fr: "BACC Technique", en: "GCE A-Level (Technical)" } },
        { value: "probatoire", code: "8", label: { fr: "Probatoire", en: "Form 6" } },
        { value: "bepc", code: "9", label: { fr: "BEPC/GCE O-Level", en: "BEPC/GCE O-Level" } },
        { value: "cep", code: "10", label: { fr: "CEP/CEPE/FSLC", en: "CEP/CEPE/FSLC" } },
        { value: "sans_diplome_academique", code: "11", label: { fr: "Sans diplôme académique", en: "No academic qualification" } },
      ],
    },
    {
      key: "professionalDiploma",
      label: { fr: "Diplôme professionnel", en: "Vocational diploma" },
      kind: "select",
      options: [
        { value: "dipleg_dipes2", code: "1", label: { fr: "DIPLEG/DIPES II", en: "DIPLEG/DIPES II" } },
        { value: "ingenieur_master_pro", code: "2", label: { fr: "Ingénieur/Master Pro", en: "Engineer/Professional Master" } },
        { value: "dipceg_dipes1", code: "3", label: { fr: "DIPCEG/DIPES I", en: "DIPCEG/DIPES I" } },
        { value: "licence_pro", code: "4", label: { fr: "Licence Pro", en: "Professional Bachelor" } },
        { value: "bts_hnd", code: "5", label: { fr: "BTS/HND", en: "BTS/HND" } },
        { value: "bep_bp_bacpro", code: "6", label: { fr: "BEP/BP/BAC PRO", en: "BEP/BP/BAC PRO" } },
        { value: "capieg", code: "7", label: { fr: "CAPIEG/CAPIEMP", en: "CAPIEG/CAPIEMP" } },
        { value: "capiaeg", code: "8", label: { fr: "CAPIAEG/CAPIA", en: "CAPIAEG/CAPIA" } },
        { value: "cap", code: "9", label: { fr: "CAP", en: "CAP" } },
        { value: "dqp", code: "10", label: { fr: "DQP/VQD", en: "DQP/VQD" } },
        { value: "cqp", code: "11", label: { fr: "CQP/VQC", en: "CQP/VQC" } },
        { value: "autres_pro", code: "12", label: { fr: "Autres", en: "Others" } },
        { value: "sans_diplome_professionnel", code: "12", label: { fr: "Sans diplôme professionnel", en: "No vocational qualification" } },
      ],
    },
  ];

  const slots: RosterRowSlot[] = [];
  for (let i = 1; i <= capacity; i++) {
    const rowId = `${tableId}_row${i}`;
    const cellKeys: Record<string, string> = {};
    for (const f of fields) {
      cellKeys[f.key] = `${rowId}_${f.key}`;
    }
    slots.push({
      slotIndex: i,
      rowId,
      label: { fr: `Formateur ${i}`, en: `Trainer ${i}` },
      cellKeys,
    });
  }

  return {
    id: "VT8_8",
    paperCode,
    type: "nominal-roster",
    title: field?.label ?? {
      fr: "Etat nominatif du personnel formateur et administratif des établissements ou privés",
      en: "Census of teaching and administrative staff of public schools or contract private schools",
    },
    caption: {
      fr: "Liste nominative des formateurs (14 formateurs maximum)",
      en: "Nominal list of trainers (14 trainers maximum)",
    },
    rowHeaderLabel: {
      fr: "Formateurs",
      en: "Trainers",
    },
    rosterCapacity: capacity,
    primaryKeyField: "lastName",
    fields,
    slots,
    recordNoun: { fr: "formateurs", en: "trainers" },
    singularRecordNoun: { fr: "formateur", en: "trainer" },
    emptyStateMessage: {
      fr: "Aucun formateur enregistré pour le moment.",
      en: "No trainers registered yet.",
    },
    removeConfirmationMessage: {
      fr: "Êtes-vous sûr de vouloir supprimer ce formateur ?",
      en: "Are you sure you want to remove this trainer?",
    },
    titleBuilder: (values) => `${(values.lastName as string) ?? ""} ${(values.firstName as string) ?? ""}`.trim(),
    subtitleBuilder: (values) => {
      const parts: string[] = [];
      if (values.sex === "1") parts.push("Homme");
      else if (values.sex === "2") parts.push("Femme");
      if (values.trainerStatus === "1") parts.push("Vacataire pro");
      else if (values.trainerStatus === "2") parts.push("Vacataire non-pro");
      else if (values.trainerStatus === "3") parts.push("Permanent");
      if (values.isAdminPersonnel === true || values.isAdminPersonnel === "true") parts.push("Admin");
      return parts.join(" · ");
    },
    idFieldKey: "lastName",
    fieldsPerRow: fields.map((f) => f.key),
  };
}

export function isRosterSlotActive(
  slot: RosterRowSlot,
  primaryKeyField: string,
  data: FormData
): boolean {
  const pkKey = slot.cellKeys[primaryKeyField];
  if (!pkKey) return false;
  const val = data[pkKey];
  return val !== undefined && val !== null && String(val).trim().length > 0;
}

export function getRosterActiveRecords(
  definition: NominalRosterDefinition,
  data: FormData
): Array<{ slot: RosterRowSlot; values: Record<string, unknown> }> {
  const active: Array<{ slot: RosterRowSlot; values: Record<string, unknown> }> = [];
  for (const slot of definition.slots) {
    if (isRosterSlotActive(slot, definition.primaryKeyField, data)) {
      const values: Record<string, unknown> = {};
      for (const field of definition.fields) {
        const key = slot.cellKeys[field.key];
        values[field.key] = data[key] ?? null;
      }
      active.push({ slot, values });
    }
  }
  return active;
}

export function getRosterNextAvailableSlot(
  definition: NominalRosterDefinition,
  data: FormData
): RosterRowSlot | undefined {
  return definition.slots.find((slot) => !isRosterSlotActive(slot, definition.primaryKeyField, data));
}

export function getRosterCapacityState(
  definition: NominalRosterDefinition,
  data: FormData
): { totalCapacity: number; activeCount: number; isFull: boolean; availableSlotsCount: number } {
  const activeCount = getRosterActiveRecords(definition, data).length;
  const totalCapacity = definition.rosterCapacity;
  return {
    totalCapacity,
    activeCount,
    isFull: activeCount >= totalCapacity,
    availableSlotsCount: Math.max(0, totalCapacity - activeCount),
  };
}

export function clearRosterSlotData(
  definition: NominalRosterDefinition,
  slot: RosterRowSlot
): Record<string, null> {
  const cleared: Record<string, null> = {};
  for (const field of definition.fields) {
    const key = slot.cellKeys[field.key];
    if (key) {
      cleared[key] = null;
    }
  }
  return cleared;
}

export function validateRosterData(
  definition: NominalRosterDefinition,
  data: FormData
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const slot of definition.slots) {
    const isActive = isRosterSlotActive(slot, definition.primaryKeyField, data);
    if (!isActive) continue; // Inactive slots never produce errors

    for (const field of definition.fields) {
      const key = slot.cellKeys[field.key];
      const val = data[key];
      if (field.required) {
        if (val === undefined || val === null || String(val).trim() === "") {
          errors[key] = `Field '${field.key}' is required for ${slot.rowId}`;
        }
      }
    }
  }
  return errors;
}
