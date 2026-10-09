// scripts/spss-variable-registry.ts
//
// Maintains src/data-management/spss/variable-registry.frozen.json — the frozen
// SPSS variable names (E4, see src/data-management/spss/variable-registry.ts).
//
//   npm run spss:registry                       report only (exit 1 if the registry is behind)
//   npm run spss:registry -- --write            register every new sourcePath (append-only)
//   npm run spss:registry -- --write --accept-value-labels
//                                               also overwrite the registered value labels
//                                               of variables whose labels changed upstream
//   npm run spss:registry -- --write --retire <sourcePath> --reason "<why>"
//                                               mark a variable that is no longer emitted
//
// Registered names are never changed by this script: an existing sourcePath
// keeps its name, a retired one keeps its name reserved.
import { Logger } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OnefopSchemaLoaderService } from '../src/onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService } from '../src/data-management/canonical-schema-adapter.service';
import { VariableRegistry, VariableRegistryFile } from '../src/data-management/spss/variable-registry';

const REGISTRY_PATH = join(__dirname, '..', 'src', 'data-management', 'spss', 'variable-registry.frozen.json');

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sameLabels(a: Record<string, string> | null, b: Record<string, string> | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function main() {
  Logger.overrideLogger(['error']);
  const write = process.argv.includes('--write');
  const acceptLabels = process.argv.includes('--accept-value-labels');
  const retire = argValue('--retire');
  const reason = argValue('--reason');

  const file = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as VariableRegistryFile;
  file.variables = file.variables ?? {};

  if (retire) {
    const entry = file.variables[retire];
    if (!entry) throw new Error(`--retire: "${retire}" is not registered`);
    if (!reason) throw new Error('--retire needs --reason "<why>"');
    entry.retired = reason;
  }

  const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
  adapter.useVariableRegistry(new VariableRegistry(file));
  const current = adapter.getAllVariables();
  const currentPaths = new Set(current.map((v) => v.sourcePath));

  const added: string[] = [];
  const labelChanges: string[] = [];
  for (const v of current) {
    const entry = file.variables[v.sourcePath];
    const labels = v.valueLabels && Object.keys(v.valueLabels).length > 0 ? v.valueLabels : null;
    if (!entry || entry.retired) {
      if (entry?.retired) {
        throw new Error(
          `"${v.sourcePath}" is retired but emitted again — un-retire it by hand (remove "retired") so it keeps "${entry.variableName}".`,
        );
      }
      file.variables[v.sourcePath] = { variableName: v.variableName, valueLabels: labels };
      added.push(`${v.variableName}  (${v.sourcePath})`);
    } else if (!sameLabels(entry.valueLabels, labels)) {
      labelChanges.push(`${entry.variableName}  (${v.sourcePath})`);
      if (acceptLabels) entry.valueLabels = labels;
    }
  }

  const missing = Object.entries(file.variables)
    .filter(([path, e]) => !e.retired && !currentPaths.has(path))
    .map(([path, e]) => `${e.variableName}  (${path})`);

  console.log(`Variables emitted: ${current.length}; registered: ${Object.keys(file.variables).length}`);
  console.log(`New (registered with --write): ${added.length}`);
  added.forEach((a) => console.log(`  + ${a}`));
  console.log(`Value labels changed${acceptLabels ? ' (accepted)' : ''}: ${labelChanges.length}`);
  labelChanges.forEach((a) => console.log(`  ~ ${a}`));
  console.log(`Registered but no longer emitted (retire them explicitly): ${missing.length}`);
  missing.forEach((a) => console.log(`  - ${a}`));

  if (write) {
    writeFileSync(REGISTRY_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${REGISTRY_PATH}`);
  }
  const behind = added.length > 0 || (labelChanges.length > 0 && !acceptLabels) || missing.length > 0;
  if (!write && behind) process.exitCode = 1;
}

main();
