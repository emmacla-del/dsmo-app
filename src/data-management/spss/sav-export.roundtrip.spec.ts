// End-to-end check of the native .sav export against an independent reader.
// Exports synthetic submissions through the real canonical variable registry
// and DataManagementService, then reads the file back with pyreadstat and
// compares dictionary + every cell. Skipped where python/pyreadstat is absent
// (the production server no longer needs them — only this verification does).
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService, type AnalyticalVariableDefinition } from '../canonical-schema-adapter.service';
import { DataManagementService } from '../data-management.service';
import { toSavNumber, toSavString, truncateUtf8 } from './sav-writer';

const PY_READER = `
import json, math, sys, pyreadstat
df, meta = pyreadstat.read_sav(sys.argv[1], user_missing=True)
def clean(v):
    if isinstance(v, float) and math.isnan(v): return None
    return v
print(json.dumps({
  "n": meta.number_rows,
  "names": list(df.columns),
  "labels": meta.column_labels,
  "formats": meta.original_variable_types,
  "measures": meta.variable_measure,
  "valueLabels": {k: {str(kk): vv for kk, vv in v.items()} for k, v in meta.variable_value_labels.items()},
  "missing": {k: v for k, v in meta.missing_ranges.items()},
  "encoding": meta.file_encoding,
  "rows": [[clean(v) for v in row] for row in df.itertuples(index=False, name=None)],
}, ensure_ascii=False))
`;

function pyreadstatAvailable(): boolean {
  try {
    execFileSync('python', ['-c', 'import pyreadstat'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const NUMERIC_SAMPLES: unknown[] = [0, 7, -99, 1234.5, 151, 152, 1e9, null, '42', 'x', -3.25, 99];
const STRING_SAMPLES: unknown[] = [
  'Extrême-Nord, "Wouri"',
  'é'.repeat(300),
  '',
  'Brasseries du Cameroun 😀',
  new Date('2026-09-18T16:45:00Z'),
  null,
];

function setPath(obj: any, keys: string[], value: unknown) {
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = cur[k] ??= {};
  cur[keys[keys.length - 1]] = value;
}

function sampleFor(v: AnalyticalVariableDefinition, row: number, col: number): unknown {
  if (v.spssDataType === 'NUMERIC') {
    const numericKeys = Object.keys(v.valueLabels ?? {}).filter((k) => toSavNumber(k) !== null);
    if (numericKeys.length > 0 && (row + col) % 3 !== 0) return Number(numericKeys[(row + col) % numericKeys.length]);
    return NUMERIC_SAMPLES[(row + col) % NUMERIC_SAMPLES.length];
  }
  const keys = Object.keys(v.valueLabels ?? {});
  if (keys.length > 0 && (row + col) % 2 === 0) return keys[(row + col) % keys.length];
  return STRING_SAMPLES[(row + col) % STRING_SAMPLES.length];
}

function buildSubmission(variables: AnalyticalVariableDefinition[], row: number, formType: string) {
  const sub: any = { id: `id-${String(row).padStart(5, '0')}`, formType, rawData: {}, company: {} };
  variables.forEach((v, col) => {
    const value = sampleFor(v, row, col);
    const [kind, ...rest] = v.sourcePath.split('.');
    if (kind === 'submission') sub[rest[0]] = value;
    else if (kind === 'company') sub.company[rest[0]] = value;
    else if (kind === 'respondent') setPath(sub.rawData, ['respondent', rest[0]], value);
    else if (kind === 'detail') setPath(sub.rawData, [rest[0], rest[1]], value);
    else if (kind === 'matrix') sub.rawData[rest[1]] = value;
    else if (kind !== 'indexed') sub.rawData[v.variableName] = value;
  });
  sub.formType = formType; // keep the row's real type even if a variable sampled it
  return sub;
}

function fakePrisma(submissions: any[]) {
  return {
    // Reference periods (periodStart/periodEnd) come from the round table.
    submissionRound: { findMany: async () => [] },
    onefopSubmission: {
      findMany: async ({ take, cursor }: { take: number; cursor?: { id: string } }) => {
        const start = cursor ? submissions.findIndex((s) => s.id === cursor.id) + 1 : 0;
        return submissions.slice(start, start + take);
      },
    },
  };
}

function fakeResponse() {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(c));
  const res: any = stream;
  res.headers = {};
  res.headersSent = false;
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; res.end(); };
  const done = new Promise<Buffer>((resolve) => stream.on('end', () => resolve(Buffer.concat(chunks))));
  return { res, done };
}

const describeIfPy = pyreadstatAvailable() ? describe : describe.skip;

describeIfPy('native .sav export — pyreadstat round trip', () => {
  const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sav-roundtrip-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  async function roundTrip(partition: 'DEMAND' | 'TVET', formType: string, rows: number) {
    const variables = adapter.getVariablesForPartition(partition);
    const submissions = Array.from({ length: rows }, (_, i) => buildSubmission(variables, i, formType));
    const service = new DataManagementService(fakePrisma(submissions) as any, undefined, adapter);
    const { res, done } = fakeResponse();
    await service.streamApprovedOnefopSubmissionsSav({ partition, statuses: 'APPROVED' } as any, res);
    const bytes = await done;
    expect(res.statusCode).not.toBe(500);
    expect(res.headers['Content-Type']).toBe('application/x-spss-sav');

    const file = path.join(tmp, `${partition}.sav`);
    const script = path.join(tmp, 'read.py');
    fs.writeFileSync(file, bytes);
    fs.writeFileSync(script, PY_READER);
    const out = JSON.parse(execFileSync('python', [script, file], { maxBuffer: 512 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString('utf8'));
    return { variables, submissions, out };
  }

  it.each([
    ['DEMAND', 'ENTREPRISE', 260],
    ['TVET', 'VOCATIONAL_TRAINING', 12],
  ] as const)('%s: dictionary and every cell survive the round trip', async (partition, formType, rows) => {
    const { variables, submissions, out } = await roundTrip(partition, formType, rows);

    expect(out.n).toBe(rows);
    expect(out.encoding).toBe('UTF-8');
    expect(out.names).toEqual(variables.map((v) => v.variableName));

    variables.forEach((v, col) => {
      const name = v.variableName;
      expect(out.labels[col]).toBe(truncateUtf8(v.labelFr || v.labelEn || name, 255).toString('utf8'));
      if (v.spssDataType === 'NUMERIC') {
        expect(out.formats[name]).toMatch(/^F\d+\.0$/);
        expect(out.missing[name]).toEqual([{ lo: -99, hi: -99 }]);
      } else {
        expect(out.formats[name]).toBe(`A${v.spssWidth || 254}`);
        expect(out.measures[name]).toBe('nominal');
      }
      const numericLabels = Object.entries(v.valueLabels ?? {}).filter(([k]) => toSavNumber(k) !== null);
      if (v.spssDataType === 'NUMERIC' && numericLabels.length > 0) {
        for (const [k, lbl] of numericLabels) {
          const got = out.valueLabels[name]?.[String(Number(k))] ?? out.valueLabels[name]?.[`${Number(k)}.0`];
          expect(got).toBe(truncateUtf8(lbl, 120).toString('utf8'));
        }
      }
    });

    // Guard against a vacuous pass: most cells must actually carry a value.
    const filled = submissions.reduce(
      (n, s) => n + variables.filter((v) => toSavString(adapter.extractValue(v, s)) !== '').length,
      0,
    );
    expect(filled / (submissions.length * variables.length)).toBeGreaterThan(0.5);

    submissions.forEach((s, r) => {
      variables.forEach((v, col) => {
        const raw = adapter.extractValue(v, s);
        const got = out.rows[r][col];
        if (v.spssDataType === 'NUMERIC') {
          expect([r, v.variableName, got]).toEqual([r, v.variableName, toSavNumber(raw)]);
        } else {
          const expected = truncateUtf8(toSavString(raw), v.spssWidth || 254).toString('utf8').trimEnd();
          expect([r, v.variableName, got]).toEqual([r, v.variableName, expected]);
        }
      });
    });
  }, 180000);
});
