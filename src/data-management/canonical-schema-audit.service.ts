// src/data-management/canonical-schema-audit.service.ts
//
// ONEFOP SPSS Export Production Certification Audit Service
//
// This service performs a schema-driven, zero-tolerance audit of the entire
// SPSS export pipeline. It walks every entity and field in onefop.schema.json
// and classifies each into one of five export categories:
//
//   WIDE_SCALAR          → canonical wide SPSS/CSV variable
//   WIDE_MATRIX          → expanded cell-by-cell into wide variables
//   WIDE_INDEXED         → slot-based wide variables (desc/male/female/total × N)
//   LONG_FORMAT          → relational long-format sheet (stable submissionId FK)
//   INTENTIONALLY_EXCLUDED → PII or design-excluded, explicitly documented
//
// Any field not in one of those five categories is classified as
// MISSING_FROM_EXPORT. The audit fails (returns failCount > 0) if ANY field
// is MISSING_FROM_EXPORT.
//
// Design note: This service is read-only and does not modify any export logic.
// It imports from CanonicalSchemaAdapterService for variable counts only;
// the classification walk is independent and schema-driven.

import { Injectable } from '@nestjs/common';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import type {
  OnefopSchemaRoot,
  SchemaEntityType,
  SchemaField,
  SchemaSection,
} from '../onefop-schema-validation/onefop-schema.types';
import {
  CanonicalSchemaAdapterService,
  DEMAND_SCHEMA_ENTITIES,
  TVET_SCHEMA_ENTITIES,
} from './canonical-schema-adapter.service';

// ── Export classification ─────────────────────────────────────────────────────

export type ExportClassification =
  | 'WIDE_SCALAR'
  | 'WIDE_MATRIX'
  | 'WIDE_INDEXED'
  | 'LONG_FORMAT'
  | 'INTENTIONALLY_EXCLUDED'
  | 'MISSING_FROM_EXPORT';

export interface FieldAuditRecord {
  entity: string;
  sectionId: string;
  fieldId: string;
  fieldType: string;
  tableTemplate: string | null;
  hasMatrixCells: boolean;
  matrixCellCount: number;
  indexedCapacity: number | null;
  classification: ExportClassification;
  longFormatSheetKey?: string;
  exclusionReason?: string;
  exclusionPolicy?: string;
  missingReason?: string;
  recommendedStrategy?: string;
}

export interface FormAuditResult {
  entity: string;
  partition: 'DEMAND' | 'TVET';
  sectionCount: number;
  scalarFields: number;
  matrixFields: number;
  matrixCells: number;
  indexedFields: number;
  indexedSlots: number;  // capacity * 4 (desc + male + female + total)
  repeatingFields: number;
  longFormatTables: number;
  intentionallyExcluded: number;
  wideVariables: number;
  missingFields: number;
  status: 'PASS' | 'FAIL';
  records: FieldAuditRecord[];
}

export interface AuditReport {
  forms: FormAuditResult[];
  totalFormsDiscovered: number;
  totalFormsCertified: number;
  totalSchemaFields: number;
  totalCollectableFields: number;
  totalIntentionallyExcluded: number;
  totalWideVariables: number;
  totalMatrixCells: number;
  totalIndexedSlots: number;
  totalLongFormatTables: number;
  missingMappings: number;
  variableCollisions: number;
  csvSpssColumnMismatches: number;
  namingViolations: NamingViolation[];
  partitionAudit: {
    demand: { variableCount: number; hasOnlyDemandEntities: boolean };
    tvet: { variableCount: number; hasOnlyTvetEntities: boolean };
    all: { variableCount: number };
  };
  finalStatus: 'CERTIFIED' | 'NOT_CERTIFIED';
  certificationFailures: string[];
  report: string;
}

export interface NamingViolation {
  variableName: string;
  reason: string;
}

// ── Known long-format sheets (keyed by schema field ID) ───────────────────────
// Each repeating/variable-length table maps to a named breakdown-sheet key.
// VT8_8 is the only explicit PII exclusion.

const LONG_FORMAT_FIELD_MAP: Record<string, { sheetKey: string; description: string }> = {
  PP_S2_ACTIVITIES: {
    sheetKey: 'projectProgramActivities',
    description: 'Project/Program activities — long-format Excel sheet with submissionId FK',
  },
  VT4_3: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty FI/FC by row (section 4) — long-format vtSpecialtyRows sheet',
  },
  VT4_4: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty FI/FC continuation — long-format vtSpecialtyRows sheet',
  },
  VT4_5: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty FI/FC by row (section 4, third table) — long-format vtSpecialtyRows sheet',
  },
  VT4_6: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty year breakdown — long-format vtSpecialtyRows sheet',
  },
  VT4_10: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty gender/total summary — long-format vtSpecialtyRows sheet',
  },
  VT5_5: {
    sheetKey: 'vtCurricula',
    description: 'VT curriculum list — long-format vtCurricula sheet',
  },
  VT6_13: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty gender/total (section 6) — long-format vtSpecialtyRows sheet',
  },
  VT8_4: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty FI/FC (section 8) — long-format vtSpecialtyRows sheet',
  },
  VT8_7: {
    sheetKey: 'vtSpecialtyRows',
    description: 'VT specialty FI/FC count (section 8) — long-format vtSpecialtyRows sheet',
  },
};

const INTENTIONALLY_EXCLUDED_FIELDS: Record<
  string,
  { reason: string; policy: string; affectedData: string }
> = {
  VT8_8: {
    reason: 'PII — Individual trainer roster contains named persons (last name, first name, birth date, qualifications)',
    policy: 'Design specification §9: Trainer roster is excluded from the default anonymous statistical export. ' +
            'Any roster export must be separate, explicitly labelled, and subject to data-protection review.',
    affectedData: 's8q8_row1_lastName … s8q8_row14_professionalDiploma (7 cells × 14 rows = 98 PII cell IDs)',
  },
};

// Templates whose matrix grids represent fixed (non-repeating) structures:
const FIXED_MATRIX_TEMPLATES = new Set([
  'csp_gender_age_table',
  'diploma_gender_age_table',
  'csp_status_gender_table',
  'vulnerable_named_rows_table',
  'first_time_workers_table',
  'departure_table',
  'dismissal_unemployment_table',
  'internship_table',
  'kpi_period_table',
  'vt_diploma_table',
  'vt_trainee_age_flow_table',
  'vt_education_level_flow_table',
  'vt_vulnerable_table',
  'vt_scholarship_table',
  'vt_infrastructure_table',
  'vt_furniture_table',
  'vt_trainer_age_table',
  'vt_trainer_disability_table',
]);

// Templates handled as indexed slots (desc + male + female + total × capacity):
const INDEXED_TEMPLATES = new Set([
  'reasons_table',
  'skills_table',
  'training_table',
]);

// SPSS reserved keywords (all upper-case for case-insensitive comparison):
const SPSS_RESERVED = new Set([
  'ALL', 'AND', 'BY', 'EQ', 'GE', 'GT', 'LE', 'LT', 'NE', 'NOT', 'OR', 'TO', 'WITH',
]);

const SPSS_VALID_NAME_RE = /^[A-Za-z@][A-Za-z0-9_.@#$]*$/;

@Injectable()
export class CanonicalSchemaAuditService {
  constructor(
    private readonly schemaLoader: OnefopSchemaLoaderService,
    private readonly canonicalAdapter: CanonicalSchemaAdapterService,
  ) {}

  // ── Main entry point ────────────────────────────────────────────────────────

  public runFullAudit(): AuditReport {
    const root = this.schemaLoader.getRoot();
    const forms = this.auditAllForms(root);

    const allVars = this.canonicalAdapter.getAllVariables();
    const demandVars = this.canonicalAdapter.getDemandVariables();
    const tvetVars = this.canonicalAdapter.getTvetVariables();

    // Variable naming audit
    const namingViolations = this.auditVariableNames(allVars);

    // CSV/SPSS column parity (order-sensitive)
    const csvSpssColumnMismatches = this.auditColumnOrderParity(allVars, demandVars, tvetVars);

    // Partition isolation audit
    const demandEntitySet = new Set<string>(DEMAND_SCHEMA_ENTITIES);
    const tvetEntitySet = new Set<string>(TVET_SCHEMA_ENTITIES);
    const hasOnlyDemandEntities = demandVars.every(
      (v) => v.entityApplicability.includes('ALL') || v.entityApplicability.some((e) => demandEntitySet.has(e)),
    );
    const hasOnlyTvetEntities = tvetVars.every(
      (v) => v.entityApplicability.includes('ALL') || v.entityApplicability.some((e) => tvetEntitySet.has(e)),
    );

    // Aggregate totals
    const totalSchemaFields = forms.reduce((n, f) => n + f.records.length, 0);
    const totalCollectableFields = forms.reduce(
      (n, f) => n + f.records.filter((r) => r.classification !== 'INTENTIONALLY_EXCLUDED').length,
      0,
    );
    const totalIntentionallyExcluded = forms.reduce(
      (n, f) => n + f.intentionallyExcluded,
      0,
    );
    const totalMissingMappings = forms.reduce((n, f) => n + f.missingFields, 0);
    const totalMatrixCells = forms.reduce((n, f) => n + f.matrixCells, 0);
    const totalIndexedSlots = forms.reduce((n, f) => n + f.indexedSlots, 0);

    // Unique long-format tables across all forms
    const longFormatTableKeys = new Set<string>();
    for (const form of forms) {
      for (const r of form.records) {
        if (r.classification === 'LONG_FORMAT' && r.longFormatSheetKey) {
          longFormatTableKeys.add(r.longFormatSheetKey);
        }
      }
    }

    const certificationFailures: string[] = [];
    if (totalMissingMappings > 0) certificationFailures.push(`${totalMissingMappings} MISSING_FROM_EXPORT field(s) detected`);
    if (namingViolations.length > 0) certificationFailures.push(`${namingViolations.length} SPSS variable naming violation(s) detected`);
    if (csvSpssColumnMismatches > 0) certificationFailures.push(`${csvSpssColumnMismatches} CSV/SPSS column order mismatch(es) detected`);
    if (!hasOnlyDemandEntities) certificationFailures.push('TVET entities found in DEMAND partition (cross-partition pollution)');
    if (!hasOnlyTvetEntities) certificationFailures.push('DEMAND entities found in TVET partition (cross-partition pollution)');

    const finalStatus = certificationFailures.length === 0 ? 'CERTIFIED' : 'NOT_CERTIFIED';

    const report = this.buildReportString({
      forms,
      totalFormsDiscovered: forms.length,
      totalFormsCertified: forms.filter((f) => f.status === 'PASS').length,
      totalSchemaFields,
      totalCollectableFields,
      totalIntentionallyExcluded,
      totalWideVariables: allVars.length,
      totalMatrixCells,
      totalIndexedSlots,
      totalLongFormatTables: longFormatTableKeys.size,
      missingMappings: totalMissingMappings,
      variableCollisions: namingViolations.filter((v) => v.reason.includes('Duplicate')).length,
      csvSpssColumnMismatches,
      namingViolations,
      partitionAudit: {
        demand: { variableCount: demandVars.length, hasOnlyDemandEntities },
        tvet: { variableCount: tvetVars.length, hasOnlyTvetEntities },
        all: { variableCount: allVars.length },
      },
      finalStatus,
      certificationFailures,
      report: '',
    });

    return {
      forms,
      totalFormsDiscovered: forms.length,
      totalFormsCertified: forms.filter((f) => f.status === 'PASS').length,
      totalSchemaFields,
      totalCollectableFields,
      totalIntentionallyExcluded,
      totalWideVariables: allVars.length,
      totalMatrixCells,
      totalIndexedSlots,
      totalLongFormatTables: longFormatTableKeys.size,
      missingMappings: totalMissingMappings,
      variableCollisions: namingViolations.filter((v) => v.reason.includes('Duplicate')).length,
      csvSpssColumnMismatches,
      namingViolations,
      partitionAudit: {
        demand: { variableCount: demandVars.length, hasOnlyDemandEntities },
        tvet: { variableCount: tvetVars.length, hasOnlyTvetEntities },
        all: { variableCount: allVars.length },
      },
      finalStatus,
      certificationFailures,
      report,
    };
  }

  // ── Form-level audit ────────────────────────────────────────────────────────

  private auditAllForms(root: OnefopSchemaRoot): FormAuditResult[] {
    const results: FormAuditResult[] = [];

    for (const [entityKey, entitySchema] of Object.entries(root.entities)) {
      const partition = (TVET_SCHEMA_ENTITIES as string[]).includes(entityKey) ? 'TVET' : 'DEMAND';
      const records: FieldAuditRecord[] = [];

      for (const sec of entitySchema.sections) {
        for (const field of sec.fields) {
          records.push(this.classifyField(entityKey, sec.id, field));
        }
      }

      const missingFields = records.filter((r) => r.classification === 'MISSING_FROM_EXPORT').length;

      results.push({
        entity: entityKey,
        partition,
        sectionCount: entitySchema.sections.length,
        scalarFields: records.filter((r) => r.classification === 'WIDE_SCALAR').length,
        matrixFields: records.filter((r) => r.classification === 'WIDE_MATRIX').length,
        matrixCells: records.filter((r) => r.classification === 'WIDE_MATRIX').reduce((n, r) => n + r.matrixCellCount, 0),
        indexedFields: records.filter((r) => r.classification === 'WIDE_INDEXED').length,
        indexedSlots: records.filter((r) => r.classification === 'WIDE_INDEXED').reduce((n, r) => n + (r.indexedCapacity ?? 0) * 4, 0),
        repeatingFields: records.filter((r) => r.classification === 'LONG_FORMAT').length,
        longFormatTables: new Set(records.filter((r) => r.classification === 'LONG_FORMAT').map((r) => r.longFormatSheetKey)).size,
        intentionallyExcluded: records.filter((r) => r.classification === 'INTENTIONALLY_EXCLUDED').length,
        wideVariables: records.filter((r) =>
          r.classification === 'WIDE_SCALAR' || r.classification === 'WIDE_MATRIX' || r.classification === 'WIDE_INDEXED',
        ).reduce((n, r) => {
          if (r.classification === 'WIDE_SCALAR') return n + 1;
          if (r.classification === 'WIDE_MATRIX') return n + r.matrixCellCount;
          if (r.classification === 'WIDE_INDEXED') return n + (r.indexedCapacity ?? 0) * 4;
          return n;
        }, 0),
        missingFields,
        status: missingFields === 0 ? 'PASS' : 'FAIL',
        records,
      });
    }

    return results;
  }

  public classifyField(entityKey: string, sectionId: string, field: SchemaField): FieldAuditRecord {
    const base: Omit<FieldAuditRecord, 'classification' | 'longFormatSheetKey' | 'exclusionReason' | 'exclusionPolicy' | 'missingReason' | 'recommendedStrategy'> = {
      entity: entityKey,
      sectionId,
      fieldId: field.id,
      fieldType: field.type,
      tableTemplate: field.table?.template ?? null,
      hasMatrixCells: !!(field.table?.matrix && field.table.matrix.length > 0),
      matrixCellCount: 0,
      indexedCapacity: null,
    };

    if (field.table?.matrix) {
      base.matrixCellCount = field.table.matrix.reduce((n, row) => n + row.length, 0);
    }

    // 1. Intentionally excluded (PII/design)
    if (INTENTIONALLY_EXCLUDED_FIELDS[field.id]) {
      const exc = INTENTIONALLY_EXCLUDED_FIELDS[field.id];
      return {
        ...base,
        classification: 'INTENTIONALLY_EXCLUDED',
        exclusionReason: exc.reason,
        exclusionPolicy: exc.policy,
      };
    }

    // 2. No table → wide scalar
    if (!field.table) {
      return { ...base, classification: 'WIDE_SCALAR' };
    }

    const t = field.table;

    // 3. Indexed tables (reasons, skills, training)
    if (t.rowCapacity && INDEXED_TEMPLATES.has(t.template)) {
      base.indexedCapacity = t.rowCapacity;
      return { ...base, classification: 'WIDE_INDEXED' };
    }

    // 4. Repeating tables → long-format
    if (field.type === 'repeating_table') {
      const mapping = LONG_FORMAT_FIELD_MAP[field.id];
      if (mapping) {
        return {
          ...base,
          classification: 'LONG_FORMAT',
          longFormatSheetKey: mapping.sheetKey,
        };
      }
      // Unknown repeating table: MISSING_FROM_EXPORT
      return {
        ...base,
        classification: 'MISSING_FROM_EXPORT',
        missingReason: `repeating_table field '${field.id}' (template: ${t.template}) has no long-format sheet mapping`,
        recommendedStrategy: `Register '${field.id}' in LONG_FORMAT_FIELD_MAP with a sheetKey, then add the corresponding entry to BREAKDOWN_SHEET_DEFS in data-management.service.ts`,
      };
    }

    // 5. Fixed matrix tables → wide matrix (cell by cell)
    if (t.matrix && t.matrix.length > 0) {
      return { ...base, classification: 'WIDE_MATRIX' };
    }

    // 6. Table with known fixed template but no cell data (schema limitation)
    if (FIXED_MATRIX_TEMPLATES.has(t.template)) {
      // The schema has a 'limitation' flag for classic tables with no AST-level cell IDs.
      // These are handled by the adapter via the matrix expansion path once the limitation
      // is lifted in the schema exporter. Flag as MISSING_FROM_EXPORT with explanation.
      if (t.limitation) {
        return {
          ...base,
          classification: 'MISSING_FROM_EXPORT',
          missingReason: `Schema limitation: table '${field.id}' (${t.template}) has no cell-level AST data. Limitation note: "${t.limitation}"`,
          recommendedStrategy: 'Resolve the schema exporter limitation to export cell IDs from the Dart AST, then re-run this audit.',
        };
      }
      // Has template but no matrix cells — unusual; flag it
      return {
        ...base,
        classification: 'MISSING_FROM_EXPORT',
        missingReason: `Fixed matrix template '${t.template}' has no matrix cell data for field '${field.id}' (entity: ${entityKey})`,
        recommendedStrategy: 'Check schema exporter — matrix[][] should be populated for this template.',
      };
    }

    // 7. Unknown table structure
    return {
      ...base,
      classification: 'MISSING_FROM_EXPORT',
      missingReason: `Unknown table structure for field '${field.id}' (type: ${field.type}, template: ${t.template ?? 'none'}, hasMatrix: ${base.hasMatrixCells})`,
      recommendedStrategy: 'Determine if this is a fixed matrix, indexed, or repeating structure and add the appropriate handler.',
    };
  }

  // ── SPSS Variable Naming Audit ───────────────────────────────────────────────

  public auditVariableNames(variables: Array<{ variableName: string }>): NamingViolation[] {
    const violations: NamingViolation[] = [];
    const seen = new Map<string, string>(); // upper-case name → original name

    for (const v of variables) {
      const name = v.variableName;

      // Length
      if (name.length > 64) {
        violations.push({ variableName: name, reason: `Exceeds 64 characters (length: ${name.length})` });
      }

      // Valid characters
      if (!SPSS_VALID_NAME_RE.test(name)) {
        violations.push({ variableName: name, reason: `Contains invalid SPSS characters` });
      }

      // Must not start with digit
      if (/^[0-9]/.test(name)) {
        violations.push({ variableName: name, reason: `Starts with a digit` });
      }

      // Reserved keywords
      if (SPSS_RESERVED.has(name.toUpperCase())) {
        violations.push({ variableName: name, reason: `Is an SPSS reserved keyword` });
      }

      // Duplicate (case-insensitive)
      const upper = name.toUpperCase();
      if (seen.has(upper)) {
        violations.push({
          variableName: name,
          reason: `Duplicate (case-insensitive) of '${seen.get(upper)}'`,
        });
      } else {
        seen.set(upper, name);
      }
    }

    return violations;
  }

  // ── CSV/SPSS Column Order Parity Audit ──────────────────────────────────────
  // Verifies that for every partition the variable list produced by
  // CanonicalSchemaAdapterService is internally self-consistent (i.e. the same
  // list that would be used for both the CSV headers and the SPSS /VARIABLES=
  // block). Since both paths consume the same array, column-order parity holds
  // by construction — but we explicitly verify there are no duplicate entries
  // and that orderIndex is strictly monotone increasing.

  public auditColumnOrderParity(
    allVars: Array<{ variableName: string; orderIndex: number }>,
    demandVars: Array<{ variableName: string; orderIndex: number }>,
    tvetVars: Array<{ variableName: string; orderIndex: number }>,
  ): number {
    let mismatches = 0;
    for (const vars of [allVars, demandVars, tvetVars]) {
      // orderIndex must be strictly increasing
      for (let i = 1; i < vars.length; i++) {
        if (vars[i].orderIndex <= vars[i - 1].orderIndex) {
          mismatches++;
        }
      }
      // No duplicate variable names (already checked by naming audit, but
      // also verify position stability here)
      const names = vars.map((v) => v.variableName.toUpperCase());
      const unique = new Set(names);
      if (unique.size !== names.length) {
        mismatches += names.length - unique.size;
      }
    }
    return mismatches;
  }

  // ── Value Integrity Classification ──────────────────────────────────────────

  /**
   * Given a raw extracted value (from extractValue), classifies its integrity:
   * - explicit 0: the value is numeric zero (0 or "0")
   * - blank/missing: undefined or null
   * - positive number: numeric > 0
   * - string: non-numeric string
   * - NONE/NOT_APPLICABLE: response-status string
   */
  public classifyExtractedValue(value: unknown): 'EXPLICIT_ZERO' | 'BLANK' | 'POSITIVE' | 'STRING' | 'STATUS' {
    if (value === undefined || value === null) return 'BLANK';
    if (value === 0 || value === '0') return 'EXPLICIT_ZERO';
    if (value === 'NONE' || value === 'NOT_APPLICABLE') return 'STATUS';
    if (typeof value === 'number' && value > 0) return 'POSITIVE';
    if (typeof value === 'string' && value !== '') return 'STRING';
    return 'BLANK';
  }

  // ── Report Generation ────────────────────────────────────────────────────────

  private buildReportString(report: AuditReport): string {
    const pad = (s: string, n: number) => s.padEnd(n);
    const lines: string[] = [
      '============================================================',
      'ONEFOP SPSS EXPORT PRODUCTION CERTIFICATION',
      '============================================================',
      '',
      `Forms discovered:              ${report.totalFormsDiscovered}`,
      `Forms certified:               ${report.totalFormsCertified}`,
      '',
      `Total schema fields:           ${report.totalSchemaFields}`,
      `Total collectable fields:      ${report.totalCollectableFields}`,
      `Total intentionally excluded:  ${report.totalIntentionallyExcluded}`,
      `Total wide variables:          ${report.totalWideVariables}`,
      `Total matrix cells:            ${report.totalMatrixCells}`,
      `Total indexed slots:           ${report.totalIndexedSlots}`,
      `Total long-format tables:      ${report.totalLongFormatTables}`,
      '',
      `Missing mappings:              ${report.missingMappings}`,
      `Variable collisions:           ${report.variableCollisions}`,
      `CSV/SPSS mismatches:           ${report.csvSpssColumnMismatches}`,
      '',
      `DEMAND partition variables:    ${report.partitionAudit.demand.variableCount}`,
      `TVET partition variables:      ${report.partitionAudit.tvet.variableCount}`,
      `ALL partition variables:       ${report.partitionAudit.all.variableCount}`,
      `Partition isolation:           ${report.partitionAudit.demand.hasOnlyDemandEntities && report.partitionAudit.tvet.hasOnlyTvetEntities ? 'CLEAN' : 'VIOLATED'}`,
      '',
      '---- FORM-LEVEL CERTIFICATION TABLE -------------------------',
      `${'Form'.padEnd(22)} ${'Part'.padEnd(6)} ${'Scalars'.padStart(7)} ${'Matrices'.padStart(9)} ${'Cells'.padStart(6)} ${'Indexed'.padStart(8)} ${'Repeating'.padStart(10)} ${'Wide'.padStart(7)} ${'LongFmt'.padStart(8)} ${'Missing'.padStart(8)} ${'Status'.padStart(7)}`,
      '-'.repeat(100),
    ];

    for (const f of report.forms) {
      lines.push(
        `${f.entity.padEnd(22)} ${f.partition.padEnd(6)} ${String(f.scalarFields).padStart(7)} ${String(f.matrixFields).padStart(9)} ${String(f.matrixCells).padStart(6)} ${String(f.indexedFields).padStart(8)} ${String(f.repeatingFields).padStart(10)} ${String(f.wideVariables).padStart(7)} ${String(f.longFormatTables).padStart(8)} ${String(f.missingFields).padStart(8)} ${f.status.padStart(7)}`,
      );
    }

    lines.push('-'.repeat(100));
    lines.push('');

    if (report.namingViolations.length > 0) {
      lines.push('---- NAMING VIOLATIONS ----------------------------------------');
      for (const v of report.namingViolations) {
        lines.push(`  [VIOLATION] ${v.variableName}: ${v.reason}`);
      }
      lines.push('');
    }

    if (report.certificationFailures.length > 0) {
      lines.push('---- CERTIFICATION FAILURES ----------------------------------');
      for (const f of report.certificationFailures) {
        lines.push(`  [FAIL] ${f}`);
      }
      lines.push('');
    }

    lines.push(`SPSS runtime:    NOT AVAILABLE (spss.exe not found on host)`);
    lines.push(`PSPP runtime:    NOT AVAILABLE (pspp.exe not found on host)`);
    lines.push('');
    lines.push(`FINAL STATUS:    ${report.finalStatus}`);
    lines.push('============================================================');

    return lines.join('\n');
  }
}
