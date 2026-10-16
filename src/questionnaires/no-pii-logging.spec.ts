import { Logger } from '@nestjs/common';
import { QuestionnairesController } from './questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import { OnefopShadowValidatorService } from '../onefop-schema-validation/onefop-shadow-validator.service';

// Defect 9 (2026-10-15 VT run): the submit and preview paths printed what
// respondents typed — names, phone numbers, emails, whole payloads — and the
// preview ran a "cooperative key" diagnostic on every request. Logs carry
// ids and counts only. Every value below is a sentinel; none may reach a
// log line, whatever the outcome of the request.

const NAME = 'Sentinelle Nguema';
const PHONE = '690123457';
const EMAIL = 'sentinelle.nguema@pii.cm';
const CENTRE = 'Centre Sentinelle';
const SENTINELS = [NAME, PHONE, EMAIL, CENTRE, 'Sentinelle', 'sentinelle'];

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' '));
  };
  const spies = [
    ...(['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(record)),
    ...(['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((m) =>
      jest.spyOn(Logger.prototype, m).mockImplementation(record)),
  ];
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) };
}

function expectNoPii(lines: string[]): void {
  const all = lines.join('\n');
  for (const s of SENTINELS) expect(all).not.toContain(s);
}

function buildMockPrisma(): any {
  return {
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1', establishmentId: 'EST-1' }) },
    submissionRound: {
      findFirst: jest.fn().mockResolvedValue({ id: 'round-1', status: 'OPEN', deadline: new Date(Date.now() + 86400000) }),
    },
    onefopSubmission: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ submissionId: data.submissionId })),
    },
    subdivision: { findFirst: jest.fn().mockResolvedValue(null) },
    department: { findFirst: jest.fn().mockResolvedValue(null) },
    region: { findFirst: jest.fn().mockResolvedValue(null) },
    sector: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

function buildController(pdfService: any = {}) {
  const service = new QuestionnairesService(buildMockPrisma());
  return new QuestionnairesController(service, pdfService);
}

function mockResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.send = jest.fn();
  return res;
}

const vtData = (email = EMAIL) => ({
  VT1_2: CENTRE,
  VT1_15_NAME: NAME,
  VT1_15_FUNCTION: 'Directeur',
  VT1_15_TEL1: PHONE,
  VT1_15_EMAIL: email,
  VT1_15_SEX: 'Féminin',
});

const enterpriseData = {
  S0Q01: NAME,
  S0Q02: 'Directeur',
  S0Q03_TEL1: PHONE,
  S0Q03_EMAIL: EMAIL,
  S1Q01: '1',
  S1Q02: CENTRE,
};

describe('No personal data in logs (defect 9)', () => {
  let logs: ReturnType<typeof captureLogs>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // The old dumps were dev-only; test in the mode where they ran.
    process.env.NODE_ENV = 'development';
    logs = captureLogs();
  });
  afterEach(() => {
    logs.restore();
    process.env.NODE_ENV = originalEnv;
  });

  it('a saved submission logs its id, entity type and user, never the respondent', async () => {
    const result = await buildController().submit(
      { formId: 'vt-form-1', entityType: 'VOCATIONAL_TRAINING', isDraft: true, data: vtData() },
      { user: { id: 'user-1' } },
    );

    expect(logs.lines.join('\n')).toContain(`Submission ${result.submissionId} saved (VOCATIONAL_TRAINING draft, user user-1)`);
    expectNoPii(logs.lines);
  });

  it('a refused submission logs the failing property paths, not their values', async () => {
    const badEmail = 'sentinelle-sans-arobase';
    await expect(buildController().submit(
      { formId: 'vt-form-1', entityType: 'VOCATIONAL_TRAINING', isDraft: true, data: vtData(badEmail) },
      { user: { id: 'user-1' } },
    )).rejects.toBeDefined();

    const all = logs.lines.join('\n');
    expect(all).toContain('respondent.email');
    expect(all).not.toContain(badEmail);
    expectNoPii(logs.lines);
  });

  it('an enterprise submission logs no company name (flat-key normalizer)', async () => {
    await buildController().submit(
      { formId: 'ent-form-1', entityType: 'ENTREPRISE', isDraft: true, data: enterpriseData },
      { user: { id: 'user-1' } },
    ).catch(() => undefined);

    expectNoPii(logs.lines);
  });

  it.each([
    ['vocationalTraining', vtData()],
    ['enterprise', enterpriseData],
  ])('an HTML preview (%s) logs nothing about the form, and no key diagnostic', async (entityType, data) => {
    const pdfService = { renderHtml: jest.fn().mockReturnValue('<html></html>') };
    const res = mockResponse();

    await buildController(pdfService).preview({ entityType, data, format: 'html' }, res);

    expect(res.send).toHaveBeenCalledWith('<html></html>');
    expect(logs.lines.join('\n')).not.toContain('KEY DIAGNOSTIC');
    expectNoPii(logs.lines);
  });

  it('a failed PDF preview logs the step and error, not the form', async () => {
    const pdfService = { generate: jest.fn().mockRejectedValue(new Error('renderer down')) };
    const res = mockResponse();

    await buildController(pdfService).preview({ entityType: 'vocationalTraining', data: vtData() }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(logs.lines.join('\n')).toContain('step 3, PDF generation failed: renderer down');
    expectNoPii(logs.lines);
  });

  it('the shadow validator logs field ids, not the values it rejected', () => {
    const validator = new OnefopShadowValidatorService(new OnefopSchemaLoaderService());

    validator.validateAndLog('vocationalTraining', { VT1_15_EMAIL: 'sentinelle-sans-arobase' }, 'VT26000001');

    const all = logs.lines.join('\n');
    expect(all).toContain('VT1_15_EMAIL');
    expect(all).not.toContain('sentinelle-sans-arobase');
  });
});
