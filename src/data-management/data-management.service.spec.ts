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
      { key: 'surveyYear', header: "Année d'enquête", numeric: true },
    ];
    const sps: string = service.buildSpssSyntax(columns, 'onefop_submissions.csv');
    expect(sps).toContain('A254');
    expect(sps).toContain('F10.0');
    expect(sps).toContain('/FILE=\'onefop_submissions.csv\'');
    expect(sps).toContain('FIRSTCASE=2');
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

  it('never fetches all ~19 relations for a batch it does not need — factRecruitments/factSkillNeeds stay Excel-only', async () => {
    const { service, prisma } = makeService();
    prisma.onefopSubmission.findMany.mockResolvedValueOnce([]);
    const { res } = fakeRes();
    await service.streamApprovedOnefopSubmissionsCsv({}, res);
    const include = prisma.onefopSubmission.findMany.mock.calls[0][0].include;
    expect(include.factRecruitments).toBeUndefined();
    expect(include.factSkillNeeds).toBeUndefined();
    expect(include.cspGenderAge).toBe(true);
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
