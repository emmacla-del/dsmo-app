import { OnefopSchemaLoaderService } from './onefop-schema-loader.service';
import { OnefopShadowValidatorService } from './onefop-shadow-validator.service';
import type { SchemaField, SchemaTable } from './onefop-schema.types';

// Phase 2.6/2.7 of the migration plan: this validator is genuinely new
// code with no live traffic yet, so — unlike the rest of this backend's
// specs, which regression-test against real historical behavior — these
// tests build synthetic payloads directly from the real generated schema
// (assets/schemas/onefop.schema.json) rather than against a live/staged
// database (there is no staging backend for this project). Running the
// validator against real historical OnefopSubmission.rawData rows (the
// plan's §2.7 "representative Flutter payloads" step) is a deliberately
// separate, DB-touching follow-up — not done here.
describe('OnefopShadowValidatorService', () => {
  const loader = new OnefopSchemaLoaderService();
  const validator = new OnefopShadowValidatorService(loader);

  function sampleValueForField(field: SchemaField): unknown {
    switch (field.type) {
      case 'email':
        return 'user@example.com';
      case 'tel':
        return '+237600000000';
      case 'number':
        return 5;
      case 'date':
        return '2025-01-01';
      case 'select':
      case 'radio':
      case 'checkbox':
        return field.options?.[0]?.value ?? 'N/A';
      default:
        return 'Sample value';
    }
  }

  /**
   * Builds a synthetic but schema-consistent scalar payload: every
   * conditional field's `dependsOn` target is forced to the exact value
   * that satisfies it, so filling every field doesn't itself trigger
   * spurious visibility discrepancies. Table fields are left out entirely
   * (see the per-test comments below for why that's safe).
   *
   * One known limitation, left as-is rather than engineered around: two
   * fields that each require a DIFFERENT value on the same shared
   * `dependsOn` target (e.g. two "if X = A" / "if X = B" mutually
   * exclusive branches) can't both be satisfied by one forced value —
   * whichever is processed last wins, and the other legitimately shows a
   * self-inflicted 'visibility' discrepancy. That's a limitation of this
   * synthetic fixture, not the validator, so the whole-entity test below
   * only asserts on 'required'/'type' discrepancies.
   */
  function buildValidScalarPayload(fields: Map<string, SchemaField>): Record<string, unknown> {
    const forced = new Map<string, string>();
    for (const field of fields.values()) {
      if (field.visibility) forced.set(field.visibility.dependsOn, field.visibility.dependsValue);
    }
    const flat: Record<string, unknown> = {};
    for (const [fieldId, value] of forced) flat[fieldId] = value;
    for (const field of fields.values()) {
      if (field.type === 'table' || field.type === 'repeating_table') continue;
      if (flat[field.id] !== undefined) continue;
      flat[field.id] = sampleValueForField(field);
    }
    return flat;
  }

  it('a fully-populated, schema-consistent CTD payload produces no required/type discrepancies', () => {
    const fields = loader.getFlattenedFields('ctd');
    const flat = buildValidScalarPayload(fields);
    const result = validator.validate('ctd', flat);
    const meaningful = result.discrepancies.filter(
      (d) => d.category === 'required' || d.category === 'type',
    );
    expect(meaningful).toEqual([]);
  });

  it('flags a missing required field as a "required" discrepancy', () => {
    const fields = loader.getFlattenedFields('ctd');
    const requiredField = [...fields.values()].find((f) => f.required && !f.visibility);
    expect(requiredField).toBeDefined();

    const flat = buildValidScalarPayload(fields);
    delete flat[requiredField!.id];

    const result = validator.validate('ctd', flat);
    expect(result.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'required', fieldId: requiredField!.id }),
      ]),
    );
  });

  it('flags an invalid select value as a "type" discrepancy, and a valid one as none', () => {
    const fields = loader.getFlattenedFields('ctd');
    const selectField = [...fields.values()].find(
      (f) => f.type === 'select' && (f.options?.length ?? 0) > 0,
    );
    expect(selectField).toBeDefined();

    const bad = validator.validate('ctd', { [selectField!.id]: '__not_a_real_option__' });
    expect(bad.discrepancies).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'type', fieldId: selectField!.id })]),
    );

    const good = validator.validate('ctd', { [selectField!.id]: selectField!.options![0].value });
    expect(good.discrepancies.filter((d) => d.fieldId === selectField!.id)).toEqual([]);
  });

  it('flags a value present despite an unmet visibility condition', () => {
    const fields = loader.getFlattenedFields('ctd');
    const conditional = [...fields.values()].find((f) => f.visibility);
    expect(conditional).toBeDefined();

    const flat = {
      [conditional!.visibility!.dependsOn]: '__definitely_not_the_expected_value__',
      [conditional!.id]: sampleValueForField(conditional!),
    };
    const result = validator.validate('ctd', flat);
    expect(result.discrepancies).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'visibility', fieldId: conditional!.id })]),
    );
  });

  it('does not flag a conditional field when its visibility condition IS satisfied', () => {
    const fields = loader.getFlattenedFields('ctd');
    const conditional = [...fields.values()].find((f) => f.visibility);
    expect(conditional).toBeDefined();

    const flat = {
      [conditional!.visibility!.dependsOn]: conditional!.visibility!.dependsValue,
      [conditional!.id]: sampleValueForField(conditional!),
    };
    const result = validator.validate('ctd', flat);
    expect(result.discrepancies.filter((d) => d.fieldId === conditional!.id)).toEqual([]);
  });

  describe('sum-of-siblings formula (VT tables)', () => {
    // Find a real VT table field with a computed sum-of-siblings cell —
    // this is the only formula in the whole schema (see the migration
    // plan §2.3), so any table with a `vt` block and a 'computed' cell
    // exercises it.
    function findVtFormulaTable(): { fieldId: string; table: SchemaTable } {
      const fields = loader.getFlattenedFields('vocationalTraining');
      for (const field of fields.values()) {
        const table = field.table;
        if (table?.vt?.cells.some((c) => c.formula === 'sum-of-siblings')) {
          return { fieldId: field.id, table };
        }
      }
      throw new Error('No VT formula table found in the generated schema — schema may have changed.');
    }

    it('accepts a correct sum-of-siblings total and flags an incorrect one', () => {
      const { table } = findVtFormulaTable();
      const vt = table.vt!;
      const row = vt.rows[0];
      const rowIndex = 0;
      const numberCellIndexes = vt.cells
        .map((c, j) => ({ c, j }))
        .filter(({ c }) => c.kind === 'number');
      const computedIndex = vt.cells.findIndex((c) => c.formula === 'sum-of-siblings');
      expect(numberCellIndexes.length).toBeGreaterThan(0);
      expect(computedIndex).toBeGreaterThanOrEqual(0);

      const flatGood: Record<string, unknown> = {};
      let expectedTotal = 0;
      for (const { c, j } of numberCellIndexes) {
        const cellId = table.matrix![rowIndex][j];
        flatGood[cellId] = 3;
        expectedTotal += 3;
      }
      const computedCellId = table.matrix![rowIndex][computedIndex];
      flatGood[computedCellId] = expectedTotal;

      const goodResult = validator.validate('vocationalTraining', flatGood);
      expect(goodResult.discrepancies.filter((d) => d.category === 'formula')).toEqual([]);

      const flatBad = { ...flatGood, [computedCellId]: expectedTotal + 1 };
      const badResult = validator.validate('vocationalTraining', flatBad);
      expect(badResult.discrepancies).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: 'formula', fieldId: computedCellId })]),
      );
      // row is unused beyond documenting which row the ids came from
      void row;
    });
  });

  it('skips classic tables with no extractable cell data (documented §2.2 limitation) without crashing', () => {
    const fields = loader.getFlattenedFields('enterprise');
    const limited = [...fields.values()].find((f) => f.table?.limitation);
    expect(limited).toBeDefined();
    expect(() => validator.validate('enterprise', {})).not.toThrow();
  });

  it('validateAndLog never throws, even for a garbage payload', () => {
    expect(() => validator.validateAndLog('ctd', { S0Q01: { nested: 'object' } }, 'test-submission')).not.toThrow();
    expect(() => validator.validateAndLog('not-a-real-entity-type', {}, undefined)).not.toThrow();
  });
});
