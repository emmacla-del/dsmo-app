// src/data-management/spss/missing-codes.spec.ts
//
// E1 (dataset v5) — user-missing codes. Only -98 « Non applicable (type
// d'établissement) » is written: an empty NUMERIC cell whose variable is not
// asked of the record's formType. -99 « Non renseigné » is declared but not
// written. Applicable cells (answered, unanswered, zero-filled) and string
// variables are exported exactly as before.
import { Logger } from '@nestjs/common';
import { PassThrough } from 'stream';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import {
  CanonicalSchemaAdapterService,
  SPSS_MISSING_NOT_APPLICABLE,
  SPSS_USER_MISSING_CODES,
  type AnalyticalVariableDefinition,
} from '../canonical-schema-adapter.service';
import { DataManagementService } from '../data-management.service';
import { SavWriter } from './sav-writer';

function fakeCsvRes() {
  const chunks: string[] = [];
  return {
    res: {
      setHeader: () => undefined,
      write: (s: string) => { chunks.push(s); return true; },
      end: () => undefined,
      once: () => undefined,
    } as any,
    text: () => chunks.join(''),
  };
}

function fakeSavRes() {
  const stream = new PassThrough();
  stream.resume();
  const res: any = stream;
  res.headersSent = false;
  res.setHeader = () => undefined;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; res.end(); };
  const done = new Promise<void>((resolve) => stream.on('end', () => resolve()));
  return { res, done };
}

function prismaWith(submissions: any[]) {
  return {
    submissionRound: { findMany: jest.fn().mockResolvedValue([]) },
    onefopSubmission: { findMany: jest.fn().mockResolvedValue(submissions) },
  };
}

/** CSV data rows → { variableName: cell } for each record. */
function csvRecords(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split('\r\n').filter((l) => l.length > 0);
  // No test value contains a comma or quote, so a plain split is exact.
  const header = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

describe('E1 — -98 « non applicable » user-missing code', () => {
  let adapter: CanonicalSchemaAdapterService;
  let demand: AnalyticalVariableDefinition[];
  let tvet: AnalyticalVariableDefinition[];

  const only = (vars: AnalyticalVariableDefinition[], app: string[], type: 'NUMERIC' | 'A', matrix = true) =>
    vars.find(
      (v) =>
        v.spssDataType === type &&
        v.entityApplicability.join('+') === app.join('+') &&
        (!matrix || v.sourcePath.startsWith('matrix.')),
    )!;

  beforeAll(() => {
    Logger.overrideLogger(['error']);
    adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
    demand = adapter.getDemandVariables();
    tvet = adapter.getTvetVariables();
  });

  const cellId = (v: AnalyticalVariableDefinition) => v.sourcePath.split('.')[2];

  describe('adapter.exportValue', () => {
    it('an empty numeric variable not asked of the record type becomes -98', () => {
      const ppOnly = only(demand, ['projectProgram'], 'NUMERIC');
      const firmGroup = only(demand, ['enterprise', 'cooperative', 'ctd', 'ong'], 'NUMERIC');
      expect(ppOnly).toBeDefined();
      expect(firmGroup).toBeDefined();

      const enterprise = { formType: 'ENTREPRISE', rawData: {} };
      const administration = { formType: 'ADMINISTRATION', rawData: {} };
      expect(adapter.exportValue(ppOnly, enterprise)).toBe(SPSS_MISSING_NOT_APPLICABLE);
      expect(adapter.exportValue(firmGroup, administration)).toBe(-98);
    });

    it('an applicable but unanswered numeric cell stays blank (system-missing), never -98 or -99', () => {
      const firmGroup = only(demand, ['enterprise', 'cooperative', 'ctd', 'ong'], 'NUMERIC');
      for (const formType of ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG']) {
        expect(adapter.exportValue(firmGroup, { formType, rawData: {} })).toBeUndefined();
        expect(adapter.exportValue(firmGroup, { formType, rawData: { [cellId(firmGroup)]: '' } })).toBe('');
      }
    });

    it('zeros and real values are exported unchanged (zero-filled tables are not missing)', () => {
      const firmGroup = only(demand, ['enterprise', 'cooperative', 'ctd', 'ong'], 'NUMERIC');
      expect(adapter.exportValue(firmGroup, { formType: 'ENTREPRISE', rawData: { [cellId(firmGroup)]: 0 } })).toBe(0);
      expect(adapter.exportValue(firmGroup, { formType: 'ENTREPRISE', rawData: { [cellId(firmGroup)]: 12 } })).toBe(12);
    });

    it('a value actually recorded under a non-applicable variable is kept, not overwritten', () => {
      const ppOnly = only(demand, ['projectProgram'], 'NUMERIC');
      expect(adapter.exportValue(ppOnly, { formType: 'ENTREPRISE', rawData: { [cellId(ppOnly)]: 3 } })).toBe(3);
    });

    it('string variables stay blank when not applicable', () => {
      const adminText = demand.find(
        (v) => v.spssDataType === 'A' && v.entityApplicability.length > 0 && !v.entityApplicability.includes('ALL') &&
          !v.entityApplicability.includes('enterprise'),
      )!;
      expect(adminText).toBeDefined();
      expect(adapter.exportValue(adminText, { formType: 'ENTREPRISE', rawData: {} })).toBeUndefined();
    });

    it("'ALL' variables and records with a missing or unknown formType never get -98", () => {
      const surveyYear = demand.find((v) => v.sourcePath === 'submission.surveyYear')!;
      expect(adapter.exportValue(surveyYear, { formType: 'ENTREPRISE' })).toBeUndefined();
      const ppOnly = only(demand, ['projectProgram'], 'NUMERIC');
      expect(adapter.exportValue(ppOnly, { rawData: {} })).toBeUndefined();
      expect(adapter.exportValue(ppOnly, { formType: 'UNKNOWN', rawData: {} })).toBeUndefined();
    });

    it('TVET: a training-centre record never gets -98 on any TVET variable', () => {
      const empty = { formType: 'VOCATIONAL_TRAINING', rawData: {} };
      expect(tvet.filter((v) => adapter.exportValue(v, empty) === -98)).toEqual([]);
    });

    it('TVET: a NONE table status keeps its recorded zeros (not -98)', () => {
      const status = tvet.find((v) => v.sourcePath.startsWith('vtStatus.'))!;
      const tableId = status.sourcePath.slice('vtStatus.'.length).replace(/_RESPONSE_STATUS$/, '');
      const cells = tvet.filter((v) => v.sourcePath.startsWith(`matrix.${tableId}.`) && v.spssDataType === 'NUMERIC');
      expect(cells.length).toBeGreaterThan(0);
      const rawData: Record<string, unknown> = { [status.variableName]: 'NONE' };
      for (const c of cells) rawData[cellId(c)] = 0;
      const record = { formType: 'VOCATIONAL_TRAINING', rawData };
      expect(adapter.exportValue(status, record)).toBe('NONE');
      for (const c of cells) expect(adapter.exportValue(c, record)).toBe(0);
    });
  });

  describe('.sps syntax', () => {
    it('declares -98 and -99 as user-missing, documents both codes, reads numerics at least F3.0', () => {
      const sps = adapter.buildSpssSyntax(adapter.getVariablesForPartition('ALL'), 'onefop_submissions.csv');
      expect(sps).toContain('MISSING VALUES');
      expect(sps).toContain('(-98, -99)');
      expect(sps).not.toMatch(/\(-99\)/);
      expect(sps).toContain("-98 = Non applicable (type d'établissement)");
      expect(sps).toContain('-99 = Non renseigné');
      expect(sps).toContain('* Version du schéma du jeu de données : 7.');
      expect(sps).not.toMatch(/ F[12]\.0$/m);
    });
  });

  describe('DataManagementService exports', () => {
    const records = () => [
      { id: 'a', submissionId: 'ENT-1', formType: 'ENTREPRISE', status: 'APPROVED', rawData: {} },
      { id: 'b', submissionId: 'ADM-1', formType: 'ADMINISTRATION', status: 'APPROVED', rawData: {} },
    ];

    it('CSV: -98 only in non-applicable numeric columns; applicable unanswered cells stay blank', async () => {
      const service = new DataManagementService(prismaWith(records()) as any, undefined, adapter);
      const { res, text } = fakeCsvRes();
      await service.streamApprovedOnefopSubmissionsCsv({ partition: 'DEMAND' }, res);
      const [ent, adm] = csvRecords(text());

      const ppOnly = only(demand, ['projectProgram'], 'NUMERIC');
      const firmGroup = only(demand, ['enterprise', 'cooperative', 'ctd', 'ong'], 'NUMERIC');
      expect(ent[ppOnly.variableName]).toBe('-98');
      expect(ent[firmGroup.variableName]).toBe('');
      expect(adm[firmGroup.variableName]).toBe('-98');

      for (const v of demand) {
        for (const [row, formType] of [[ent, 'ENTREPRISE'], [adm, 'ADMINISTRATION']] as const) {
          const notApplicable = adapter.isNotApplicableToRecord(v, { formType });
          if (v.spssDataType === 'NUMERIC' && notApplicable) expect([v.variableName, row[v.variableName]]).toEqual([v.variableName, '-98']);
          else expect([v.variableName, row[v.variableName]]).not.toEqual([v.variableName, '-98']);
        }
      }
    });

    it('.sav: numeric variables declare -98/-99 user-missing and cases carry -98 where not applicable', async () => {
      const encode = jest.spyOn(SavWriter.prototype, 'encodeCase');
      try {
        const service = new DataManagementService(prismaWith(records()) as any, undefined, adapter);
        const { res, done } = fakeSavRes();
        await service.streamApprovedOnefopSubmissionsSav({ partition: 'DEMAND' } as any, res);
        await done;
        expect(res.statusCode).not.toBe(500);

        const [ent, adm] = encode.mock.calls.map(([values]) => values);
        const at = (row: unknown[], v: AnalyticalVariableDefinition) => row[demand.indexOf(v)];
        const ppOnly = only(demand, ['projectProgram'], 'NUMERIC');
        const firmGroup = only(demand, ['enterprise', 'cooperative', 'ctd', 'ong'], 'NUMERIC');
        expect(at(ent, ppOnly)).toBe(-98);
        expect(at(ent, firmGroup)).toBeUndefined();
        expect(at(adm, firmGroup)).toBe(-98);
      } finally {
        encode.mockRestore();
      }

      const toSav = (v: AnalyticalVariableDefinition) => (new DataManagementService({} as any, undefined, adapter) as any).toSavVariable(v);
      expect(toSav(only(demand, ['projectProgram'], 'NUMERIC')).missingValues).toEqual(SPSS_USER_MISSING_CODES);
      expect(toSav(demand.find((v) => v.spssDataType === 'A')!).missingValues).toBeUndefined();
    });
  });
});
