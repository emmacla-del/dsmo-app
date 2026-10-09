// src/data-management/spss/variable-registry.ts
//
// Frozen SPSS variable names (E4).
//
// CanonicalSchemaAdapterService used to derive every variable name from the
// AST ids on each build (generateSpssVariableName), deduplicating with an
// order-dependent _2/_3 suffix. Any reordering or new field upstream could
// therefore silently rename a variable that analysts' syntax already relies
// on. variable-registry.frozen.json pins the name (and value labels) of every
// variable that has ever been exported, keyed by its sourcePath, which is
// stable across builds:
//
//   - a sourcePath found in the registry always gets its registered name;
//   - only a genuinely new sourcePath gets a generated name, which can never
//     collide with any registered name (retired ones included);
//   - a registered name is never changed or reused. A variable that goes
//     away must be marked `retired` (with a reason) — its name stays
//     reserved.
//
// variable-registry.spec.ts enforces those rules; regenerate/extend the
// JSON with `npm run spss:registry -- --write` (scripts/spss-variable-registry.ts).
import registryJson from './variable-registry.frozen.json';

export interface RegisteredVariable {
  variableName: string;
  /** Value labels as exported when the variable was registered (null = none). */
  valueLabels: Record<string, string> | null;
  /** Set when the variable is no longer emitted. The name stays reserved. */
  retired?: string;
}

export interface VariableRegistryFile {
  description?: string;
  variables: Record<string, RegisteredVariable>;
}

export class VariableRegistry {
  private readonly reservedUpper: Set<string>;

  constructor(readonly file: VariableRegistryFile) {
    this.reservedUpper = new Set(
      Object.values(file.variables).map((v) => v.variableName.toUpperCase()),
    );
  }

  static empty(): VariableRegistry {
    return new VariableRegistry({ variables: {} });
  }

  /** The frozen name for an active (non-retired) sourcePath, if any. */
  nameFor(sourcePath: string): string | undefined {
    const entry = this.file.variables[sourcePath];
    return entry && !entry.retired ? entry.variableName : undefined;
  }

  /** Every registered name, retired included, upper-cased (SPSS names are case-insensitive). */
  reservedNamesUpper(): Set<string> {
    return new Set(this.reservedUpper);
  }

  entries(): Array<[string, RegisteredVariable]> {
    return Object.entries(this.file.variables);
  }
}

export const DEFAULT_VARIABLE_REGISTRY = new VariableRegistry(
  registryJson as unknown as VariableRegistryFile,
);
