// src/onefop-schema-validation/onefop-schema.types.ts
//
// Mirrors the shape written by test/tools/export_onefop_schema_test.dart
// into assets/schemas/onefop.schema.json. Kept as a thin type layer over
// the generated JSON — onefop_ast.dart remains the sole canonical source
// (see the migration plan's "ONEFOP Schema Ownership Rule"); this file
// must never diverge from what the exporter actually produces.

export interface LocalizedText {
  fr: string;
  en: string;
}

export interface SchemaOption {
  value: string;
  label: LocalizedText;
}

export interface SchemaVisibility {
  dependsOn: string;
  dependsValue: string;
  dependsOperator: 'eq' | 'contains';
}

export interface VtRow {
  id: string;
  label: LocalizedText;
  labelFromCells: string[] | null;
}

export interface VtCell {
  key: string;
  label: LocalizedText;
  // "computed" is the one kind that ever carries a formula; "number"/"text"
  // are plain user-entered cells.
  kind: string;
  required: boolean;
  dependsOnKey: string | null;
  options: SchemaOption[] | null;
  formula: 'sum-of-siblings' | null;
}

export interface VtTable {
  paperCode: string | null;
  title: LocalizedText;
  progressNoun: LocalizedText | null;
  isRoster: boolean;
  progressiveRows: boolean;
  singleCellPerRow: boolean;
  rows: VtRow[];
  cells: VtCell[];
}

export interface SchemaTable {
  id: string;
  template: string;
  // A List<String> of row keys (CSP/SFP-shaped tables) OR an int display
  // capacity (skills_table, activities_table, vt_* templates) — never both.
  rowKeys: string[] | null;
  rowCapacity: number | null;
  // Row-major flat field-id grid. Null for the seven classic templates
  // whose column/row layout is a hardcoded Dart literal, not AST data —
  // see `limitation` when this is null.
  matrix: string[][] | null;
  // Rich per-row/per-cell metadata for VT's own tables only. Absent (not
  // just null) for classic (non-VT) tables.
  vt?: VtTable;
  // Present only for the seven classic templates extraction can't fully
  // represent — see onefop-schema-loader.service.ts's isClassicTableWithoutCellData.
  limitation?: string;
}

export interface SchemaField {
  id: string;
  paperCode: string | null;
  path: string;
  type: string;
  required: boolean;
  label: LocalizedText;
  hint: LocalizedText | null;
  instruction: LocalizedText | null;
  options: SchemaOption[] | null;
  visibility: SchemaVisibility | null;
  table: SchemaTable | null;
}

// Subsections are a display/grouping label over a subset of the PARENT
// section's own `fields` — they reference field ids, they don't own
// separate field objects. Every field still appears exactly once, in its
// section's flat `fields` array (confirmed against the real generated
// JSON — sections and subsections are not a uniform recursive tree).
export interface SchemaSubsection {
  title: LocalizedText;
  fieldIds: string[];
}

export interface SchemaSection {
  id: string;
  order: number;
  title: LocalizedText;
  description: LocalizedText | null;
  entityTypes: string[];
  subsections: SchemaSubsection[];
  fields: SchemaField[];
}

export interface EntitySchema {
  entityType: string;
  sectionCount: number;
  fieldCount: number;
  tableCount: number;
  sections: SchemaSection[];
}

export interface OnefopSchemaRoot {
  schemaVersion: number;
  source: string;
  astTotals: { sections: number; questions: number };
  sectionEntityMap: Record<string, string[]>;
  formulas: Record<string, string>;
  entities: Record<string, EntitySchema>;
}

// The seven real EntityType values (see the migration plan §2.1) — the
// schema-registry entity key, not the backend's ENTREPRISE/PROJECT_PROGRAM/
// VOCATIONAL_TRAINING enum spelling.
export type SchemaEntityType =
  | 'enterprise'
  | 'cooperative'
  | 'ctd'
  | 'ong'
  | 'administration'
  | 'projectProgram'
  | 'vocationalTraining';
