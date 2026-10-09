import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import {
  CanonicalSchemaAdapterService,
  DEMAND_SCHEMA_ENTITIES,
  TVET_SCHEMA_ENTITIES,
  CANONICAL_ENTITY_PRIORITY,
  SPSS_TEXTAREA_WIDTH,
} from './canonical-schema-adapter.service';
import { DataManagementService } from './data-management.service';
import { CANONICAL_PII_EXCLUSIONS } from './canonical-exclusions';
import { PassThrough } from 'stream';

function fakeRes() {
  const chunks: string[] = [];
  let ended = false;
  const headers: Record<string, string> = {};
  return {
    res: {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      write: (s: string) => { chunks.push(s); return true; },
      end: () => { ended = true; },
      once: (_event: string, _cb: () => void) => { },
    } as any,
    chunks,
    headers,
    isEnded: () => ended,
  };
}

describe('CanonicalSchemaAdapterService', () => {
  let loader: OnefopSchemaLoaderService;
  let adapter: CanonicalSchemaAdapterService;

  beforeAll(() => {
    loader = new OnefopSchemaLoaderService();
    adapter = new CanonicalSchemaAdapterService(loader);
  });

  describe('1. Determinism', () => {
    it('produces identical variable lists, lengths, and ordering across repeated runs', () => {
      const run1 = adapter.getAllVariables();
      const run2 = adapter.getAllVariables();

      expect(run1.length).toBe(run2.length);
      expect(run1.length).toBeGreaterThan(2000);

      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].variableName).toBe(run2[i].variableName);
        expect(run1[i].orderIndex).toBe(run2[i].orderIndex);
        expect(run1[i].paperCode).toBe(run2[i].paperCode);
        expect(run1[i].sourcePath).toBe(run2[i].sourcePath);
      }
    });

    it('Demand and TVET partition variable ordering is stable and reproducible', () => {
      const demand1 = adapter.getDemandVariables();
      const demand2 = adapter.getDemandVariables();
      expect(demand1.map((v) => v.variableName)).toEqual(demand2.map((v) => v.variableName));

      const tvet1 = adapter.getTvetVariables();
      const tvet2 = adapter.getTvetVariables();
      expect(tvet1.map((v) => v.variableName)).toEqual(tvet2.map((v) => v.variableName));
    });
  });

  describe('2. Schema Completeness', () => {
    it('represents all 15 system variables at the start (indices 1 to 15)', () => {
      const all = adapter.getAllVariables();
      const systemVars = all.slice(0, 15);

      expect(systemVars.map((v) => v.variableName)).toEqual([
        'schemaVersion',
        'submissionId',
        'status',
        'surveyYear',
        'quarterCode',
        'periodStart', // E11, dataset v4
        'periodEnd',
        'formType',
        'companyName',
        'taxNumber',
        'establishmentId',
        'region',
        'department',
        'subdivision',
        'submissionDate',
      ]);

      expect(systemVars.every((v) => v.sectionId === 'system')).toBe(true);
      expect(systemVars.every((v) => v.entityApplicability.includes('ALL'))).toBe(true);
    });

    it('represents Section 0 respondent identification variables', () => {
      const all = adapter.getAllVariables();
      const s0 = all.filter((v) => v.sectionId === 'section0');

      expect(s0.map((v) => v.variableName)).toEqual([
        'S0Q01',
        'S0Q02',
        'S0Q03_TEL1',
        'S0Q03_TEL2',
        'S0Q03_EMAIL',
      ]);
    });

    it('represents Section 1 entity-specific identification variables for all entities', () => {
      const all = adapter.getAllVariables();

      // Enterprise S1
      const entS1 = all.filter((v) => v.sectionId === 'section1_entreprise');
      expect(entS1.length).toBe(17);
      expect(entS1.some((v) => v.variableName === 'S1Q01')).toBe(true);
      expect(entS1.some((v) => v.variableName === 'S1Q12')).toBe(true);

      // Cooperative S1
      const coopS1 = all.filter((v) => v.sectionId === 'section1_cooperative');
      expect(coopS1.length).toBe(18);
      expect(coopS1.some((v) => v.variableName === 'COOP_S1Q01')).toBe(true);

      // Administration S1
      const adminS1 = all.filter((v) => v.sectionId === 'section1_administration');
      expect(adminS1.length).toBe(17);
      expect(adminS1.some((v) => v.variableName === 'ADMIN_S1Q01')).toBe(true);
    });

    it('expands fixed matrix tables into individual cell variables', () => {
      const all = adapter.getAllVariables();

      // S21Q01: 4 CSP rows x 12 cols = 48 cells in enterprise/coop/ctd/ong + 3 SFP rows x 12 cols (36 cells) in administration = 84 total canonical cells
      const s21q01 = all.filter((v) => v.sourcePath.startsWith('matrix.S21Q01.'));
      expect(s21q01.length).toBe(84);
      expect(s21q01.every((v) => v.spssDataType === 'NUMERIC')).toBe(true);
      expect(s21q01.every((v) => v.measurementLevel === 'SCALE')).toBe(true);

      // Verify entity filtering yields exactly 48 cells per entity
      const entS21q01 = adapter.getVariablesForEntity('enterprise').filter((v) => v.sourcePath.startsWith('matrix.S21Q01.'));
      expect(entS21q01.length).toBe(48);
      const admS21q01 = adapter.getVariablesForEntity('administration').filter((v) => v.sourcePath.startsWith('matrix.S21Q01.'));
      expect(admS21q01.length).toBe(48);

      // S22Q03: 13 rows x 12 cols = 156 cells
      const s22q03 = all.filter((v) => v.sourcePath.startsWith('matrix.S22Q03.'));
      expect(s22q03.length).toBe(156);

      // S23Q02: 8 rows x 12 cols = 96 cells
      const s23q02 = all.filter((v) => v.sourcePath.startsWith('matrix.S23Q02.'));
      expect(s23q02.length).toBe(96);
    });

    it('expands fixed indexed tables (reasons, skills, training needs) into 3 slots x 4 sub-variables', () => {
      const all = adapter.getAllVariables();

      // S3Q02 (dismissal reasons): 3 slots x 4 sub-columns = 12 variables
      const s3q02 = all.filter((v) => v.sourcePath.startsWith('indexed.reasons_table.'));
      expect(s3q02.length).toBe(12);
      expect(s3q02.filter((v) => v.variableName.endsWith('_DESC'))).toHaveLength(3);
      expect(s3q02.filter((v) => v.variableName.endsWith('_H'))).toHaveLength(3);
      expect(s3q02.filter((v) => v.variableName.endsWith('_F'))).toHaveLength(3);
      expect(s3q02.filter((v) => v.variableName.endsWith('_TOTAL'))).toHaveLength(3);

      // S4Q02 (skill needs): 12 variables
      const s4q02 = all.filter((v) => v.sourcePath.startsWith('indexed.skills_table.'));
      expect(s4q02.length).toBe(12);

      // S4Q03 (training needs): 12 variables
      const s4q03 = all.filter((v) => v.sourcePath.startsWith('indexed.training_table.'));
      expect(s4q03.length).toBe(12);
    });
  });

  describe('3. No Record-Dependent Columns', () => {
    it('variable list is generated completely without database queries', () => {
      const all = adapter.getAllVariables();
      expect(all.length).toBeGreaterThan(0);
      // All variables are statically defined from the schema
      expect(all.every((v) => v.orderIndex > 0)).toBe(true);
    });

    it('extractValue extracts values when present and returns undefined (not throwing) for absent values', () => {
      const all = adapter.getAllVariables();
      const emptySubmission = {};

      for (const v of all.slice(0, 100)) {
        expect(() => adapter.extractValue(v, emptySubmission)).not.toThrow();
        expect(adapter.extractValue(v, emptySubmission)).toBeUndefined();
      }
    });

    it('extractValue correctly resolves values from submission relations and rawData', () => {
      const sub = {
        submissionId: 'SUB-TEST-123',
        status: 'APPROVED',
        surveyYear: 2026,
        quarterCode: '2026-T1',
        formType: 'ENTREPRISE',
        company: { name: 'Test Corp', taxNumber: 'M123456789' },
        respondent: { respondentName: 'Alice Doe', respondentFunction: 'Manager' },
        enterpriseDetail: { legalStatus: 'SARL/ LLC', permanentWorkers: 42 },
        cspGenderAge: [
          { tableName: 's21q01', cspCategory: 'CADRES', gender: 'MALE', ageBand: 'AGE_15_24', value: 5 },
        ],
        dismissalReasons: [
          { reasonIndex: 1, reasonText: 'Faute lourde', maleCount: 2, femaleCount: 1, totalCount: 3 },
        ],
      };

      const sysSubId = adapter.getAllVariables().find((v) => v.variableName === 'submissionId')!;
      expect(adapter.extractValue(sysSubId, sub)).toBe('SUB-TEST-123');

      const compName = adapter.getAllVariables().find((v) => v.variableName === 'companyName')!;
      expect(adapter.extractValue(compName, sub)).toBe('Test Corp');

      const s0Name = adapter.getAllVariables().find((v) => v.variableName === 'S0Q01')!;
      expect(adapter.extractValue(s0Name, sub)).toBe('Alice Doe');

      const legalStatus = adapter.getAllVariables().find((v) => v.variableName === 'S1Q01')!;
      expect(adapter.extractValue(legalStatus, sub)).toBe('SARL/ LLC');

      const workers = adapter.getAllVariables().find((v) => v.variableName === 'S1Q10')!;
      expect(adapter.extractValue(workers, sub)).toBe(42);

      const cell = adapter.getAllVariables().find((v) => v.sourcePath === 'matrix.S21Q01.s21q01_cadres_male_15_24')!;
      expect(adapter.extractValue(cell, sub)).toBe(5);

      const reasonDesc = adapter.getAllVariables().find((v) => v.variableName === 'S3Q02_SLOT1_DESC')!;
      expect(adapter.extractValue(reasonDesc, sub)).toBe('Faute lourde');

      const reasonTotal = adapter.getAllVariables().find((v) => v.variableName === 'S3Q02_SLOT1_TOTAL')!;
      expect(adapter.extractValue(reasonTotal, sub)).toBe(3);
    });

    it('extractValue exports a synthetic NA-<uuid> taxpayer number (SYS_07) as missing', () => {
      const taxNumber = adapter.getAllVariables().find((v) => v.paperCode === 'SYS_07')!;
      expect(taxNumber.sourcePath).toBe('submission.taxNumber');

      expect(adapter.extractValue(taxNumber, { taxNumber: 'M123456789' })).toBe('M123456789');
      expect(adapter.extractValue(taxNumber, { taxNumber: 'NA-3f2b6c1e-0000-4000-8000-000000000000' })).toBeNull();
      expect(adapter.extractValue(taxNumber, { taxNumber: 'NA-' })).toBeNull();
      expect(adapter.extractValue(taxNumber, { taxNumber: null })).toBeNull();
      expect(adapter.extractValue(taxNumber, {})).toBeUndefined();
    });
  });

  describe('4. SPSS Variable Names', () => {
    it('generates valid SPSS identifiers for all variables: <= 64 chars, starts with letter/@, no reserved words', () => {
      const all = adapter.getAllVariables();
      const reserved = new Set(['ALL', 'AND', 'BY', 'EQ', 'GE', 'GT', 'LE', 'LT', 'NE', 'NOT', 'OR', 'TO', 'WITH']);

      for (const v of all) {
        expect(v.variableName.length).toBeLessThanOrEqual(64);
        expect(v.variableName).toMatch(/^[A-Za-z@][A-Za-z0-9_]*$/);
        expect(v.variableName).not.toMatch(/_$/);
        expect(reserved.has(v.variableName.toUpperCase())).toBe(false);
      }
    });

    it('guarantees 100% uniqueness (no duplicate names case-insensitively) within each partition', () => {
      const demandVars = adapter.getDemandVariables();
      const demandNames = new Set<string>();
      for (const v of demandVars) {
        const upper = v.variableName.toUpperCase();
        expect(demandNames.has(upper)).toBe(false);
        demandNames.add(upper);
      }

      const tvetVars = adapter.getTvetVariables();
      const tvetNames = new Set<string>();
      for (const v of tvetVars) {
        const upper = v.variableName.toUpperCase();
        expect(tvetNames.has(upper)).toBe(false);
        tvetNames.add(upper);
      }
    });

    it('sanitizeSpssVariableName handles edge cases: numbers, punctuation, reserved keywords, and length > 64', () => {
      const used = new Set<string>();
      expect(adapter.generateSpssVariableName('2026_annee', used)).toBe('V_2026_annee');
      expect(adapter.generateSpssVariableName('AND', used)).toBe('AND_VAR');
      expect(adapter.generateSpssVariableName('Taux de participation (en %)', used)).toBe('Taux_de_participation_en');

      // Duplicate deduplication
      const first = adapter.generateSpssVariableName('duplicate_var', used);
      const second = adapter.generateSpssVariableName('duplicate_var', used);
      expect(first).toBe('duplicate_var');
      expect(second).toBe('duplicate_var_2');

      // Extreme length (> 64 chars)
      const veryLong = 'a'.repeat(80);
      const sanitized = adapter.generateSpssVariableName(veryLong, used);
      expect(sanitized.length).toBeLessThanOrEqual(64);
      expect(sanitized.startsWith('a')).toBe(true);
    });
  });

  describe('5. Value Labels', () => {
    it('preserves exact canonical option.value as analytical code without integer recoding', () => {
      const all = adapter.getAllVariables();
      const legalStatus = all.find((v) => v.variableName === 'S1Q01')!;

      expect(legalStatus.valueLabels).toBeDefined();
      expect(Object.keys(legalStatus.valueLabels!)).toContain('Société unipersonnelle/ Single-member company');
      expect(Object.keys(legalStatus.valueLabels!)).toContain('SARL/ LLC');
      expect(Object.keys(legalStatus.valueLabels!)).toContain('SA/ PLC');
      expect(Object.keys(legalStatus.valueLabels!)).toContain('Autres/ Others');

      // Value labels map exact stored strings to display text
      expect(legalStatus.valueLabels!['SARL/ LLC']).toBe('SARL');
    });

    it('preserves bilingual values for radio and select questions', () => {
      const all = adapter.getAllVariables();
      const area = all.find((v) => v.variableName === 'S1Q03')!;

      expect(area.valueLabels).toBeDefined();
      expect(Object.keys(area.valueLabels!)).toContain('Urbain/ Urban');
      expect(Object.keys(area.valueLabels!)).toContain('Rural/ Rural');
      expect(area.valueLabels!['Urbain/ Urban']).toBe('Urbain');
    });
  });

  describe('6. Entity Partitions (DEMAND vs TVET)', () => {
    it('derives DEMAND partition containing entities 1 to 6 and excluding TVET-only variables', () => {
      const demand = adapter.getDemandVariables();
      expect(demand.length).toBeGreaterThan(1000);

      // Contains Demand fields
      expect(demand.some((v) => v.variableName === 'S1Q01')).toBe(true); // Enterprise
      expect(demand.some((v) => v.variableName === 'COOP_S1Q01')).toBe(true); // Cooperative
      expect(demand.some((v) => v.variableName === 'ADMIN_S1Q01')).toBe(true); // Administration
      expect(demand.some((v) => v.variableName.startsWith('S21Q01_'))).toBe(true); // Demand S2.1

      // Does NOT contain TVET-only fields
      expect(demand.some((v) => v.variableName === 'VT1_1')).toBe(false);
      expect(demand.some((v) => v.variableName.startsWith('VT4_'))).toBe(false);
    });

    it('derives TVET partition containing Entity 7 (vocational training) and excluding Demand-only variables', () => {
      const tvet = adapter.getTvetVariables();
      expect(tvet.length).toBeGreaterThan(500);

      // Contains TVET fields
      expect(tvet.some((v) => v.variableName === 'VT1_1')).toBe(true);
      expect(tvet.some((v) => v.variableName === 'VT2_1')).toBe(true);

      // Does NOT contain Demand-only fields
      expect(tvet.some((v) => v.variableName === 'S1Q01')).toBe(false);
      expect(tvet.some((v) => v.variableName === 'COOP_S1Q01')).toBe(false);
      expect(tvet.some((v) => v.variableName.startsWith('S21Q01_'))).toBe(false);
    });

    it('both partitions share the 12 system variables', () => {
      const demand = adapter.getDemandVariables();
      const tvet = adapter.getTvetVariables();

      const demandSys = demand.slice(0, 12).map((v) => v.variableName);
      const tvetSys = tvet.slice(0, 12).map((v) => v.variableName);

      expect(demandSys).toEqual(tvetSys);
      expect(demandSys).toContain('submissionId');
      expect(demandSys).toContain('surveyYear');
      expect(demandSys).toContain('status');
    });
  });

  describe('7. Measurement Levels', () => {
    it('assigns SCALE to all numeric counts and matrix quantities', () => {
      const all = adapter.getAllVariables();
      const permanentWorkers = all.find((v) => v.variableName === 'S1Q10')!;
      expect(permanentWorkers.measurementLevel).toBe('SCALE');
      expect(permanentWorkers.spssDataType).toBe('NUMERIC');

      const vacancies = all.find((v) => v.variableName === 'S1Q11')!;
      expect(vacancies.measurementLevel).toBe('SCALE');
      expect(vacancies.spssDataType).toBe('NUMERIC');

      const matrixCell = all.find((v) => v.sourcePath === 'matrix.S21Q01.s21q01_cadres_male_15_24')!;
      expect(matrixCell.measurementLevel).toBe('SCALE');
      expect(matrixCell.spssDataType).toBe('NUMERIC');
    });

    it('assigns DATE to date variables', () => {
      const all = adapter.getAllVariables();
      const subDate = all.find((v) => v.variableName === 'submissionDate')!;
      expect(subDate.measurementLevel).toBe('DATE');

      const tvetAccredDate = all.find((v) => v.variableName === 'VT2_17')!;
      expect(tvetAccredDate.measurementLevel).toBe('DATE');
    });

    it('assigns NOMINAL as conservative default for radio, select, text, and identifiers', () => {
      const all = adapter.getAllVariables();
      const s0Name = all.find((v) => v.variableName === 'S0Q01')!;
      expect(s0Name.measurementLevel).toBe('NOMINAL');

      const legalStatus = all.find((v) => v.variableName === 'S1Q01')!;
      expect(legalStatus.measurementLevel).toBe('NOMINAL');

      const area = all.find((v) => v.variableName === 'S1Q03')!;
      expect(area.measurementLevel).toBe('NOMINAL');
    });

    it('assigns ORDINAL to explicitly whitelisted hierarchical variables', () => {
      const all = adapter.getAllVariables();

      // Enterprise size is naturally ordered (Micro, Petite, Moyenne, Grande)
      const enterpriseSize = all.find((v) => v.variableName === 'S1Q12')!;
      expect(enterpriseSize.measurementLevel).toBe('ORDINAL');
    });
  });

  describe('8. Export Consistency & DataManagementService Integration', () => {
    it('buildSpssSyntax generates valid syntax with matching column order and declarations', () => {
      const demandVars = adapter.getDemandVariables();
      const sps = adapter.buildSpssSyntax(demandVars, 'demand_submissions.csv');

      expect(sps).toContain("GET DATA");
      expect(sps).toContain("/TYPE=TXT");
      expect(sps).toContain("/FILE='demand_submissions.csv'");
      expect(sps).toContain("/FIRSTCASE=2");
      expect(sps).toContain("/VARIABLES=");

      // Contains first and last variable
      expect(sps).toContain(demandVars[0].variableName);
      expect(sps).toContain(demandVars[demandVars.length - 1].variableName);

      // Contains VARIABLE LABELS
      expect(sps).toContain('VARIABLE LABELS');
      expect(sps).toContain("N° de soumission");

      // Contains MISSING VALUES declaration
      expect(sps).toContain('MISSING VALUES');
      expect(sps).toContain('(-98, -99)');

      // Contains VALUE LABELS
      expect(sps).toContain('VALUE LABELS');
    });

    it('DataManagementService streams CSV using the canonical registry without record-dependent column loss', async () => {
      const mockPrisma = {
        onefopSubmission: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sub-1',
              submissionId: 'SUB-001',
              status: 'APPROVED',
              surveyYear: 2026,
              quarterCode: '2026-T1',
              formType: 'ENTREPRISE',
              company: { name: 'Acme Corp', taxNumber: 'TX999', region: 'Centre', department: 'Mfoundi' },
              respondent: { respondentName: 'Paul Biya', respondentFunction: 'Dir', phone1: '699112233' },
              enterpriseDetail: { legalStatus: 'SARL/ LLC', permanentWorkers: 15 },
            },
          ]),
        },
        submissionRound: { findMany: jest.fn().mockResolvedValue([]) },
      };

      const dataService = new DataManagementService(mockPrisma as any, undefined, adapter);
      const { res, chunks, isEnded } = fakeRes();

      await dataService.streamApprovedOnefopSubmissionsCsv({ partition: 'DEMAND' }, res);

      expect(isEnded()).toBe(true);
      const output = chunks.join('');

      // Header row carries the SPSS variable names (E10, dataset v4)
      const header = output.replace(/^\ufeff/, '').split('\r\n')[0].split(',');
      expect(header).toEqual(adapter.getVariablesForPartition('DEMAND').map((v) => v.variableName));
      expect(header).toContain('submissionId');
      expect(header).toContain('S1Q01');

      // Data row contains values
      expect(output).toContain('SUB-001');
      expect(output).toContain('Acme Corp');
      expect(output).toContain('Paul Biya');
      expect(output).toContain('SARL/ LLC');
    });

    it('DataManagementService streams an empty SYS_07 cell for a synthetic NA-<uuid> taxpayer number', async () => {
      const synthetic = 'NA-3f2b6c1e-0000-4000-8000-000000000000';
      const mockPrisma = {
        onefopSubmission: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sub-1',
              submissionId: 'SUB-ADM',
              status: 'APPROVED',
              surveyYear: 2026,
              formType: 'ADMINISTRATION',
              taxNumber: synthetic,
              company: { name: 'MINEFOP', taxNumber: synthetic, region: 'Centre', department: 'Mfoundi' },
              respondent: { respondentName: 'Awa', respondentFunction: 'SG', phone1: '677000001' },
            },
          ]),
        },
        submissionRound: { findMany: jest.fn().mockResolvedValue([]) },
      };

      const dataService = new DataManagementService(mockPrisma as any, undefined, adapter);
      const { res, chunks } = fakeRes();
      await dataService.streamApprovedOnefopSubmissionsCsv({ partition: 'DEMAND' }, res);

      const [header, row] = chunks.join('').split('\r\n');
      expect(row).toContain('SUB-ADM');
      expect(row).not.toContain('NA-');
      // The column stays in place; only its cell is empty.
      const col = header.split(',').indexOf('taxNumber');
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row.split(',')[col]).toBe('');
    });

    it('DataManagementService.buildSpssManifest produces syntax matching the streamed CSV columns', async () => {
      const mockPrisma = {
        onefopSubmission: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const dataService = new DataManagementService(mockPrisma as any, undefined, adapter);

      const manifest = await dataService.buildSpssManifest({ partition: 'DEMAND' });
      expect(manifest.sps).toContain("GET DATA");
      expect(manifest.sps).toContain("onefop_submissions.csv");

      const demandVars = adapter.getDemandVariables();
      expect(manifest.sps).toContain(demandVars[0].variableName);
    });
  });

  describe('9. Dynamic Section Ordering Derivation', () => {
    it('dynamically derives the exact expected 22 canonical section sequence from root.entities', () => {
      const root = loader.getRoot();
      const derivedOrder = adapter.deriveCanonicalSectionOrder(root);

      expect(derivedOrder).toEqual([
        'section0',
        'section1_entreprise',
        'section1_cooperative',
        'section1_ctd',
        'section1_ong',
        'section1_administration',
        'section1_projectProgram',
        'section1_vocationalTraining',
        'section2',
        'section2_projectProgram',
        'section2_vocationalTraining',
        'section3',
        'section3_projectProgram',
        'section3_vocationalTraining',
        'section4',
        'section4_projectProgram',
        'section4_vocationalTraining',
        'section5_vocationalTraining',
        'section6_vocationalTraining',
        'section7_vocationalTraining',
        'section8_vocationalTraining',
        'section9_vocationalTraining',
      ]);
    });
  });

  describe('10. Special Tables Schema Matrix Derivation', () => {
    it('verifies generated schema contains expected matrix topology for S22Q05 and PP_S3_OUTCOMES', () => {
      const root = loader.getRoot();
      const entS22 = root.entities.enterprise.sections.flatMap((s) => s.fields).find((f) => f.id === 'S22Q05_ENTERPRISE')!;
      expect(entS22.table?.matrix).toBeDefined();
      expect(entS22.table!.matrix!.length).toBe(4);
      expect(entS22.table!.matrix![0].length).toBe(9);

      const othS22 = root.entities.cooperative.sections.flatMap((s) => s.fields).find((f) => f.id === 'S22Q05_OTHER')!;
      expect(othS22.table?.matrix).toBeDefined();
      expect(othS22.table!.matrix!.length).toBe(4);
      expect(othS22.table!.matrix![0].length).toBe(9);

      const ppS3 = root.entities.projectProgram.sections.flatMap((s) => s.fields).find((f) => f.id === 'PP_S3_OUTCOMES')!;
      expect(ppS3.table?.matrix).toBeDefined();
      expect(ppS3.table!.matrix!.length).toBe(4);
      expect(ppS3.table!.matrix![0].length).toBe(3);
    });

    it('expands S22Q05 into exactly 36 variables per table with stable names and ordering', () => {
      const all = adapter.getAllVariables();
      const entVars = all.filter((v) => v.sourcePath.startsWith('matrix.S22Q05_ENTERPRISE.'));
      expect(entVars).toHaveLength(36);
      expect(entVars[0].variableName).toBe('s22q05_ent_deplaces_internes_permanent_male');
      expect(entVars[35].variableName).toBe('s22q05_ent_total_total_total');
      expect(entVars.every((v) => v.spssDataType === 'NUMERIC')).toBe(true);

      const othVars = all.filter((v) => v.sourcePath.startsWith('matrix.S22Q05_OTHER.'));
      expect(othVars).toHaveLength(36);
      expect(othVars[0].variableName).toBe('s22q05_oth_deplaces_internes_permanent_male');
      expect(othVars[35].variableName).toBe('s22q05_oth_total_total_total');
    });

    it('expands PP_S3_OUTCOMES into exactly 12 variables via generic table.matrix path', () => {
      const all = adapter.getAllVariables();
      const ppVars = all.filter((v) => v.sourcePath.startsWith('matrix.PP_S3_OUTCOMES.'));
      expect(ppVars).toHaveLength(12);
      expect(ppVars[0].variableName).toBe('s3kpi_employed_current');
      expect(ppVars[1].variableName).toBe('s3kpi_employed_outlook_dec');
      expect(ppVars[2].variableName).toBe('s3kpi_employed_outlook_june');
      expect(ppVars[11].variableName).toBe('s3kpi_trained_outlook_june');
      expect(ppVars.every((v) => v.spssDataType === 'NUMERIC')).toBe(true);
    });
  });

  describe('11. Nested rawData Extraction', () => {
    it('supports 1. direct property', () => {
      expect(adapter.getNestedValue({ simpleKey: 'value1' }, 'simpleKey')).toBe('value1');
    });

    it('supports 2. one-level nested property (e.g. responseStatus.S21Q01)', () => {
      const obj = { responseStatus: { S21Q01: 'REPORTED' } };
      expect(adapter.getNestedValue(obj, 'responseStatus.S21Q01')).toBe('REPORTED');
    });

    it('supports 3. multi-level nested property (e.g. a.b.c)', () => {
      const obj = { a: { b: { c: 'deepValue' } } };
      expect(adapter.getNestedValue(obj, 'a.b.c')).toBe('deepValue');
    });

    it('supports 4. missing intermediate property (returns undefined)', () => {
      const obj = { a: {} };
      expect(adapter.getNestedValue(obj, 'a.b.c')).toBeUndefined();
    });

    it('supports 5. missing final property (returns undefined)', () => {
      const obj = { a: { b: {} } };
      expect(adapter.getNestedValue(obj, 'a.b.c')).toBeUndefined();
    });

    it('supports 6. null intermediate property (returns undefined without throwing)', () => {
      const obj = { a: { b: null } };
      expect(adapter.getNestedValue(obj, 'a.b.c')).toBeUndefined();
    });

    it('extractValue correctly resolves nested responseStatus from submission.rawData', () => {
      const rsVar = adapter.getAllVariables().find((v) => v.variableName === 'S21Q01_RESPONSE_STATUS')!;
      const sub = {
        rawData: {
          responseStatus: {
            S21Q01: 'REPORTED',
          },
        },
      };
      expect(adapter.extractValue(rsVar, sub)).toBe('REPORTED');
    });
  });

  describe('12. Final SPSS Export Audit Invariants (Cross-Form & Value Integrity)', () => {
    it('guarantees 100% matrix cell coverage across all 7 supported entity forms (0 missing cells)', () => {
      const root = loader.getRoot();
      const allVars = adapter.getAllVariables();

      for (const [entityName, entity] of Object.entries(root.entities)) {
        for (const sec of entity.sections) {
          for (const f of sec.fields) {
            if (CANONICAL_PII_EXCLUSIONS.has(f.id)) continue;
            if (f.table && f.table.matrix) {
              for (const row of f.table.matrix) {
                for (const cellId of row) {
                  const match = allVars.find(
                    (v) => v.sourcePath === `matrix.${f.id}.${cellId}` || v.variableName.toLowerCase() === cellId.toLowerCase(),
                  );
                  expect(match).toBeDefined();
                }
              }
            }
          }
        }
      }
    });

    it('preserves exact 0 and avoids manufacturing zeros for blank/absent cells', () => {
      const zeroVar = adapter.getAllVariables().find((v) => v.variableName === 's21q01_cadres_male_15_24')!;
      expect(zeroVar).toBeDefined();

      // Explicit 0
      const subZero = { rawData: { s21q01_cadres_male_15_24: 0 } };
      expect(adapter.extractValue(zeroVar, subZero)).toBe(0);

      // Explicit string "0"
      const subStrZero = { rawData: { s21q01_cadres_male_15_24: '0' } };
      expect(adapter.extractValue(zeroVar, subStrZero)).toBe('0');

      // Blank / missing -> must be undefined, NEVER manufactured 0
      const subBlank = { rawData: {} };
      expect(adapter.extractValue(zeroVar, subBlank)).toBeUndefined();

      // NONE / NOT_APPLICABLE table status -> cells must be undefined
      const subNone = {
        rawData: {
          S21Q01_RESPONSE_STATUS: 'NONE',
        },
      };
      expect(adapter.extractValue(zeroVar, subNone)).toBeUndefined();
    });

    it('extracts PP_S4Q06 vulnerable recruitments from both relational vulnerableData and rawData', () => {
      const ppVar = adapter.getAllVariables().find((v) => v.variableName === 'pp_s4q06_cadres_permanent_male')!;
      expect(ppVar).toBeDefined();

      // Relation extraction
      const subRel = {
        vulnerableData: [
          { vulnerableType: 'CADRES_VULN', status: 'PERMANENT', gender: 'MALE', value: 7 },
        ],
      };
      expect(adapter.extractValue(ppVar, subRel)).toBe(7);

      // rawData extraction
      const subRaw = {
        rawData: {
          pp_s4q06_cadres_permanent_male: 4,
        },
      };
      expect(adapter.extractValue(ppVar, subRaw)).toBe(4);
    });

    it('extracts dynamic indexed slots (S3Q02, S4Q02, S4Q03) from relations and both rawData naming conventions', () => {
      // S3Q02
      const s3DescVar = adapter.getAllVariables().find((v) => v.variableName === 'S3Q02_SLOT1_DESC')!;
      const s3MaleVar = adapter.getAllVariables().find((v) => v.variableName === 'S3Q02_SLOT1_H')!;
      expect(s3DescVar).toBeDefined();
      expect(s3MaleVar).toBeDefined();

      // 1. From Prisma relation
      const subRel = {
        dismissalReasons: [
          { reasonIndex: 1, reasonText: 'Motif economique', maleCount: 5, femaleCount: 2, totalCount: 7 },
        ],
      };
      expect(adapter.extractValue(s3DescVar, subRel)).toBe('Motif economique');
      expect(adapter.extractValue(s3MaleVar, subRel)).toBe(5);

      // 2. From rawData with slot naming
      const subRawSlot = {
        rawData: {
          s3q02_slot1_desc: 'Motif technique',
          s3q02_slot1_male: 3,
        },
      };
      expect(adapter.extractValue(s3DescVar, subRawSlot)).toBe('Motif technique');
      expect(adapter.extractValue(s3MaleVar, subRawSlot)).toBe(3);

      // 3. From rawData with reason naming
      const subRawReason = {
        rawData: {
          s3q02_reason_1_text: 'Faute lourde',
          s3q02_reason_1_male: 2,
        },
      };
      expect(adapter.extractValue(s3DescVar, subRawReason)).toBe('Faute lourde');
      expect(adapter.extractValue(s3MaleVar, subRawReason)).toBe(2);

      // S4Q02 Skills needs
      const s4SkillVar = adapter.getAllVariables().find((v) => v.variableName === 'S4Q02_SLOT1_DESC')!;
      expect(adapter.extractValue(s4SkillVar, {
        skillNeeds: [{ skillIndex: 1, skillDescription: 'Dev React', maleCount: 1, femaleCount: 1, totalCount: 2 }],
      })).toBe('Dev React');
      expect(adapter.extractValue(s4SkillVar, {
        rawData: { s4q02_slot1_desc: 'Dev Node' },
      })).toBe('Dev Node');
      expect(adapter.extractValue(s4SkillVar, {
        rawData: { s4q02_skill_1_desc: 'Dev Python' },
      })).toBe('Dev Python');

      // S4Q03 Training needs
      const s4TrainVar = adapter.getAllVariables().find((v) => v.variableName === 'S4Q03_SLOT1_DESC')!;
      expect(adapter.extractValue(s4TrainVar, {
        trainingNeeds: [{ domainIndex: 1, trainingDomain: 'Securite', maleCount: 2, femaleCount: 0, totalCount: 2 }],
      })).toBe('Securite');
      expect(adapter.extractValue(s4TrainVar, {
        rawData: { s4q03_slot1_desc: 'Comptabilite' },
      })).toBe('Comptabilite');
      expect(adapter.extractValue(s4TrainVar, {
        rawData: { s4q03_training_1_domain: 'Logistique' },
      })).toBe('Logistique');
    });
  });
});

describe('E8 (dataset v6): free-text width', () => {
  const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());

  it('declares every textarea field A2000 (by schema field type) and leaves other strings as they were', () => {
    const loader = new OnefopSchemaLoaderService();
    const textareaIds = new Set<string>();
    for (const entity of Object.values(loader.getRoot().entities)) {
      for (const sec of entity.sections) for (const f of sec.fields) if (f.type === 'textarea') textareaIds.add(f.id);
    }
    expect(textareaIds.size).toBeGreaterThan(0);

    const all = adapter.getAllVariables();
    const wide = all.filter((v) => v.spssDataType !== 'NUMERIC' && v.spssWidth > 254);
    expect(wide.map((v) => v.variableName).sort()).toEqual([...textareaIds].sort());
    expect(new Set(wide.map((v) => v.spssWidth))).toEqual(new Set([SPSS_TEXTAREA_WIDTH]));
    expect(SPSS_TEXTAREA_WIDTH).toBe(2000);
    // No other string variable is wider than before.
    expect(all.filter((v) => v.spssDataType !== 'NUMERIC' && !textareaIds.has(v.variableName)).every((v) => v.spssWidth <= 254)).toBe(true);
  });

  it('the .sps GET DATA reads free text as A2000 so SPSS does not cut it', () => {
    const tvet = adapter.getTvetVariables();
    const sps = adapter.buildSpssSyntax(tvet, 'tvet.csv');
    for (const name of ['VT3_10', 'VT9_3', 'VT9_4']) expect(sps).toContain(`\n  ${name} A2000\n`);
    expect(sps).toContain('Version du schéma du jeu de données : 7.');
  });
});

describe('7.1.3 communication channels (dataset v7)', () => {
  const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());
  const CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '96'];
  const STAKEHOLDERS = ['VT7_7', 'VT7_8', 'VT7_9', 'VT7_10', 'VT7_11'];
  const byName = (name: string) => adapter.getTvetVariables().find((v) => v.variableName === name)!;
  const vt = (rawData: Record<string, unknown>) => ({ formType: 'VOCATIONAL_TRAINING', rawData });

  it('every stakeholder gets one 0/1 variable per channel, right after its own variable', () => {
    const names = adapter.getTvetVariables().map((v) => v.variableName);
    for (const s of STAKEHOLDERS) {
      const at = names.indexOf(s);
      expect(names.slice(at + 1, at + 1 + CODES.length)).toEqual(CODES.map((c) => `${s}_${c}`));
      const d = byName(`${s}_06`);
      expect(d).toMatchObject({ spssDataType: 'NUMERIC', valueLabels: { '0': 'Non', '1': 'Oui' } });
      expect(d.labelFr).toContain('WhatsApp');
    }
  });

  it('the stakeholder variable carries the channel labels, and its "précisez" is exported', () => {
    expect(byName('VT7_7').valueLabels).toMatchObject({ '01': 'Lettre / correspondance officielle', '96': 'Autre (préciser)' });
    expect(adapter.extractValue(byName('VT7_7_OTHER'), vt({ VT7_7_OTHER: 'Radio communautaire' }))).toBe('Radio communautaire');
  });

  it('1 = ticked, 0 = answered without it, blank = never answered (not read as "No")', () => {
    const answered = vt({ VT7_7: ['06', '96'], VT7_8: [] });
    expect(adapter.exportValue(byName('VT7_7_06'), answered)).toBe(1);
    expect(adapter.exportValue(byName('VT7_7_96'), answered)).toBe(1);
    expect(adapter.exportValue(byName('VT7_7_01'), answered)).toBe(0);
    expect(adapter.exportValue(byName('VT7_8_03'), answered)).toBe(0);
    expect(adapter.exportValue(byName('VT7_9_03'), answered)).toBeUndefined();
    // A comma-joined legacy value reads the same way.
    expect(adapter.exportValue(byName('VT7_10_05'), vt({ VT7_10: '01, 05' }))).toBe(1);
  });

  it('for another establishment type the dummies are -98 (not applicable)', () => {
    const v = adapter.getAllVariables().find((x) => x.variableName === 'VT7_7_06')!;
    expect(adapter.exportValue(v, { formType: 'ENTREPRISE', rawData: {} })).toBe(-98);
  });
});
