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
import { SAV_NCASES_OFFSET, SavWriter, toSavNumber, toSavString, truncateUtf8, type SavVariable } from './sav-writer';

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
  "displayWidths": meta.variable_display_width,
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

/** ~1500 bytes of accented French free text (1,000+ characters). */
const LONG_FRENCH = (
  'Perspectives : élargir l’offre de formation à l’Extrême-Nord et au Sud-Ouest ; ' +
  'créer des filières « métiers verts » (énergie solaire, maraîchage) ; ' +
  'renforcer l’apprentissage en entreprise ; équiper les ateliers ; former les formateurs. '
).repeat(6).slice(0, 1000) + 'é'.repeat(250) + ' — fin.';

function setPath(obj: any, keys: string[], value: unknown) {
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = cur[k] ??= {};
  cur[keys[keys.length - 1]] = value;
}

function sampleFor(v: AnalyticalVariableDefinition, row: number, col: number): unknown {
  // Free-text (textarea, A2000) variables: a long accented answer on most rows.
  if (v.spssDataType !== 'NUMERIC' && v.spssWidth > 255 && row % 4 !== 3) return LONG_FRENCH;
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

// Set SAV_ROUNDTRIP_REQUIRED=1 (e.g. in CI with pyreadstat) to fail instead of skipping.
const PY_AVAILABLE = pyreadstatAvailable();
if (!PY_AVAILABLE && process.env.SAV_ROUNDTRIP_REQUIRED === '1') {
  throw new Error('SAV_ROUNDTRIP_REQUIRED=1 but python/pyreadstat is not available');
}
const describeIfPy = PY_AVAILABLE ? describe : describe.skip;

function readSav(dir: string, file: string) {
  const script = path.join(dir, 'read.py');
  fs.writeFileSync(script, PY_READER);
  return JSON.parse(execFileSync('python', [script, file], { maxBuffer: 512 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString('utf8'));
}

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
    fs.writeFileSync(file, bytes);
    const out = readSav(tmp, file);
    return { variables, submissions, out, headers: res.headers };
  }

  it.each([
    ['DEMAND', 'ENTREPRISE', 260],
    ['TVET', 'VOCATIONAL_TRAINING', 12],
  ] as const)('%s: dictionary and every cell survive the round trip', async (partition, formType, rows) => {
    const { variables, submissions, out, headers } = await roundTrip(partition, formType, rows);

    expect(out.n).toBe(rows);
    expect(out.encoding).toBe('UTF-8');
    expect(out.names).toEqual(variables.map((v) => v.variableName));

    variables.forEach((v, col) => {
      const name = v.variableName;
      expect(out.labels[col]).toBe(truncateUtf8(v.labelFr || v.labelEn || name, 255).toString('utf8'));
      if (v.spssDataType === 'NUMERIC') {
        expect(out.formats[name]).toMatch(/^F\d+\.0$/);
        expect(out.missing[name]).toEqual([{ lo: -98, hi: -98 }, { lo: -99, hi: -99 }]);
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

    // E8 (v6): free-text variables are A2000 and their long answers survive whole.
    const wide = variables.filter((v) => v.spssDataType !== 'NUMERIC' && v.spssWidth > 255);
    if (partition === 'TVET') {
      expect(wide.map((v) => v.variableName).sort()).toEqual(['VT3_10', 'VT9_3', 'VT9_4']);
    } else {
      expect(wide).toEqual([]);
    }
    for (const v of wide) {
      expect(v.spssWidth).toBe(2000);
      const carried = submissions.filter((s) => toSavString(adapter.exportValue(v, s)) === LONG_FRENCH).length;
      expect(carried).toBeGreaterThan(0);
      const col = variables.indexOf(v);
      expect(out.rows.filter((r: unknown[]) => r[col] === LONG_FRENCH).length).toBe(carried);
    }

    // Values still wider than their declared width are counted and reported.
    const over = new Map<string, number>();
    submissions.forEach((s) => variables.forEach((v) => {
      if (v.spssDataType === 'NUMERIC') return;
      if (Buffer.byteLength(toSavString(adapter.exportValue(v, s)), 'utf8') > (v.spssWidth || 254)) {
        over.set(v.variableName, (over.get(v.variableName) ?? 0) + 1);
      }
    }));
    expect(Number(headers['X-Export-Truncated-Values'])).toBe([...over.values()].reduce((a, b) => a + b, 0));
    for (const v of wide) expect(over.has(v.variableName)).toBe(false);

    // Guard against a vacuous pass: most cells must actually carry a value.
    const filled = submissions.reduce(
      (n, s) => n + variables.filter((v) => toSavString(adapter.extractValue(v, s)) !== '').length,
      0,
    );
    expect(filled / (submissions.length * variables.length)).toBeGreaterThan(0.5);

    submissions.forEach((s, r) => {
      variables.forEach((v, col) => {
        const raw = adapter.exportValue(v, s);
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

describeIfPy('SavWriter very long strings — pyreadstat round trip', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sav-vls-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const vars: SavVariable[] = [
    { name: 'id', label: 'Identifiant', type: 'numeric', width: 8, missingValues: [-98, -99] },
    { name: 'VT9_4', label: 'Citer les 5 principales perspectives', type: 'string', width: 2000 },
    { name: 'court', label: 'Raison sociale', type: 'string', width: 20, valueLabels: { REPORTED: 'Chiffres déclarés' } },
    { name: 'VT9_3', label: 'Autre (à préciser)', type: 'string', width: 600 },
    { name: 'montant', label: 'Montant', type: 'numeric', width: 14, decimals: 0 },
    { name: 'VT3_10', label: 'Description du dispositif', type: 'string', width: 2000, valueLabels: { AUCUN: 'Aucun dispositif', NSP: 'Ne sait pas' } },
  ];
  const rows: unknown[][] = [
    [1, LONG_FRENCH, 'REPORTED', 'é'.repeat(290), 1234567, 'AUCUN'],
    [2, '', 'abc', '', null, LONG_FRENCH + LONG_FRENCH], // the last is > 2000 bytes: cut + counted
    [-98, 'x', '', 'Ligne 1\nLigne 2 ; « guillemets »', 0, ''],
    [3, 'é'.repeat(1000), 'Extrême', 'z'.repeat(600), 42.5, 'NSP'],
  ];

  function write() {
    const w = new SavWriter(vars, { fileLabel: 'VLS test' });
    const parts = [w.header(), ...rows.map((r) => w.encodeCase(r)), w.finish()];
    const bytes = Buffer.concat(parts);
    bytes.writeInt32LE(w.casesWritten, SAV_NCASES_OFFSET);
    const file = path.join(tmp, 'vls.sav');
    fs.writeFileSync(file, bytes);
    return { w, out: readSav(tmp, file) };
  }

  it('a 1500-byte accented French answer and other very long strings survive intact', () => {
    expect(Buffer.byteLength(LONG_FRENCH, 'utf8')).toBeGreaterThanOrEqual(1500);
    expect(Buffer.byteLength(LONG_FRENCH, 'utf8')).toBeLessThanOrEqual(2000);
    const { w, out } = write();

    expect(out.n).toBe(rows.length);
    expect(out.encoding).toBe('UTF-8');
    expect(out.names).toEqual(vars.map((v) => v.name));
    expect(out.labels).toEqual(vars.map((v) => v.label));
    expect(out.formats).toEqual({ id: 'F8.0', VT9_4: 'A2000', court: 'A20', VT9_3: 'A600', montant: 'F14.0', VT3_10: 'A2000' });
    expect(out.missing.id).toEqual([{ lo: -98, hi: -98 }, { lo: -99, hi: -99 }]);

    rows.forEach((row, r) => {
      vars.forEach((v, c) => {
        const expected = v.type === 'numeric'
          ? toSavNumber(row[c])
          : truncateUtf8(toSavString(row[c]), v.width).toString('utf8').trimEnd();
        expect([r, v.name, out.rows[r][c]]).toEqual([r, v.name, expected]);
      });
    });
    expect(out.rows[0][1]).toBe(LONG_FRENCH);
    expect(out.rows[3][1]).toBe('é'.repeat(1000));
    expect(out.rows[3][3]).toBe('z'.repeat(600));
    expect(Object.fromEntries(w.truncatedValues)).toEqual({ VT3_10: 1 });
  });

  it('keeps value labels on short and very long string variables', () => {
    const { out } = write();
    expect(out.valueLabels.court).toEqual({ REPORTED: 'Chiffres déclarés' });
    expect(out.valueLabels.VT3_10).toEqual({ AUCUN: 'Aucun dispositif', NSP: 'Ne sait pas' });
  });
});
