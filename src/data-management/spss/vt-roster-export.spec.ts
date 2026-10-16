// 8.8 named staff list export (spss/vt-roster-export.ts): coding, selection,
// access, and a .sav round trip through pyreadstat where it is installed.
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { UserRole } from '@prisma/client';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService } from '../canonical-schema-adapter.service';
import { DataManagementController } from '../data-management.controller';
import { DataManagementService } from '../data-management.service';
import { VT_ROSTER_DATASET_VERSION, vtRosterColumns } from './vt-roster-export';

const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());

// The roster stored for submission b1a1404c (VT E2E run, 2026-10-15), plus a
// second person with the codes the first one does not use.
function submission(id = 'b1a1404c-cc71-4727-8407-710fed7d2259') {
  return {
    id,
    submissionId: id,
    establishmentId: 'b2a644ce-22eb-487d-bf67-ae20050c1d9c',
    formType: 'VOCATIONAL_TRAINING',
    status: 'APPROVED',
    quarterCode: 'QUARTERLY_2026_T4_001',
    region: 'Littoral',
    department: 'Wouri',
    company: { name: 'CFP Test E2E Douala' },
    rawData: {},
    vtTrainerRoster: [
      {
        rowIndex: 1, lastName: 'Testeur', firstName: 'Jean', sex: '1', trainerStatus: '3',
        isAdminPersonnel: false, academicDiploma: 'LICENCE', professionalDiploma: 'BTS_HND',
      },
      {
        rowIndex: 2, lastName: 'Ngo Bassa', firstName: 'Marie, Claire', sex: '2', trainerStatus: '1',
        isAdminPersonnel: true, academicDiploma: 'SANS_DIPLOME_ACADEMIQUE', professionalDiploma: null,
      },
    ],
  };
}

function fakePrisma(rows: any[]) {
  const calls: any[] = [];
  return {
    calls,
    onefopSubmission: {
      findMany: async (args: any) => {
        calls.push(args);
        const start = args.cursor ? rows.findIndex((s) => s.id === args.cursor.id) + 1 : 0;
        return rows.slice(start, start + args.take);
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

describe('8.8 named staff list export', () => {
  it('codes sex and status by their own codes and diplomas by schema position', () => {
    const cols = vtRosterColumns(adapter.getSchemaLoader());
    const byName = Object.fromEntries(cols.map((c) => [c.variable.name, c]));
    const [jean, marie] = submission().vtTrainerRoster as any[];
    expect(cols.map((c) => c.variable.name)).toEqual([
      'rowIndex', 'lastName', 'firstName', 'sex', 'trainerStatus', 'isAdminPersonnel', 'academicDiploma', 'professionalDiploma',
    ]);
    expect(byName.sex.value(jean)).toBe(1);
    expect(byName.trainerStatus.value(jean)).toBe(3);
    expect(byName.isAdminPersonnel.value(jean)).toBe(0);
    expect(byName.isAdminPersonnel.value(marie)).toBe(1);
    expect(byName.academicDiploma.value(jean)).toBe(4); // licence, 4th option
    expect(byName.academicDiploma.value(marie)).toBe(11);
    expect(byName.professionalDiploma.value(jean)).toBe(5); // bts_hnd, 5th option
    expect(byName.professionalDiploma.value(marie)).toBeUndefined();
    expect(byName.academicDiploma.variable.valueLabels?.['4']).toBe('Licence');
    expect(byName.trainerStatus.variable.valueLabels).toEqual({
      '1': 'Vacataire professionnel', '2': 'Vacataire non professionnel', '3': 'Permanent',
    });
  });

  it('writes one CSV row per person, with the context variables of the main dataset', async () => {
    const prisma = fakePrisma([submission()]);
    const service = new DataManagementService(prisma as any, undefined, adapter);
    const { res, done } = fakeResponse();
    await service.streamVtRosterCsv({ statuses: ['APPROVED'] } as any, res);
    const lines = (await done).toString('utf8').replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'submissionId,establishmentId,companyName,region,department,quarterCode,status,' +
      'rowIndex,lastName,firstName,sex,trainerStatus,isAdminPersonnel,academicDiploma,professionalDiploma',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      'b1a1404c-cc71-4727-8407-710fed7d2259,b2a644ce-22eb-487d-bf67-ae20050c1d9c,CFP Test E2E Douala,Littoral,Wouri,' +
      'QUARTERLY_2026_T4_001,APPROVED,1,Testeur,Jean,1,3,0,4,5',
    );
    expect(lines[2]).toContain(',2,Ngo Bassa,"Marie, Claire",2,1,1,11,');
    expect(res.headers['X-Roster-Dataset-Version']).toBe(String(VT_ROSTER_DATASET_VERSION));
  });

  it('selects training-centre files only, within the caller territory and the statistical eligibility rule', async () => {
    const prisma = fakePrisma([]);
    const service = new DataManagementService(prisma as any, undefined, adapter);
    const { res, done } = fakeResponse();
    await service.streamVtRosterCsv(
      { entityType: 'ENTREPRISE', statuses: ['APPROVED'] } as any,
      res,
      { role: UserRole.REGIONAL_ADMIN, region: 'Littoral', regionId: 'r-littoral' },
    );
    await done;
    const where = JSON.stringify(prisma.calls[0].where);
    expect(where).toContain('"formType":"VOCATIONAL_TRAINING"');
    expect(where).not.toContain('ENTREPRISE');
    expect(where).toContain('"regionId":"r-littoral"');
    expect(prisma.calls[0].include.vtTrainerRoster).toEqual({ orderBy: { rowIndex: 'asc' } });
  });

  it('is for central ONEFOP admins only', () => {
    for (const handler of ['postExportVtRosterManifest', 'postExportVtRosterCsv', 'postExportVtRosterSav']) {
      const roles = Reflect.getMetadata('roles', (DataManagementController.prototype as any)[handler]);
      expect([handler, roles]).toEqual([handler, [UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP]]);
    }
  });

  it('keeps 8.8 out of the anonymous statistical dataset', () => {
    const names = adapter.getTvetVariables().map((v) => v.variableName);
    expect(names.some((n) => /s8q8|lastName|firstName/i.test(n))).toBe(false);
  });

  it('.sps names the roster file and its own version', async () => {
    const service = new DataManagementService(fakePrisma([]) as any, undefined, adapter);
    const { sps, rosterVersion } = await service.buildVtRosterManifest();
    expect(rosterVersion).toBe(VT_ROSTER_DATASET_VERSION);
    expect(sps).toContain('* CONFIDENTIEL — données nominatives (8.8).');
    // The platform's name is CAMLEAP (2026-10-16 re-test: the header said CAM-LEAP).
    expect(sps).toContain('CAMLEAP / ONEFOP');
    expect(sps).not.toContain('CAM-LEAP');
    expect(sps).toContain(`* Version de la liste nominative : ${VT_ROSTER_DATASET_VERSION}.`);
    expect(sps).not.toContain('Version du schéma du jeu de données');
    expect(sps).toContain("/FILE='onefop_8-8_liste_nominative.csv'");
    expect(sps).toContain('VALUE LABELS professionalDiploma');
    // Defect 21: the roster has no formType variable, so its header does not
    // send the analyst to one.
    expect(sps).not.toContain('formType');
  });
});

function pyreadstatAvailable(): boolean {
  try {
    execFileSync('python', ['-c', 'import pyreadstat'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

(pyreadstatAvailable() ? describe : describe.skip)('8.8 named staff list .sav — pyreadstat round trip', () => {
  it('reads back the dictionary and every case', async () => {
    const service = new DataManagementService(fakePrisma([submission()]) as any, undefined, adapter);
    const { res, done } = fakeResponse();
    await service.streamVtRosterSav({ statuses: ['APPROVED'] } as any, res);
    const bytes = await done;
    expect(res.statusCode).not.toBe(500);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-rt-'));
    try {
      const file = path.join(tmp, 'roster.sav');
      fs.writeFileSync(file, bytes);
      const script = path.join(tmp, 'read.py');
      fs.writeFileSync(script, [
        'import json, math, sys, pyreadstat',
        'df, meta = pyreadstat.read_sav(sys.argv[1])',
        'clean = lambda v: None if isinstance(v, float) and math.isnan(v) else v',
        'print(json.dumps({"label": meta.file_label, "names": list(df.columns),',
        '  "valueLabels": {k: {str(kk): vv for kk, vv in v.items()} for k, v in meta.variable_value_labels.items()},',
        '  "rows": [[clean(v) for v in row] for row in df.itertuples(index=False, name=None)]}, ensure_ascii=False))',
      ].join('\n'));
      const out = JSON.parse(execFileSync('python', [script, file], { encoding: 'utf8' }));
      expect(out.label).toContain('CONFIDENTIEL');
      expect(out.names.slice(7)).toEqual([
        'rowIndex', 'lastName', 'firstName', 'sex', 'trainerStatus', 'isAdminPersonnel', 'academicDiploma', 'professionalDiploma',
      ]);
      expect(out.rows).toHaveLength(2);
      expect(out.rows[0].slice(7)).toEqual([1, 'Testeur', 'Jean', 1, 3, 0, 4, 5]);
      expect(out.rows[1].slice(7)).toEqual([2, 'Ngo Bassa', 'Marie, Claire', 2, 1, 1, 11, null]);
      expect(out.valueLabels.sex).toEqual({ '1.0': 'Homme', '2.0': 'Femme' });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
