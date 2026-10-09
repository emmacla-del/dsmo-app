import { OnefopSchemaLoaderService } from './onefop-schema-loader.service';
import { OnefopShadowValidatorService } from './onefop-shadow-validator.service';
import type { SchemaEntityType, SchemaField } from './onefop-schema.types';

// Visibility parity with the web form (react-web src/lib/onefop-schema.ts
// isFieldVisible, tested in onefop-visibility-parity.test.ts): for every
// visibility rule of assets/schemas/onefop.schema.json and every answer its
// parent can take, the server's evaluation must equal
//   eq:       answer === dependsValue
//   contains: the answer list includes dependsValue (String.includes for a
//             scalar answer).
// isVisible is private, so it is observed through validate(): a filled
// question whose condition is not met is reported as a 'visibility'
// discrepancy, and only then.
describe('ONEFOP visibility rules — server semantics', () => {
  const loader = new OnefopSchemaLoaderService();
  const validator = new OnefopShadowValidatorService(loader);
  const entityTypes: SchemaEntityType[] = [
    'enterprise',
    'cooperative',
    'ctd',
    'ong',
    'administration',
    'projectProgram',
    'vocationalTraining',
  ];

  function expected(field: SchemaField, value: unknown): boolean {
    const v = field.visibility!;
    if (v.dependsOperator === 'contains') {
      if (Array.isArray(value)) return value.includes(v.dependsValue);
      return typeof value === 'string' && value.includes(v.dependsValue);
    }
    return value === v.dependsValue;
  }

  function serverSaysVisible(entityType: SchemaEntityType, field: SchemaField, value: unknown): boolean {
    const flat: Record<string, unknown> = { [field.id]: 'filled' };
    if (value !== undefined) flat[field.visibility!.dependsOn] = value;
    const { discrepancies } = validator.validate(entityType, flat);
    return !discrepancies.some((d) => d.category === 'visibility' && d.fieldId === field.id);
  }

  it.each(entityTypes)('%s: every rule agrees with eq/contains for every parent answer', (entityType) => {
    const fields = loader.getFlattenedFields(entityType);
    for (const field of fields.values()) {
      if (!field.visibility) continue;
      // Tables are not evaluated by isVisible in validate(); none is conditional today.
      expect(field.type === 'table' || field.type === 'repeating_table').toBe(false);
      const parent = fields.get(field.visibility.dependsOn);
      expect(parent).toBeDefined();
      const options = (parent!.options ?? []).map((o) => o.value);
      const values: unknown[] = [undefined, '', ...options];
      if (parent!.type === 'checkbox') {
        values.push([], options.slice());
        for (const o of options) values.push([o]);
      }
      for (const value of values) {
        const actual = serverSaysVisible(entityType, field, value);
        if (actual !== expected(field, value)) {
          throw new Error(
            `${entityType}.${field.id} with ${field.visibility.dependsOn}=${JSON.stringify(value)}: ` +
              `server ${actual}, expected ${expected(field, value)}`,
          );
        }
      }
    }
  });

  it('the schema has visibility rules to check', () => {
    const total = entityTypes.reduce(
      (n, e) => n + [...loader.getFlattenedFields(e).values()].filter((f) => f.visibility).length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });
});
