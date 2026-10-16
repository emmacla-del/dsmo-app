// src/data-management/spss/vt-contact-export.spec.ts
//
// Defect 3 (Decision 2 Option B): Restricted VT Contact file export.
// Verifies that personal contact fields are excluded from the main canonical dataset
// and present in the restricted contact export file under narrow permissions.
import { PassThrough } from 'stream';
import { UserRole } from '@prisma/client';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService } from '../canonical-schema-adapter.service';
import { CANONICAL_PII_EXCLUSIONS } from '../canonical-exclusions';
import { DataManagementController } from '../data-management.controller';
import { DataManagementService } from '../data-management.service';
import {
  VT_CONTACT_DATASET_VERSION,
  VT_CONTACT_CONTEXT_VARIABLES,
  vtContactColumns,
} from './vt-contact-export';

const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());

function vtSubmission(id = '60b107b8-7027-41ff-ac3f-258005fba92d') {
  return {
    id,
    submissionId: id,
    establishmentId: 'VT26001002',
    formType: 'VOCATIONAL_TRAINING',
    status: 'APPROVED',
    quarterCode: 'QUARTERLY_2026_T4_001',
    region: 'Littoral',
    department: 'Wouri',
    company: { name: 'CFP Test E2E 1016', establishmentId: 'VT26001002' },
    respondent: {
      respondentName: 'Jean Dupont',
      respondentFunction: 'Directeur RH',
      phone1: '699112233',
      phone2: '655112233',
      email: 'jean.dupont@test.cm',
    },
    vocationalTrainingDetail: {
      promoterName: 'Paul Kamga',
      promoterPhone1: '677445566',
      promoterPhone2: '688445566',
      promoterEmail: 'paul.kamga@test.cm',
      email: 'contact@cfp-test.cm',
    },
    rawData: {
      VT1_15_NAME: 'Jean Dupont',
      VT1_15_TEL1: '699112233',
      VT1_15_TEL2: '655112233',
      VT1_15_EMAIL: 'jean.dupont@test.cm',
      VT1_16_NAME: 'Paul Kamga',
      VT1_16_TEL1: '677445566',
      VT1_16_TEL2: '688445566',
      VT1_16_EMAIL: 'paul.kamga@test.cm',
      VT2_12: 'contact@cfp-test.cm',
    },
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

describe('Defect 3 — Restricted VT contact export (Decision 2 Option B)', () => {
  const contactFields = [
    'VT1_15_NAME',
    'VT1_15_TEL1',
    'VT1_15_TEL2',
    'VT1_15_EMAIL',
    'VT1_16_NAME',
    'VT1_16_TEL1',
    'VT1_16_TEL2',
    'VT1_16_EMAIL',
    'VT2_12',
  ];

  it('excludes all 9 personal contact fields from CANONICAL_PII_EXCLUSIONS and main registry', () => {
    for (const f of contactFields) {
      expect(CANONICAL_PII_EXCLUSIONS.has(f)).toBe(true);
    }

    const allVars = adapter.getAllVariables();
    const varNames = new Set(allVars.map((v) => v.variableName));
    for (const f of contactFields) {
      expect(varNames.has(f)).toBe(false);
    }
  });

  it('includes all 9 personal contact fields in the restricted contact export columns', () => {
    const cols = vtContactColumns();
    const colNames = cols.map((c) => c.variable.name);
    expect(colNames).toEqual(contactFields);

    const sub = vtSubmission();
    const values = cols.map((c) => c.value(sub));
    expect(values).toEqual([
      'Jean Dupont',
      '699112233',
      '655112233',
      'jean.dupont@test.cm',
      'Paul Kamga',
      '677445566',
      '688445566',
      'paul.kamga@test.cm',
      'contact@cfp-test.cm',
    ]);
  });

  it('streams contact CSV with context variables and contact fields', async () => {
    const prisma = fakePrisma([vtSubmission()]);
    const service = new DataManagementService(prisma as any, undefined, adapter);
    const { res, done } = fakeResponse();
    await service.streamVtContactCsv({ statuses: ['APPROVED'] } as any, res);
    const text = (await done).toString('utf8').replace(/^﻿/, '').trim();
    const lines = text.split('\r\n');

    expect(lines).toHaveLength(2);
    // Header includes context variables + 9 contact fields
    const headers = lines[0].split(',');
    expect(headers).toEqual([...VT_CONTACT_CONTEXT_VARIABLES, ...contactFields]);

    // Data row contains the actual contact details
    const row = lines[1].split(',');
    expect(row[0]).toBe('60b107b8-7027-41ff-ac3f-258005fba92d'); // submissionId
    expect(row[7]).toBe('Jean Dupont'); // VT1_15_NAME
    expect(row[8]).toBe('699112233'); // VT1_15_TEL1
    expect(row[9]).toBe('655112233'); // VT1_15_TEL2
    expect(row[10]).toBe('jean.dupont@test.cm'); // VT1_15_EMAIL
    expect(row[11]).toBe('Paul Kamga'); // VT1_16_NAME
    expect(row[12]).toBe('677445566'); // VT1_16_TEL1
    expect(row[13]).toBe('688445566'); // VT1_16_TEL2
    expect(row[14]).toBe('paul.kamga@test.cm'); // VT1_16_EMAIL
    expect(row[15]).toBe('contact@cfp-test.cm'); // VT2_12
  });

  it('restricts contact export endpoints to SUPER_ADMIN and ADMIN_ONEFOP only', () => {
    const rolesOf = (method: string): UserRole[] =>
      Reflect.getMetadata('roles', DataManagementController.prototype[method]) ?? [];
    expect(rolesOf('postExportVtContactManifest')).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP]);
    expect(rolesOf('postExportVtContactCsv')).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP]);
    expect(rolesOf('postExportVtContactSav')).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP]);
  });
});
