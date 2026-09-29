import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { DataManagementService } from './data-management.service';

// The streaming SPSS export (buildSpssManifest / streamApprovedOnefopSubmissionsCsv
// / buildFlatColumns) is what changed to handle large submission counts — these
// tests exercise it against a mocked PrismaService rather than a live database,
// checking the two things that would actually break silently: the column list
// Pass A discovers stays correct, and Pass B's keyset pagination + CSV output
// line up with it.

function makeService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    onefopSubmission: { findMany: jest.fn().mockResolvedValue([]) },
    onefopCspGenderAge: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopDiplomaData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopDisabilityData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopVulnerableData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopFirstTimeWorker: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopJobApplicationData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopRegisteredSeeker: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopDepartureData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopDismissalUnemployment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopInternshipData: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopDismissalReason: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopSkillNeed: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopTrainingNeed: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    onefopFactRecruitment: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopFactSkillNeed: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtDiplomaData: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtTraineeAgeFlow: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtTrainerAge: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtEducationLevelFlow: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtTraineeVulnerable: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtTrainerDisability: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtScholarship: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtSpecialtyRow: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtCurriculum: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtInfrastructure: { findFirst: jest.fn().mockResolvedValue(null) },
    onefopVtFurniture: { findFirst: jest.fn().mockResolvedValue(null) },
    projectProgramActivity: { findFirst: jest.fn().mockResolvedValue(null) },
    ...prismaOverrides,
  };
  const service = new DataManagementService(prisma as any);
  return { service: service as any, prisma };
}

// A real Writable (PassThrough) is required here, not a fakeRes() stub —
// ExcelJS's streaming WorkbookWriter pipes zip entries through `archiver`
// straight into whatever stream it's given, so it needs real stream
// semantics (write/end/drain), not just the .write()/.end() shape the CSV
// export's res mock gets away with.
function fakeExcelRes() {
  const stream = new PassThrough();
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(c));
  const finished = new Promise<void>((resolve) => stream.on('end', () => resolve()));
  return {
    res: Object.assign(stream, {
      setHeader: (k: string, v: string) => { headers[k] = v; },
    }) as any,
    headers,
    finished,
    buffer: () => Buffer.concat(chunks),
  };
}

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

describe('DataManagementService — CSV/SPSS helpers (no DB)', () => {
  it('csvEscape quotes only values containing commas, quotes, or newlines', () => {
    const { service } = makeService();
    expect(service.csvEscape('plain')).toBe('plain');
    expect(service.csvEscape('a,b')).toBe('"a,b"');
    expect(service.csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(service.csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(service.csvEscape(null)).toBe('');
    expect(service.csvEscape(undefined)).toBe('');
    expect(service.csvEscape(42)).toBe('42');
  });

  it('sanitizeSpssVarName strips accents/punctuation, dedupes, and avoids reserved words', () => {
    const { service } = makeService();
    const used = new Set<string>();
    // NFD-normalized first, so accents are stripped to their base letter
    // (Année → Annee) rather than turned into underscores.
    expect(service.sanitizeSpssVarName("Année d'enquête", 1, used)).toBe('Annee_d_enquete');
    // A second column with the exact same header must not collide.
    const second = service.sanitizeSpssVarName("Année d'enquête", 2, used);
    expect(second).not.toBe('Annee_d_enquete');
    // A header that's just a reserved SPSS keyword gets suffixed.
    expect(service.sanitizeSpssVarName('AND', 3, used).toUpperCase()).not.toBe('AND');
    // A header starting with a digit gets a safe prefix.
    expect(service.sanitizeSpssVarName('2026', 4, used)).toMatch(/^v4_/);
  });

  it('buildSpssSyntax declares numeric columns as F10.0 and string columns as A254 from the static flag alone', () => {
    const { service } = makeService();
    const columns = [
      { key: 'submissionId', header: 'N° de soumission', numeric: false },
      { key: 'formType', header: 'Type de formulaire', numeric: false },
      { key: 'region', header: 'Région', numeric: false },
      { key: 'surveyYear', header: "Année d'enquête", numeric: true },
    ];
    const sps: string = service.buildSpssSyntax(columns, 'onefop_submissions.csv');
    expect(sps).toContain('A254');
    expect(sps).toContain('F10.0');
    expect(sps).toContain('/FILE=\'onefop_submissions.csv\'');
    expect(sps).toContain('FIRSTCASE=2');
    expect(sps).toContain('MISSING VALUES');
    expect(sps).toContain('(-99)');
    expect(sps).toContain('VALUE LABELS');
    expect(sps).toContain("'ENTREPRISE' \"Entreprise\"");
    expect(sps).toContain("'LITTORAL' \"Littoral\"");
  });

  it('buildFormTypeRemap only remaps a form-type column when its key collides with a common/formType column', () => {
    const { service } = makeService();
    const remap = service.buildFormTypeRemap() as Map<string, Map<string, string>>;
    // ENTREPRISE's own "companyName" key collides with the common
    // "companyName" column (pulled from the linked Company record) — must
    // be remapped, not silently merged.
    expect(remap.get('ENTREPRISE')?.get('companyName')).toBe('companyName_entreprise');
    // A column unique to one form type (e.g. COOPERATIVE's cooperativeType)
    // never collides, so it must be absent from that type's remap.
    expect(remap.get('COOPERATIVE')?.has('cooperativeType')).toBe(false);
  });
});

describe('DataManagementService.buildFlatColumns — Pass A (mocked DB)', () => {
  it('produces exactly the distinct combinations the mocked queries return, marked numeric, in query order', async () => {
    const { service, prisma } = makeService({
      onefopCspGenderAge: {
        findMany: jest.fn().mockResolvedValue([
          { tableName: 's21q01', cspCategory: 'CADRES', gender: 'MALE', ageBand: 'AGE_15_24' },
          { tableName: 's21q01', cspCategory: 'CADRES', gender: 'MALE', ageBand: 'AGE_25_34' },
        ]),
      },
    });

    const columns = await service.buildFlatColumns({ status: 'APPROVED' });

    expect(prisma.onefopCspGenderAge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submission: { status: 'APPROVED' } },
        distinct: ['tableName', 'cspCategory', 'gender', 'ageBand'],
      }),
    );

    const pivotCols = columns.filter((c: any) => c.key.startsWith('csp_'));
    expect(pivotCols).toHaveLength(2);
    expect(pivotCols.every((c: any) => c.numeric)).toBe(true);
    expect(pivotCols.map((c: any) => c.key)).toEqual([
      'csp_s21q01_CADRES_MALE_AGE_15_24',
      'csp_s21q01_CADRES_MALE_AGE_25_34',
    ]);
  });

  it('never queries more than the bounded distinct set, regardless of how many submissions are behind it', async () => {
    // The whole point of Pass A: this mock stands in for "20,000
    // submissions all sharing the same 4 age-band/3-gender combination" —
    // the query itself only ever returns the *possible* combinations, not
    // one row per submission, so buildFlatColumns' output size is bounded
    // by the enum space, not by submission count.
    const { service } = makeService({
      onefopCspGenderAge: {
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: 12 }, (_, i) => ({
            tableName: 's21q01',
            cspCategory: 'CADRES',
            gender: 'MALE',
            ageBand: `AGE_${i}`,
          })),
        ),
      },
    });
    const columns = await service.buildFlatColumns({ status: 'APPROVED' });
    expect(columns.filter((c: any) => c.key.startsWith('csp_'))).toHaveLength(12);
  });

  it('builds indexed-pivot columns (Description/Hommes/Femmes/Total) per distinct index', async () => {
    const { service } = makeService({
      onefopDismissalReason: {
        findMany: jest.fn().mockResolvedValue([{ reasonIndex: 1 }, { reasonIndex: 2 }]),
      },
    });
    const columns = await service.buildFlatColumns({ status: 'APPROVED' });
    const reasonCols = columns.filter((c: any) => c.key.startsWith('dismissalReasons_'));
    expect(reasonCols).toHaveLength(8); // 2 indices × 4 sub-columns
    expect(reasonCols.map((c: any) => c.key)).toContain('dismissalReasons_1_desc');
    expect(reasonCols.find((c: any) => c.key === 'dismissalReasons_1_desc').numeric).toBe(false);
    expect(reasonCols.find((c: any) => c.key === 'dismissalReasons_1_h').numeric).toBe(true);
  });
});

describe('DataManagementService.streamApprovedOnefopSubmissionsCsv — Pass B (mocked DB)', () => {
  it('writes a header row, one CSV row per submission, and ends the response', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        submissionId: 'S-0001',
        status: 'APPROVED',
        surveyYear: 2026,
        quarterCode: '2026-T1',
        formType: 'ENTREPRISE',
        company: { name: 'Acme', taxNumber: 'TX1', region: 'Centre', department: 'Mfoundi', establishmentId: 'EST1' },
        respondent: { respondentName: 'Jean', respondentFunction: 'DRH', phone1: '677000000' },
        enterpriseDetail: { companyName: 'Acme SARL' },
      },
    ]);

    const { res, chunks, headers, isEnded } = fakeRes();
    await service.streamApprovedOnefopSubmissionsCsv({}, res);

    expect(headers['Content-Type']).toContain('text/csv');
    expect(headers['Content-Disposition']).toContain('onefop_submissions.csv');
    expect(isEnded()).toBe(true);

    const body = chunks.join('');
    expect(body).toContain('N° de soumission');
    expect(body).toContain('S-0001');
    expect(body).toContain('Acme SARL');
    // A batch smaller than BATCH_SIZE is itself the "no more pages" signal
    // — exactly one round trip, no extra call just to confirm an empty
    // follow-up page (see the `batch.length < BATCH_SIZE` early break).
    expect(prisma.onefopSubmission.findMany).toHaveBeenCalledTimes(1);
  });

  it('paginates with a keyset cursor on id, not offset/skip-only pagination', async () => {
    const { service, prisma } = makeService();
    const fullBatch = Array.from({ length: 250 }, (_, i) => ({
      id: `sub-${i}`,
      submissionId: `S-${i}`,
      status: 'APPROVED',
      surveyYear: 2026,
      formType: 'ENTREPRISE',
      company: {},
      respondent: {},
      enterpriseDetail: {},
    }));
    prisma.onefopSubmission.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([]);

    const { res } = fakeRes();
    await service.streamApprovedOnefopSubmissionsCsv({}, res);

    const secondCallArgs = prisma.onefopSubmission.findMany.mock.calls[1][0];
    expect(secondCallArgs.cursor).toEqual({ id: 'sub-249' });
    expect(secondCallArgs.skip).toBe(1);
  });

  it('fetches projectProgramActivities but not the empty ETL tables (factRecruitments/factSkillNeeds)', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockResolvedValueOnce([]);
    const { res } = fakeRes();
    await service.streamApprovedOnefopSubmissionsCsv({}, res);
    const include = prisma.onefopSubmission.findMany.mock.calls[0][0].include;
    // factRecruitments/factSkillNeeds are empty ETL tables never written by
    // the submission pipeline — no data to export.
    expect(include.factRecruitments).toBeUndefined();
    expect(include.factSkillNeeds).toBeUndefined();
    // PP activities are real form data and must be present.
    expect(include.projectProgramActivities).toBe(true);
    expect(include.cspGenderAge).toBe(true);
  });

  // VT-8 gap-closing regression coverage (2026-08-30): buildFlatColumns/
  // approvedOnefopInclude both build off onefopSheetDefs(), which already
  // carries a VOCATIONAL_TRAINING entry (VT-8's flat Excel sheet) — so VT's
  // Detail-level fields (name, cfpType, totalTraineesDeclared, etc.) flow
  // through the flat SPSS/CSV export automatically, with no VT-specific
  // code needed here. This locks that in; the 11 OnefopVt* breakdown tables
  // stay Excel-only (their own long-format sheets), matching how the
  // shared six-entity fact tables' *own* per-entity data — as opposed to
  // their small-enum pivots — is handled: only ENTREPRISE/COOPERATIVE/CTD/
  // ONG's ten shared fact tables get pivoted into flat columns, and VT's
  // own child tables were never meant to follow that path either.
  it('includes vocationalTrainingDetail in the fetch and its columns in Pass A, so a VT submission renders with real data in Pass B', async () => {
    const { service, prisma } = makeService();

    // buildFlatColumns' static columns come from onefopSheetDefs(), not the
    // DB — no mocked data needed to see VT's columns show up in Pass A.
    const columns = await service.buildFlatColumns({ status: 'APPROVED' });
    const columnKeys = columns.map((c: any) => c.key);
    expect(columnKeys).toContain('cfpType');
    expect(columnKeys).toContain('totalTraineesDeclared');

    prisma.onefopSubmission.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        submissionId: 'S-0004',
        status: 'APPROVED',
        surveyYear: 2026,
        formType: 'VOCATIONAL_TRAINING',
        company: { name: 'CFP Test', taxNumber: 'TX4', region: 'Centre', department: 'Mfoundi', establishmentId: 'EST4' },
        respondent: { respondentName: 'Awa', respondentFunction: 'Directeur', phone1: '677000003' },
        vocationalTrainingDetail: { name: 'CFP Test', cfpType: 'PUBLIC', totalTraineesDeclared: 120 },
      },
    ]);
    const { res, chunks } = fakeRes();
    await service.streamApprovedOnefopSubmissionsCsv({}, res);

    expect(prisma.onefopSubmission.findMany.mock.calls[0][0].include.vocationalTrainingDetail).toBe(true);
    const body = chunks.join('');
    expect(body).toContain('S-0004');
    expect(body).toContain('PUBLIC');
    expect(body).toContain('120');
  });
});

describe('DataManagementService.streamOnefopSubmissionsExcel — sheet-by-sheet streaming (mocked DB)', () => {
  it('produces a valid, readable workbook containing only the fallback sheet when nothing matches', async () => {
    const { service } = makeService();
    const { res, headers, finished, buffer } = fakeExcelRes();

    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    expect(headers['Content-Type']).toContain('spreadsheetml');
    expect(headers['Content-Disposition']).toContain('onefop_submissions_');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer() as any);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Soumissions']);
    expect(wb.worksheets[0].getCell('A1').value).toContain('Aucune soumission');
  });

  it('writes a real entity sheet (header + data row) for a form type with submissions, round-tripped through a real xlsx parse', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockImplementation(async (args: any) => {
      if (args.distinct?.includes('formType')) return [{ formType: 'ENTREPRISE' }];
      if (args.include) {
        if (args.cursor) return [];
        return [
          {
            id: 'sub-1',
            submissionId: 'S-0001',
            status: 'APPROVED',
            surveyYear: 2026,
            formType: 'ENTREPRISE',
            company: { name: 'Acme', taxNumber: 'TX1', region: 'Centre', department: 'Mfoundi', establishmentId: 'EST1' },
            respondent: { respondentName: 'Jean', respondentFunction: 'DRH', phone1: '677000000' },
            enterpriseDetail: { companyName: 'Acme SARL' },
          },
        ];
      }
      return [];
    });

    const { res, finished, buffer } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer() as any);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Entreprises']);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).font?.bold).toBe(true);
    const headerRow = sheet.getRow(1).values as unknown[];
    expect(headerRow).toContain('N° de soumission');
    const dataRow = sheet.getRow(2).values as unknown[];
    expect(dataRow).toContain('S-0001');
    // enterpriseDetail's own companyName ("Raison sociale") overwrites the
    // common companyName column ("Entreprise (fiche)") on this sheet, same
    // as the original non-streaming buildOnefopWorkbook did — no remap
    // here, unlike the flat CSV/SPSS export where every form type shares
    // one table and a collision would otherwise silently merge two columns.
    expect(dataRow).toContain('Acme SARL');
  });

  it('scopes each entity sheet fetch to its own form type and skips form types absent from the data', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockImplementation(async (args: any) => {
      if (args.distinct?.includes('formType')) return [{ formType: 'ONG' }];
      return [];
    });

    const { res, finished } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    const entityCalls = prisma.onefopSubmission.findMany.mock.calls.filter((c: any[]) => c[0].include);
    expect(entityCalls).toHaveLength(1);
    expect(entityCalls[0][0].where.formType).toBe('ONG');
  });

  it('skips a breakdown sheet whose existence check returns nothing, without ever fetching its data', async () => {
    const { service, prisma } = makeService();
    const { res, finished } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    expect(prisma.onefopCspGenderAge.findFirst).toHaveBeenCalled();
    const selectCalls = prisma.onefopSubmission.findMany.mock.calls.filter((c: any[]) => c[0].select && !c[0].distinct);
    expect(selectCalls).toHaveLength(0);
  });

  it('fetches a present breakdown sheet with a light single-relation select, not the ~19-relation entity include', async () => {
    const { service, prisma } = makeService({
      onefopDismissalReason: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'reason-1' }),
      },
    });
    prisma.onefopSubmission.findMany.mockImplementation(async (args: any) => {
      if (args.select) return [];
      return [];
    });

    const { res, finished } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    const selectCalls = prisma.onefopSubmission.findMany.mock.calls.filter((c: any[]) => c[0].select && !c[0].distinct);
    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0][0].select.dismissalReasons).toBe(true);
    expect(selectCalls[0][0].include).toBeUndefined();
  });
});

// P2 audit fix regression coverage.
//
// onefopSheetDefs() used to only define sheets for ENTREPRISE/COOPERATIVE/
// CTD/ONG, so Administration and Projects & Programs submissions — while
// correctly persisted in Postgres — never got their entity-specific fields
// into the bulk Excel/SPSS export at all. This locks in that both newer
// entity types now have a sheet definition, that approvedOnefopInclude()
// (shared by both the Excel per-entity-sheet fetch and the flat CSV/SPSS
// export) actually fetches their detail relations, and that the export
// pipeline accepts and renders a real Administration sheet end to end.
describe('DataManagementService — onefopSheetDefs (P2: Administration/Projects & Programs export sheets)', () => {
  it('defines a sheet for all six ONEFOP entity types, including the two newer ones', () => {
    const { service } = makeService();
    const defs = service.onefopSheetDefs() as Array<{ formType: string; detailKey: string }>;
    const byFormType = new Map(defs.map((d) => [d.formType, d.detailKey]));
    expect(byFormType.get('ENTREPRISE')).toBe('enterpriseDetail');
    expect(byFormType.get('COOPERATIVE')).toBe('cooperativeDetail');
    expect(byFormType.get('CTD')).toBe('ctdDetail');
    expect(byFormType.get('ONG')).toBe('ongDetail');
    expect(byFormType.get('ADMINISTRATION')).toBe('administrationDetail');
    expect(byFormType.get('PROJECT_PROGRAM')).toBe('projectProgramDetail');
  });

  it('approvedOnefopInclude fetches administrationDetail and projectProgramDetail, so the new sheet columns are never left empty', () => {
    const { service } = makeService();
    const include = service.approvedOnefopInclude();
    expect(include.administrationDetail).toBe(true);
    expect(include.projectProgramDetail).toBe(true);
  });

  it('writes a real Administration sheet (header + data row) through the same streaming Excel pipeline as the original four entities', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockImplementation(async (args: any) => {
      if (args.distinct?.includes('formType')) return [{ formType: 'ADMINISTRATION' }];
      if (args.include) {
        if (args.cursor) return [];
        return [
          {
            id: 'sub-1',
            submissionId: 'S-0002',
            status: 'APPROVED',
            surveyYear: 2026,
            formType: 'ADMINISTRATION',
            company: { name: 'MINEFOP', taxNumber: 'TX2', region: 'Centre', department: 'Mfoundi', establishmentId: 'EST2' },
            respondent: { respondentName: 'Awa', respondentFunction: 'SG', phone1: '677000001' },
            administrationDetail: { name: 'Délégation Régionale', mainMission: 'Emploi et formation' },
          },
        ];
      }
      return [];
    });

    const { res, finished, buffer } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer() as any);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Administrations']);
    const sheet = wb.worksheets[0];
    const headerRow = sheet.getRow(1).values as unknown[];
    expect(headerRow).toContain('Mission principale');
    const dataRow = sheet.getRow(2).values as unknown[];
    expect(dataRow).toContain('S-0002');
    expect(dataRow).toContain('Délégation Régionale');
  });
});

// VT-8 gap-closing regression coverage (2026-08-30): the 11 statistical
// OnefopVt* child/fact tables used to have no long-format breakdown sheet at
// all (see VOCATIONAL_TRAINING_DESIGN_NOTE.md). This locks in that one of
// them renders end to end alongside the flat VT sheet, and that the named
// trainer roster (8.8, PII) stays excluded from BREAKDOWN_SHEET_DEFS.
describe('DataManagementService — VOCATIONAL_TRAINING breakdown sheets (VT-8)', () => {
  it('writes the flat VT sheet plus a VtDiplomaData breakdown sheet, and never a trainer-roster sheet', async () => {
    const { service, prisma } = makeService({
      onefopVtDiplomaData: { findFirst: jest.fn().mockResolvedValue({ id: 'vtd-1' }) },
    });
    prisma.onefopSubmission.findMany.mockImplementation(async (args: any) => {
      if (args.distinct?.includes('formType')) return [{ formType: 'VOCATIONAL_TRAINING' }];
      if (args.include) {
        if (args.cursor) return [];
        return [
          {
            id: 'sub-1',
            submissionId: 'S-0003',
            status: 'APPROVED',
            surveyYear: 2026,
            formType: 'VOCATIONAL_TRAINING',
            company: { name: 'CFP Test', taxNumber: 'TX3', region: 'Centre', department: 'Mfoundi', establishmentId: 'EST3' },
            respondent: { respondentName: 'Awa', respondentFunction: 'Directeur', phone1: '677000002' },
            vocationalTrainingDetail: { name: 'CFP Test', totalTraineesDeclared: 120 },
          },
        ];
      }
      if (args.select) {
        if (args.cursor) return [];
        return [
          {
            id: 'sub-1',
            submissionId: 'S-0003',
            formType: 'VOCATIONAL_TRAINING',
            region: 'Centre',
            company: { name: 'CFP Test' },
            vtDiplomaData: [
              { personType: 'TRAINEE', diplomaKind: 'ACADEMIC', diploma: 'CEP', gender: 'MALE', value: 12 },
            ],
          },
        ];
      }
      return [];
    });

    const { res, finished, buffer } = fakeExcelRes();
    await service.streamOnefopSubmissionsExcel({}, res);
    await finished;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer() as any);
    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain('Formation Professionnelle');
    expect(sheetNames).toContain('FP - Diplômes');
    expect(sheetNames.some((n) => n.toLowerCase().includes('roster') || n.includes('formateurs (nominatif)'))).toBe(false);

    const diplomaSheet = wb.worksheets[sheetNames.indexOf('FP - Diplômes')];
    const dataRow = diplomaSheet.getRow(2).values as unknown[];
    expect(dataRow).toContain('S-0003');
    expect(dataRow).toContain('CEP');
    expect(dataRow).toContain(12);
  });

  describe('Export Gating & Statistical Eligibility Invariant', () => {
    it('buildApprovedOnefopWhere enforces status: APPROVED and 0 open blocking anomalies', () => {
      const { service } = makeService();
      const where = service.buildApprovedOnefopWhere({ region: 'Littoral', year: 2026 });

      expect(where.status).toBe('APPROVED');
      expect(where.anomalies).toEqual({
        none: {
          status: 'OPEN',
          isBlocking: true,
        },
      });
      expect(where.region).toEqual({ equals: 'Littoral', mode: 'insensitive' });
      expect(where.surveyYear).toBe(2026);
    });

    it('streamApprovedOnefopSubmissionsCsv never queries or exports records without enforcing the blocking-anomaly exclusion gate', async () => {
      const { service, prisma } = makeService();
      prisma.onefopSubmission.findMany.mockResolvedValue([]);

      const { res } = fakeRes();
      await service.streamApprovedOnefopSubmissionsCsv({ region: 'Centre' }, res);

      expect(prisma.onefopSubmission.findMany).toHaveBeenCalled();
      const firstCallArgs = prisma.onefopSubmission.findMany.mock.calls[0][0];
      expect(firstCallArgs.where.status).toBe('APPROVED');
      expect(firstCallArgs.where.anomalies).toEqual({
        none: {
          status: 'OPEN',
          isBlocking: true,
        },
      });
      expect(firstCallArgs.where.region).toEqual({ equals: 'Centre', mode: 'insensitive' });
    });

    it('buildSpssManifest enforces the blocking-anomaly exclusion gate for column discovery', async () => {
      const { service, prisma } = makeService();
      await service.buildSpssManifest({ year: 2026 });

      // Pass A queries use the where clause with the anomaly gate
      expect(prisma.onefopCspGenderAge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            submission: expect.objectContaining({
              status: 'APPROVED',
              anomalies: {
                none: {
                  status: 'OPEN',
                  isBlocking: true,
                },
              },
            }),
          },
        }),
      );
    });
  });
});

