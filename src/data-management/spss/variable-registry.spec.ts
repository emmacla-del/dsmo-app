// src/data-management/spss/variable-registry.spec.ts
//
// E4 — frozen SPSS variable names and value labels. Fails when:
//   - a registered sourcePath now gets a different name;
//   - a registered (non-retired) variable is no longer emitted;
//   - a newly emitted variable is not registered yet (run the script);
//   - two variables (or two registry entries) share a name;
//   - a registered variable's value labels changed (keys or wording).
// Fix by running `npm run spss:registry -- --write` (append new variables),
// `--accept-value-labels` (after checking the label change is intended), or
// `--retire <sourcePath> --reason "..."`. Never edit a registered name.
import { Logger } from '@nestjs/common';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService, AnalyticalVariableDefinition } from '../canonical-schema-adapter.service';
import { DEFAULT_VARIABLE_REGISTRY, VariableRegistry, VariableRegistryFile } from './variable-registry';

const FIX_HINT = 'run `npm run spss:registry` for the full report (see variable-registry.spec.ts header)';

function labelsOf(v: AnalyticalVariableDefinition): Record<string, string> | null {
  return v.valueLabels && Object.keys(v.valueLabels).length > 0 ? v.valueLabels : null;
}

describe('SPSS variable registry (E4 frozen names)', () => {
  let adapter: CanonicalSchemaAdapterService;
  let current: AnalyticalVariableDefinition[];
  const registry = DEFAULT_VARIABLE_REGISTRY;

  beforeAll(() => {
    Logger.overrideLogger(['error']);
    adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
    current = adapter.getAllVariables();
  });

  it('every emitted variable is registered, under its registered name', () => {
    const unregistered: string[] = [];
    const renamed: string[] = [];
    for (const v of current) {
      const entry = registry.file.variables[v.sourcePath];
      if (!entry || entry.retired) unregistered.push(`${v.variableName} (${v.sourcePath})`);
      else if (entry.variableName !== v.variableName) {
        renamed.push(`${v.sourcePath}: registered ${entry.variableName}, now ${v.variableName}`);
      }
    }
    expect({ renamed, unregistered, hint: FIX_HINT }).toEqual({ renamed: [], unregistered: [], hint: FIX_HINT });
  });

  it('no registered name disappears unless it is explicitly retired', () => {
    const emitted = new Set(current.map((v) => v.sourcePath));
    const vanished = registry
      .entries()
      .filter(([path, e]) => !e.retired && !emitted.has(path))
      .map(([path, e]) => `${e.variableName} (${path})`);
    expect({ vanished, hint: FIX_HINT }).toEqual({ vanished: [], hint: FIX_HINT });
  });

  it('variable names are unique (case-insensitive) in the export and in the registry', () => {
    const dupes = (names: string[]) => {
      const seen = new Map<string, number>();
      for (const n of names) seen.set(n.toUpperCase(), (seen.get(n.toUpperCase()) ?? 0) + 1);
      return [...seen].filter(([, c]) => c > 1).map(([n]) => n);
    };
    expect(dupes(current.map((v) => v.variableName))).toEqual([]);
    expect(dupes(registry.entries().map(([, e]) => e.variableName))).toEqual([]);
  });

  it('registered value labels are unchanged (keys and wording)', () => {
    const keyChanges: string[] = [];
    const wordingChanges: string[] = [];
    for (const v of current) {
      const entry = registry.file.variables[v.sourcePath];
      if (!entry || entry.retired) continue;
      const now = labelsOf(v);
      const was = entry.valueLabels;
      const nowKeys = Object.keys(now ?? {}).sort().join('|');
      const wasKeys = Object.keys(was ?? {}).sort().join('|');
      if (nowKeys !== wasKeys) keyChanges.push(`${entry.variableName}: [${wasKeys}] -> [${nowKeys}]`);
      else if (JSON.stringify(now) !== JSON.stringify(was)) wordingChanges.push(entry.variableName);
    }
    expect({ keyChanges, wordingChanges, hint: FIX_HINT }).toEqual({ keyChanges: [], wordingChanges: [], hint: FIX_HINT });
  });

  it('a new sourcePath never takes a registered name, even a retired one', () => {
    // Retire the system region variable: its sourcePath is still emitted but
    // now counts as new, while its old name "region" stays reserved.
    const file: VariableRegistryFile = JSON.parse(JSON.stringify(registry.file));
    file.variables['submission.region'].retired = 'test';
    const a = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
    a.useVariableRegistry(new VariableRegistry(file));
    const vars = a.getAllVariables();
    const region = vars.find((v) => v.sourcePath === 'submission.region')!;
    expect(region.variableName).toBe('region_2');
    // Every other variable keeps its frozen name.
    const others = vars.filter((v) => v.sourcePath !== 'submission.region');
    for (const v of others) expect(v.variableName).toBe(file.variables[v.sourcePath].variableName);
  });

  it('registered names win over regenerated ones when schema order changes', () => {
    // With an empty registry the names are regenerated in schema order; with
    // the real one they come from the registry. Today both agree — this
    // pins that the registry, not the generator, is what the adapter uses.
    const file: VariableRegistryFile = JSON.parse(JSON.stringify(registry.file));
    const sp = current.find((v) => v.sourcePath.startsWith('matrix.'))!.sourcePath;
    file.variables[sp] = { ...file.variables[sp], variableName: 'FROZEN_TEST_NAME' };
    const a = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
    a.useVariableRegistry(new VariableRegistry(file));
    expect(a.getAllVariables().find((v) => v.sourcePath === sp)!.variableName).toBe('FROZEN_TEST_NAME');
  });
});
