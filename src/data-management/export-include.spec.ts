import { DataManagementService } from './data-management.service';
import { CanonicalSchemaAdapterService, AnalyticalPartition } from './canonical-schema-adapter.service';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';

/**
 * Defect 12 (2026-10-16 VT run): every export batch loaded all ~37 relations
 * of a submission, one query each, although an employers' (DEMAND) export
 * never reads a training-centre table and a TVET export never reads an
 * employer table. The canonical .csv/.sav now load only their population's
 * relations (partitionInclude). This proves no variable of a population
 * reads a relation that is no longer loaded: with rawData empty, every value
 * falls through to the relations, and a Proxy records which ones are read.
 */
describe('export include per population', () => {
  const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
  const service = new DataManagementService({} as any, undefined, adapter);
  const fullInclude = Object.keys((service as any).approvedOnefopInclude());

  function relationsRead(partition: AnalyticalPartition, formType: string): Set<string> {
    const read = new Set<string>();
    const target: Record<string, unknown> = { id: 's1', submissionId: 'ref', formType, rawData: {} };
    for (const key of fullInclude) target[key] = key === 'company' || key === 'respondent' || key.endsWith('Detail') ? {} : [];
    const submission = new Proxy(target, {
      get(t, prop: string) {
        if (fullInclude.includes(prop)) read.add(prop);
        return t[prop];
      },
    });
    for (const v of adapter.getVariablesForPartition(partition)) adapter.exportValue(v, submission);
    return read;
  }

  it.each([
    ['TVET', 'VOCATIONAL_TRAINING'],
    ['DEMAND', 'ENTREPRISE'],
    ['DEMAND', 'PROJECT_PROGRAM'],
    ['DEMAND', 'ADMINISTRATION'],
  ] as const)('a %s export (%s) reads only relations it loads', (partition, formType) => {
    const loaded = new Set(Object.keys((service as any).partitionInclude(partition)));
    const read = relationsRead(partition, formType);
    // The probe sees reads at all: each population reads its own tables.
    expect(read.has(partition === 'TVET' ? 'vtDiplomaData' : 'cspGenderAge')).toBe(true);
    const missing = [...read].filter((r) => !loaded.has(r));
    expect(missing).toEqual([]);
  });

  it('narrows the include: TVET and DEMAND split the relations, ALL keeps them all', () => {
    const tvet = Object.keys((service as any).partitionInclude('TVET'));
    const demand = Object.keys((service as any).partitionInclude('DEMAND'));
    expect(Object.keys((service as any).partitionInclude('ALL')).sort()).toEqual([...fullInclude].sort());
    expect(tvet.length).toBeLessThan(fullInclude.length / 2);
    expect(tvet).toEqual(expect.arrayContaining(['company', 'respondent', 'vocationalTrainingDetail', 'vtDiplomaData']));
    expect(demand).not.toContain('vtDiplomaData');
    expect(demand).toEqual(expect.arrayContaining(['company', 'respondent', 'enterpriseDetail', 'cspGenderAge']));
    expect(new Set([...tvet, ...demand]).size).toBe(fullInclude.length);
  });
});
