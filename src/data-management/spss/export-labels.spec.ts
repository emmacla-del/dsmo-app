// src/data-management/spss/export-labels.spec.ts — E10 / E11 (dataset v4).
import { Logger } from '@nestjs/common';
import { PassThrough } from 'stream';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import {
  AnalyticalVariableDefinition,
  CanonicalSchemaAdapterService,
  DATASET_SCHEMA_VERSION,
} from '../canonical-schema-adapter.service';
import { DataManagementService } from '../data-management.service';
import { disambiguateDuplicateLabels, neutralizeReportingPeriod } from './export-labels';

function v(partial: Partial<AnalyticalVariableDefinition>): AnalyticalVariableDefinition {
  return {
    variableName: 'X',
    paperCode: 'P',
    labelFr: 'L',
    labelEn: 'L',
    sectionId: 's',
    entityApplicability: ['ALL'],
    spssDataType: 'A',
    spssWidth: 10,
    measurementLevel: 'NOMINAL',
    sourcePath: 'p',
    orderIndex: 1,
    ...partial,
  };
}

describe('E11 — neutral reporting-period wording', () => {
  it.each([
    ['Combien de départs avez-vous enregistrés du 1er Janvier 2025 à ce jour?', 'Combien de départs avez-vous enregistrés pendant la période de référence?'],
    ["la tranche d'âge du premier Janvier 2026 à ce jour ?", "la tranche d'âge pendant la période de référence ?"],
    ['Sans période', 'Sans période'],
  ])('fr: %s', (input, expected) => {
    expect(neutralizeReportingPeriod(input, 'fr')).toBe(expected);
  });

  it.each([
    ['did you register from the 1st of January 2025 to the present day?', 'did you register during the reference period?'],
    ['How many interns did you host from 1st January 2026 to date?', 'How many interns did you host during the reference period?'],
  ])('en: %s', (input, expected) => {
    expect(neutralizeReportingPeriod(input, 'en')).toBe(expected);
  });
});

describe('E10 — unique variable labels', () => {
  it('prefixes the paper code when that is enough, and leaves unique labels alone', () => {
    const out = disambiguateDuplicateLabels([
      v({ sourcePath: 'a', paperCode: 'S21Q01', labelFr: 'Statut de réponse' }),
      v({ sourcePath: 'b', paperCode: 'S22Q03', labelFr: 'Statut de réponse' }),
      v({ sourcePath: 'c', paperCode: 'S1Q01', labelFr: 'Unique' }),
    ]);
    expect(out.get('a')).toBe('S21Q01 — Statut de réponse');
    expect(out.get('b')).toBe('S22Q03 — Statut de réponse');
    expect(out.has('c')).toBe(false);
  });

  it('adds the entity when paper codes repeat, then falls back to the variable name', () => {
    const out = disambiguateDuplicateLabels([
      v({ sourcePath: 'a', paperCode: 'S1Q04', labelFr: 'Région', entityApplicability: ['enterprise'] }),
      v({ sourcePath: 'b', paperCode: 'S1Q04', labelFr: 'Région', entityApplicability: ['administration'] }),
      v({ sourcePath: 'c', paperCode: 'SYS_09', labelFr: 'Région', entityApplicability: ['ALL'] }),
      v({ sourcePath: 'd', paperCode: 'Q', variableName: 'D1', labelFr: 'Dup' }),
      v({ sourcePath: 'e', paperCode: 'Q', variableName: 'E1', labelFr: 'Dup' }),
    ]);
    expect(out.get('a')).toBe('Entreprise S1Q04 — Région');
    expect(out.get('b')).toBe('Administration S1Q04 — Région');
    expect(out.get('c')).toBe('SYS_09 — Région');
    expect(out.get('d')).toBe('D1 — Dup');
    expect(out.get('e')).toBe('E1 — Dup');
  });
});

describe('Canonical registry with E10 / E11 applied', () => {
  let adapter: CanonicalSchemaAdapterService;
  beforeAll(() => {
    Logger.overrideLogger(['error']);
    adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
  });

  it('dataset schema version is 7', () => {
    expect(DATASET_SCHEMA_VERSION).toBe(7);
  });

  it.each(['DEMAND', 'TVET', 'ALL'] as const)('%s: every French label is unique and none names a specific round', (p) => {
    const vars = adapter.getVariablesForPartition(p);
    const labels = vars.map((x) => x.labelFr);
    expect(labels.length - new Set(labels).size).toBe(0);
    expect(vars.filter((x) => /Janvier \d{4} à ce jour/.test(x.labelFr))).toEqual([]);
    expect(vars.filter((x) => /1st (of )?January \d{4}/.test(x.labelEn))).toEqual([]);
  });

  it('periodStart / periodEnd follow quarterCode as A10 DATE system variables', () => {
    const names = adapter.getAllVariables().map((x) => x.variableName);
    const q = names.indexOf('quarterCode');
    expect(names.slice(q + 1, q + 3)).toEqual(['periodStart', 'periodEnd']);
    const start = adapter.getAllVariables().find((x) => x.variableName === 'periodStart')!;
    expect([start.spssDataType, start.spssWidth, start.measurementLevel]).toEqual(['A', 10, 'DATE']);
    expect(adapter.getVariablesForPartition('TVET').some((x) => x.variableName === 'periodEnd')).toBe(true);
  });

  it('period comes from the attached round first, then from the quarterCode rule, else missing', () => {
    const [start, end] = ['period.start', 'period.end'].map(
      (sp) => adapter.getAllVariables().find((x) => x.sourcePath === sp)!,
    );
    const round = {
      quarterCode: 'QUARTERLY_2026_T1_001',
      referencePeriod: { periodStart: new Date('2026-01-01T00:00:00Z'), periodEnd: new Date('2026-06-30T00:00:00Z') },
    };
    expect([adapter.extractValue(start, round), adapter.extractValue(end, round)]).toEqual(['2026-01-01', '2026-06-30']);

    const derived = { quarterCode: 'QUARTERLY_2026_T3_002' };
    expect([adapter.extractValue(start, derived), adapter.extractValue(end, derived)]).toEqual(['2026-07-01', '2026-09-30']);
    expect(adapter.extractValue(start, { quarterCode: 'SEMESTER_2025_S2_001' })).toBe('2025-07-01');
    expect(adapter.extractValue(end, { quarterCode: '2025-T1' })).toBe('2025-03-31');

    expect(adapter.extractValue(start, { quarterCode: 'garbage' })).toBeUndefined();
    expect(adapter.extractValue(end, { quarterCode: null })).toBeUndefined();
  });
});

describe('Canonical CSV export (E10 header, E11 periods)', () => {
  it('writes variable names as the header row and the round period per record', async () => {
    Logger.overrideLogger(['error']);
    const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
    const prisma = {
      onefopSubmission: {
        findMany: jest.fn().mockResolvedValueOnce([
          { id: '1', submissionId: 'S1', formType: 'ENTREPRISE', quarterCode: 'QUARTERLY_2026_T2_001', rawData: {} },
          { id: '2', submissionId: 'S2', formType: 'ENTREPRISE', quarterCode: 'QUARTERLY_2025_T4_001', rawData: {} },
        ]),
      },
      submissionRound: {
        findMany: jest.fn().mockResolvedValue([
          { quarterCode: 'QUARTERLY_2026_T2_001', periodStart: new Date('2026-04-01T00:00:00Z'), periodEnd: new Date('2026-06-30T00:00:00Z') },
        ]),
      },
    };
    const service = new DataManagementService(prisma as any, undefined, adapter);
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c));
    const res: any = stream;
    res.setHeader = () => undefined;
    await service.streamApprovedOnefopSubmissionsCsv({}, res);
    const lines = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '').split('\r\n');

    const vars = adapter.getVariablesForPartition('DEMAND');
    expect(lines[0]).toBe(vars.map((x) => x.variableName).join(','));
    const i = vars.findIndex((x) => x.variableName === 'periodStart');
    const row1 = lines[1].split(',');
    const row2 = lines[2].split(',');
    expect([row1[i], row1[i + 1]]).toEqual(['2026-04-01', '2026-06-30']); // from the round row
    expect([row2[i], row2[i + 1]]).toEqual(['2025-10-01', '2025-12-31']); // no round row: quarterCode rule

    // The .sps that goes with it still skips the header row.
    expect(adapter.buildSpssSyntax(vars, 'onefop_submissions.csv')).toContain('/FIRSTCASE=2');
  });
});
