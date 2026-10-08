// src/onefop-schema-validation/onefop-shadow-validator.service.ts
//
// Phase 2.6/2.7 of the migration plan: a generic validator that consumes
// the generated ONEFOP schema (not a second questionnaire definition) and
// checks a submitted flat-key payload against field types, required
// rules, conditional visibility (eq/contains), and the one verified
// formula (sum-of-siblings). Cross-field coherence is deliberately NOT
// duplicated here — QuestionnairesService.checkCoherence()/checkVtCoherence()
// already compute and store that, live, in production; this validator's
// job is only the schema-driven structural dimension no existing code
// checks against the AST-derived schema today.
//
// Pure and DB-free by design: no Prisma dependency, so it's fully
// unit-testable without touching the (only) live backend. Always run in
// shadow/log-only mode per the plan — see validateAndLog() — it must
// never affect whether a submission is accepted.
import { Injectable, Logger } from '@nestjs/common';
import { OnefopSchemaLoaderService } from './onefop-schema-loader.service';
import type { SchemaEntityType, SchemaField, SchemaTable } from './onefop-schema.types';
import type { DiscrepancyCategory, ShadowDiscrepancy, ShadowValidationResult } from './onefop-shadow-validator.types';

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === '';
}

/**
 * A training centre declared "Non-fonctionnelle" or "Fermée" in 1.12 answers
 * Section 1 only — the same rule as react-web's isVtSectionWaived.
 */
export function isVtSectionWaived(sectionId: string, flat: Record<string, unknown>): boolean {
  if (!sectionId.endsWith('_vocationalTraining') || sectionId === 'section1_vocationalTraining') return false;
  const status = flat['VT1_12'];
  return typeof status === 'string' && (status.startsWith('Non-fonctionnelle') || status.startsWith('Fermée'));
}

@Injectable()
export class OnefopShadowValidatorService {
  private readonly logger = new Logger(OnefopShadowValidatorService.name);

  constructor(private readonly schemaLoader: OnefopSchemaLoaderService) {}

  // toLowerEntityType() in questionnaires.service.ts yields 'entreprise'
  // (French) for what the schema-registry calls 'enterprise' (English) —
  // every other value already matches (cooperative/ctd/ong/administration/
  // projectProgram/vocationalTraining). Kept local rather than importing
  // questionnaires.controller.ts's own normalizeEntityTypeForPreview, which
  // is a private, unexported function there.
  static toSchemaEntityType(lowerEntityType: string): SchemaEntityType | null {
    const map: Record<string, SchemaEntityType> = {
      entreprise: 'enterprise',
      enterprise: 'enterprise',
      cooperative: 'cooperative',
      ctd: 'ctd',
      ong: 'ong',
      administration: 'administration',
      projectProgram: 'projectProgram',
      vocationalTraining: 'vocationalTraining',
    };
    return map[lowerEntityType] ?? null;
  }

  validate(entityType: SchemaEntityType, flat: Record<string, unknown>): ShadowValidationResult {
    const fields = this.schemaLoader.getFlattenedFields(entityType);
    const discrepancies: ShadowDiscrepancy[] = [];

    for (const field of fields.values()) {
      if (field.type === 'table' || field.type === 'repeating_table') {
        this.validateTable(field, flat, discrepancies);
        continue;
      }

      const visible = this.isVisible(field, flat);
      const raw = flat[field.id];
      const empty = isEmpty(raw);

      if (field.required && visible && empty) {
        discrepancies.push({
          category: 'required',
          fieldId: field.id,
          message: `Required field is missing while its visibility condition is satisfied (or it has none).`,
        });
        continue;
      }
      if (empty) continue;

      if (!visible) {
        // Present despite an unmet visibility condition — often a stale
        // value left over from a toggled-off "Other (specify)" branch
        // rather than a bug. Surfaced so shadow-mode triage can tell
        // "legitimate legacy payload" from "validator defect" per §2.7.
        discrepancies.push({
          category: 'visibility',
          fieldId: field.id,
          message: `Value present but visibility condition (depends on "${field.visibility?.dependsOn}" ${field.visibility?.dependsOperator} "${field.visibility?.dependsValue}") is not satisfied.`,
        });
      }

      const typeMessage = this.checkFieldType(field, raw);
      if (typeMessage) {
        discrepancies.push({ category: 'type', fieldId: field.id, message: typeMessage });
      }
    }

    return { entityType, fieldsChecked: fields.size, discrepancies };
  }

  /**
   * Required, currently shown, non-table questions left unanswered (an empty
   * tick-box list counts as unanswered), skipping sections the caller waives.
   * Unlike validate(), this is meant to block a final submission.
   */
  missingRequiredAnswers(
    entityType: SchemaEntityType,
    flat: Record<string, unknown>,
    isSectionWaived: (sectionId: string, flat: Record<string, unknown>) => boolean = () => false,
  ): SchemaField[] {
    const missing: SchemaField[] = [];
    for (const section of this.schemaLoader.getEntitySchema(entityType).sections) {
      if (isSectionWaived(section.id, flat)) continue;
      for (const field of section.fields) {
        if (!field.required || field.table) continue;
        if (field.type === 'table' || field.type === 'repeating_table') continue;
        if (!this.isVisible(field, flat)) continue;
        const raw = flat[field.id];
        if (isEmpty(raw) || (Array.isArray(raw) && raw.length === 0)) missing.push(field);
      }
    }
    return missing;
  }

  /**
   * Training-centre tables left incomplete in a final submission. Every table
   * must carry the status the web form derives from the preliminary quiz
   * (REPORTED or NONE, in `<tableId>_RESPONSE_STATUS`); a REPORTED one must be
   * filled by the same rule as the web form's missingVtTableCells (react-web
   * src/lib/vt-quiz.ts): fixed-row tables every count, row-by-row tables at
   * least one complete row — a specialty its name and counts ("homologué"
   * only when the curriculum exists), a staff row its name, first name and
   * sex. Computed totals are never required. Returns, per table, the status
   * key when the status is missing or the table id when cells are missing.
   * A non-functional or closed centre (1.12) has no tables to check.
   */
  incompleteVtTables(flat: Record<string, unknown>): { id: string; table: SchemaField }[] {
    if (isVtSectionWaived('section2_vocationalTraining', flat)) return [];
    const out: { id: string; table: SchemaField }[] = [];
    const entered = (v: unknown) => !isEmpty(v);
    const isTrue = (v: unknown) => v === true || v === 'true' || v === 'Oui/ Yes' || v === '1';
    for (const section of this.schemaLoader.getEntitySchema('vocationalTraining').sections) {
      for (const field of section.fields) {
        const vt = field.table?.vt;
        const matrix = field.table?.matrix;
        if (!vt || !matrix) continue;
        const statusKey = `${field.id}_RESPONSE_STATUS`;
        const status = flat[statusKey];
        if (status !== 'REPORTED' && status !== 'NONE') {
          out.push({ id: statusKey, table: field });
          continue;
        }
        if (status === 'NONE') continue;
        const rowByRow = vt.progressiveRows || vt.isRoster;
        let startedRows = 0;
        let missing = false;
        for (const rowIds of matrix) {
          const started = rowIds.some((id, c) => vt.cells[c]?.kind !== 'computed' && entered(flat[id]));
          if (rowByRow && !started) continue;
          startedRows++;
          rowIds.forEach((cellId, c) => {
            const cell = vt.cells[c];
            if (!cell || cell.kind === 'computed') return;
            if (vt.isRoster && !['lastName', 'firstName', 'sex'].includes(cell.key)) return;
            if (cell.dependsOnKey) {
              const parentIndex = vt.cells.findIndex((p) => p.key === cell.dependsOnKey);
              if (parentIndex >= 0 && !isTrue(flat[rowIds[parentIndex]])) return;
            }
            if (!entered(flat[cellId])) missing = true;
          });
        }
        if (missing || (rowByRow && startedRows === 0)) out.push({ id: field.id, table: field });
      }
    }
    return out;
  }

  /**
   * Shadow-mode entry point for questionnaires.service.ts: validates and
   * logs, but can never throw or affect the caller — a defect in this new
   * validator must not become a defect in real submissions.
   */
  validateAndLog(
    entityType: string,
    flat: Record<string, unknown>,
    submissionRef: string | undefined,
  ): void {
    try {
      const schemaEntityType = OnefopShadowValidatorService.toSchemaEntityType(entityType);
      if (!schemaEntityType) return;
      const result = this.validate(schemaEntityType, flat);
      if (result.discrepancies.length === 0) {
        this.logger.debug(
          `[shadow] ${schemaEntityType} submission ${submissionRef ?? '(draft)'}: 0 discrepancies (${result.fieldsChecked} fields checked).`,
        );
        return;
      }
      const byCategory: Partial<Record<DiscrepancyCategory, number>> = {};
      for (const d of result.discrepancies) {
        byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
      }
      this.logger.warn(
        `[shadow] ${schemaEntityType} submission ${submissionRef ?? '(draft)'}: ` +
          `${result.discrepancies.length} discrepancies ${JSON.stringify(byCategory)} — ` +
          JSON.stringify(result.discrepancies.slice(0, 20)),
      );
    } catch (e) {
      this.logger.warn(`[shadow] validator crashed, ignoring (never blocks submission): ${(e as Error).message}`);
    }
  }

  private isVisible(field: SchemaField, flat: Record<string, unknown>): boolean {
    if (!field.visibility) return true;
    const dep = flat[field.visibility.dependsOn];
    if (field.visibility.dependsOperator === 'eq') {
      return !isEmpty(dep) && String(dep) === field.visibility.dependsValue;
    }
    // 'contains'
    if (Array.isArray(dep)) return dep.map(String).includes(field.visibility.dependsValue);
    return !isEmpty(dep) && String(dep).includes(field.visibility.dependsValue);
  }

  private splitMultiValue(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String);
    return String(raw)
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private checkFieldType(field: SchemaField, raw: unknown): string | null {
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'tel':
        return typeof raw === 'string' || typeof raw === 'number'
          ? null
          : `Expected text, got ${typeof raw}.`;
      case 'email':
        return String(raw).includes('@') ? null : `Expected an email address, got "${String(raw)}".`;
      case 'number': {
        const n = Number(raw);
        return Number.isFinite(n) ? null : `Expected a number, got "${String(raw)}".`;
      }
      case 'date': {
        const d = new Date(String(raw));
        return Number.isNaN(d.getTime()) ? `Expected a parseable date, got "${String(raw)}".` : null;
      }
      case 'select':
      case 'radio': {
        if (!field.options) return null;
        const allowed = new Set(field.options.map((o) => o.value));
        return allowed.has(String(raw))
          ? null
          : `Value "${String(raw)}" is not one of the schema's declared options.`;
      }
      case 'checkbox': {
        if (!field.options) return null;
        const allowed = new Set(field.options.map((o) => o.value));
        const bad = this.splitMultiValue(raw).filter((v) => !allowed.has(v));
        return bad.length
          ? `Value(s) ${JSON.stringify(bad)} are not among the schema's declared options.`
          : null;
      }
      default:
        // Undeclared/unknown type — nothing in the schema to assert against.
        return null;
    }
  }

  private validateTable(field: SchemaField, flat: Record<string, unknown>, out: ShadowDiscrepancy[]): void {
    const table = field.table;
    if (!table) return;
    // Classic templates with no extractable cell data (activities_table etc.)
    // — nothing to check against, and the plan explicitly forbids inferring
    // a layout that isn't schema data (see §2.2's "one real limitation").
    if (table.limitation) return;
    if (table.vt) {
      this.validateVtTable(table, flat, out);
    } else if (table.matrix) {
      this.validateClassicTable(table, flat, out);
    }
  }

  private validateVtTable(table: SchemaTable, flat: Record<string, unknown>, out: ShadowDiscrepancy[]): void {
    const vt = table.vt!;
    const matrix = table.matrix;
    if (!matrix) return;

    vt.rows.forEach((row, i) => {
      const siblingValues: number[] = [];
      let computedCellId: string | null = null;
      let computedActual: number | null = null;

      vt.cells.forEach((cell, j) => {
        const cellId = matrix[i]?.[j];
        if (!cellId) return;
        const raw = flat[cellId];
        const empty = isEmpty(raw);

        if (cell.required && empty) {
          out.push({
            category: 'required',
            fieldId: cellId,
            message: `Table cell (row "${row.id}", column "${cell.key}") is required but missing.`,
          });
        }
        if (empty) return;

        if (cell.kind === 'number' || cell.kind === 'computed') {
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            out.push({
              category: 'type',
              fieldId: cellId,
              message: `Expected a number for column "${cell.key}", got "${String(raw)}".`,
            });
            return;
          }
          if (cell.kind === 'computed') {
            computedCellId = cellId;
            computedActual = n;
          } else {
            siblingValues.push(n);
          }
        }
      });

      if (computedCellId !== null && computedActual !== null) {
        const expected = siblingValues.reduce((a, b) => a + b, 0);
        if (expected !== computedActual) {
          out.push({
            category: 'formula',
            fieldId: computedCellId,
            message: `Computed cell = ${computedActual}, but sum-of-siblings for row "${row.id}" = ${expected}.`,
          });
        }
      }
    });
  }

  private validateClassicTable(table: SchemaTable, flat: Record<string, unknown>, out: ShadowDiscrepancy[]): void {
    if (!table.matrix) return;
    for (const row of table.matrix) {
      for (const cellId of row) {
        const raw = flat[cellId];
        if (isEmpty(raw)) continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          out.push({
            category: 'table-cell-type-assumed',
            fieldId: cellId,
            message: `Classic template "${table.template}" has no schema-declared cell type — assumed numeric but got "${String(raw)}". Not authoritative; see migration plan §2.2.`,
          });
        }
      }
    }
  }
}
