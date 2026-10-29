import { BadRequestException } from '@nestjs/common';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { buildAdminListWhere } from './admin-list-filter';

type ListArgs = {
  status?: string; statuses?: string; limit?: string; offset?: string; region?: string;
  search?: string; formType?: string; period?: string; companyId?: string; sort?: string;
  department?: string; campaignId?: string; quarterCode?: string; late?: string; overdue?: string;
  view?: string; includeArchived?: string; assignedToMe?: string; quality?: string; assignment?: string;
};

describe('AdminQuestionnairesController.getAll — list params', () => {
  let service: { listForAdmin: jest.Mock };
  let controller: AdminQuestionnairesController;
  const req = { user: { id: 'a1', role: 'REGIONAL_ADMIN', region: 'Littoral' } };
  const getAll = (a: ListArgs = {}) =>
    controller.getAll(
      a.status, a.statuses, a.limit, a.offset, a.region, a.search, a.formType, a.period,
      a.companyId, a.sort, a.department, a.campaignId, a.quarterCode,
      a.late, a.overdue, req, a.view, a.includeArchived, a.assignedToMe, a.quality, a.assignment,
    );

  beforeEach(() => {
    service = { listForAdmin: jest.fn(async () => ({ items: [], total: 0 })) };
    controller = new AdminQuestionnairesController(service as unknown as QuestionnairesService, {} as any);
  });

  it('applies limit 100 and offset 0 by default, with or without a status', async () => {
    await getAll();
    await getAll({ status: 'PENDING_REVIEW' });
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ status: undefined, limit: 100, offset: 0 });
    expect(service.listForAdmin.mock.calls[1][0]).toMatchObject({ status: 'PENDING_REVIEW', limit: 100, offset: 0 });
  });

  it('parses string query params and passes every filter through', async () => {
    await getAll({
      status: 'APPROVED', limit: '10', offset: '30', region: ' Centre ', search: ' mbarga ',
      formType: 'COOPERATIVE', period: '30d', companyId: 'comp-1', department: ' Moungo ',
      campaignId: 'campaign-1', quarterCode: '2026-T4', late: '1', overdue: 'true',
    });
    expect(service.listForAdmin).toHaveBeenCalledWith(
      {
        status: 'APPROVED', formType: 'COOPERATIVE', period: '30d', region: 'Centre',
        department: 'Moungo', search: 'mbarga', companyId: 'comp-1',
        campaignId: 'campaign-1', quarterCode: '2026-T4', late: true, overdue: true,
        limit: 10, offset: 30,
      },
      expect.objectContaining({ role: 'REGIONAL_ADMIN', region: 'Littoral' }),
      false,
    );
  });

  it('accepts both flag spellings and treats explicit false as absent', async () => {
    await getAll({ late: 'true', overdue: '1' });
    await getAll({ late: 'false', overdue: '0' });
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ late: true, overdue: true });
    expect(service.listForAdmin.mock.calls[1][0]).toMatchObject({ late: undefined, overdue: undefined });
  });

  it('rejects an unknown late or overdue flag with 400', async () => {
    await expect(getAll({ late: 'yes' })).rejects.toThrow('Le paramètre « late » doit valoir true ou false.');
    await expect(getAll({ overdue: 'oui' })).rejects.toThrow('Le paramètre « overdue » doit valoir true ou false.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('answers 400 with a French message for invalid paging, before querying', async () => {
    const invalid: ListArgs[] = [
      { limit: '101' }, { limit: 'abc' }, { limit: '1.5' }, { limit: '-1' },
      { offset: '-5' }, { offset: 'x' },
    ];
    for (const args of invalid) {
      await expect(getAll(args)).rejects.toThrow(BadRequestException);
    }
    await expect(getAll({ limit: '101' })).rejects.toThrow('Le paramètre « limit » doit être un entier entre 0 et 100.');
    await expect(getAll({ offset: '-5' })).rejects.toThrow('Le paramètre « offset » doit être un entier positif ou nul.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  // limit=0 is the count-only request the admin questionnaires page makes for
  // each of its seven totals: it was rejected until 2026-10-18, so the page
  // asked for one row and received a whole declaration, rawData included,
  // only to read `total` (B11 of the 2026-10-17 run).
  it('accepts limit 0 and passes it through as a count-only request', async () => {
    await getAll({ limit: '0', formType: 'PROJECT_PROGRAM' });
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ formType: 'PROJECT_PROGRAM', limit: 0, offset: 0 });
  });

  it('rejects unknown statuses, and DRAFT, with 400', async () => {
    await expect(getAll({ status: 'NOT_A_STATUS' })).rejects.toThrow('Statut de dossier inconnu.');
    await expect(getAll({ status: 'DRAFT' })).rejects.toThrow('Statut de dossier inconnu.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('rejects unknown and deprecated questionnaire types with 400', async () => {
    await expect(getAll({ formType: 'NOPE' })).rejects.toThrow('Type de questionnaire inconnu.');
    await expect(getAll({ formType: 'VOCATIONAL_TRAINING_CENTER' })).rejects.toThrow('Type de questionnaire inconnu.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('rejects unknown periods with 400', async () => {
    for (const period of ['1d', '30', 'all', '30D']) {
      await expect(getAll({ period })).rejects.toThrow('Période inconnue.');
    }
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('passes the sort order through, and rejects an unknown one with 400', async () => {
    await getAll({ sort: 'oldest' });
    await getAll({ sort: 'newest' });
    await getAll();
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ sort: 'oldest' });
    expect(service.listForAdmin.mock.calls[1][0]).toMatchObject({ sort: 'newest' });
    expect(service.listForAdmin.mock.calls[2][0].sort).toBeUndefined();
    service.listForAdmin.mockClear();
    for (const sort of ['asc', 'OLDEST', 'createdAt']) {
      await expect(getAll({ sort })).rejects.toThrow('Ordre de tri inconnu.');
    }
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('keeps assignedToMe=1 as assignment me for the signed-in officer', async () => {
    await getAll({ assignedToMe: '1' });
    const filters = service.listForAdmin.mock.calls[0][0];
    expect(filters).toMatchObject({ assignment: 'me', assigneeId: 'a1' });
    expect(buildAdminListWhere(filters, service.listForAdmin.mock.calls[0][1]).AND)
      .toContainEqual({ assigneeId: 'a1' });
  });

  it('accepts assignment=me together with assignedToMe=1, since both mean the same officer', async () => {
    await getAll({ assignedToMe: '1', assignment: 'me' });
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ assignment: 'me', assigneeId: 'a1' });
  });

  it('rejects an assignment that contradicts assignedToMe with 400', async () => {
    await expect(getAll({ assignedToMe: '1', assignment: 'unassigned' })).rejects.toThrow(
      'Les paramètres assignment et assignedToMe sont contradictoires.',
    );
    await expect(getAll({ assignedToMe: '1', assignment: 'other' })).rejects.toThrow(
      'Les paramètres assignment et assignedToMe sont contradictoires.',
    );
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('rejects unknown quality and assignment values with 400', async () => {
    await expect(getAll({ quality: 'dirty' })).rejects.toThrow('Qualité inconnue.');
    await expect(getAll({ assignment: 'everyone' })).rejects.toThrow('Affectation inconnue.');
    await expect(getAll({ quality: 'CLEAN' })).rejects.toThrow('Qualité inconnue.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('passes each quality and assignment through to the same where the export uses', async () => {
    await getAll({ quality: 'clean', assignment: 'unassigned' });
    await getAll({ quality: 'warnings', assignment: 'other' });
    await getAll({ quality: 'blocking', assignment: 'me' });
    const calls = service.listForAdmin.mock.calls;
    expect(buildAdminListWhere(calls[0][0]).AND).toEqual(expect.arrayContaining([
      { anomalies: { none: { status: 'OPEN' } } },
      { assigneeId: null },
    ]));
    expect(buildAdminListWhere(calls[1][0]).AND).toEqual(expect.arrayContaining([
      { anomalies: { some: { status: 'OPEN', isBlocking: false } } },
      { anomalies: { none: { status: 'OPEN', isBlocking: true } } },
      { AND: [{ assigneeId: { not: null } }, { assigneeId: { not: 'a1' } }] },
    ]));
    expect(buildAdminListWhere(calls[2][0]).AND).toEqual(expect.arrayContaining([
      { anomalies: { some: { status: 'OPEN', isBlocking: true } } },
      { assigneeId: 'a1' },
    ]));
  });

  it('does not invent a campaign when campaignId is empty', async () => {
    await getAll();
    await getAll({ campaignId: '' });
    await getAll({ campaignId: '   ' });
    for (const call of service.listForAdmin.mock.calls) {
      expect(call[0].campaignId).toBeUndefined();
      expect(buildAdminListWhere(call[0], call[1]).AND.some((clause: { campaignId?: unknown }) => 'campaignId' in clause)).toBe(false);
    }
  });

  it('treats blank filters as absent', async () => {
    await getAll({
      status: '', limit: '', offset: '', region: '   ', search: '   ', formType: ' ',
      period: '', department: ' ', campaignId: '', quarterCode: '  ', late: '', overdue: '',
    });
    expect(service.listForAdmin.mock.calls[0][0]).toEqual({
      status: undefined, formType: undefined, period: undefined, region: undefined,
      department: undefined, search: undefined, companyId: undefined,
      campaignId: undefined, quarterCode: undefined, late: undefined, overdue: undefined,
      limit: 100, offset: 0,
    });
  });
});

describe('AdminQuestionnairesController.exportDossiers', () => {
  let service: { streamDossiersExport: jest.Mock };
  let controller: AdminQuestionnairesController;
  const req = { user: { id: 'a1', role: 'REGIONAL_ADMIN', region: 'Littoral' } };
  const res = {};

  beforeEach(() => {
    service = { streamDossiersExport: jest.fn(async () => undefined) };
    controller = new AdminQuestionnairesController(service as unknown as QuestionnairesService, {} as any);
  });

  it('exports exactly the rows the list filters select', async () => {
    await controller.exportDossiers(
      'xlsx', 'APPROVED', 'Centre', 'Moungo', 'mbarga', 'COOPERATIVE', '30d',
      'comp-1', 'campaign-1', '2026-T4', '1', 'true', undefined, req, res as any,
    );
    expect(service.streamDossiersExport).toHaveBeenCalledWith(
      {
        status: 'APPROVED', formType: 'COOPERATIVE', period: '30d', region: 'Centre',
        department: 'Moungo', search: 'mbarga', companyId: 'comp-1',
        campaignId: 'campaign-1', quarterCode: '2026-T4', late: true, overdue: true,
      },
      'xlsx',
      expect.objectContaining({ role: 'REGIONAL_ADMIN', region: 'Littoral' }),
      'a1',
      res,
      false,
    );
  });

  it('exports the same quality, assignment and campaign selection as the list', async () => {
    await controller.exportDossiers(
      'csv', undefined, 'Centre', undefined, undefined, undefined, undefined,
      undefined, 'campaign-9', undefined, undefined, undefined, undefined,
      req, res as any, undefined, undefined, 'warnings', 'other',
    );
    const exported = service.streamDossiersExport.mock.calls[0][0];
    expect(exported).toMatchObject({
      region: 'Centre', campaignId: 'campaign-9', quality: 'warnings', assignment: 'other', assigneeId: 'a1',
    });
    expect(buildAdminListWhere(exported)).toEqual(buildAdminListWhere({
      region: 'Centre', campaignId: 'campaign-9', quality: 'warnings', assignment: 'other', assigneeId: 'a1',
    }));
    expect(buildAdminListWhere(exported).AND).toEqual(expect.arrayContaining([
      { campaignId: 'campaign-9' },
      { anomalies: { some: { status: 'OPEN', isBlocking: false } } },
      { AND: [{ assigneeId: { not: null } }, { assigneeId: { not: 'a1' } }] },
    ]));
  });

  it('does not default an empty campaign on the export', async () => {
    await controller.exportDossiers(
      'csv', undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, '', undefined, undefined, undefined, undefined,
      req, res as any,
    );
    const exported = service.streamDossiersExport.mock.calls[0][0];
    expect(exported.campaignId).toBeUndefined();
    expect(buildAdminListWhere(exported).AND.some((clause) => 'campaignId' in clause)).toBe(false);
  });

  it('refuses an unknown quality on export rather than streaming a wider file', async () => {
    await expect(
      controller.exportDossiers(
        'csv', undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, undefined,
        req, res as any, undefined, undefined, 'dirty',
      ),
    ).rejects.toThrow('Qualité inconnue.');
    expect(service.streamDossiersExport).not.toHaveBeenCalled();
  });

  it('refuses an invalid filter rather than streaming a wider export', async () => {
    await expect(
      controller.exportDossiers('csv', 'APPROVED', undefined, undefined, undefined, undefined, 'all', undefined, undefined, undefined, undefined, undefined, undefined, req, res as any),
    ).rejects.toThrow('Période inconnue.');
    expect(service.streamDossiersExport).not.toHaveBeenCalled();
  });
});

describe('QuestionnairesService.listForAdmin', () => {
  let prisma: any;
  let service: QuestionnairesService;
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));

  beforeEach(() => {
    prisma = {
      onefopSubmission: {
        findMany: jest.fn(async ({ take }: any) => rows(Math.min(take, 250))),
        count: jest.fn(async () => 250),
      },
    };
    service = new QuestionnairesService(prisma);
  });

  it('returns one page and the total of the full filtered query — no silent 100-row cap', async () => {
    const result = await service.listForAdmin({ status: 'PENDING_REVIEW', limit: 10, offset: 0 });
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(250);
    const [{ where, take, skip, orderBy }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect({ take, skip }).toEqual({ take: 10, skip: 0 });
    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    // total counts the SAME where clause as the page, not the table.
    expect(prisma.onefopSubmission.count).toHaveBeenCalledWith({ where });
  });

  it('sorts oldest first on request, with the same id tie-break', async () => {
    await service.listForAdmin({ status: 'PENDING_REVIEW', limit: 10, offset: 0, sort: 'oldest' });
    await service.listForAdmin({ limit: 10, offset: 0, sort: 'newest' });
    expect(prisma.onefopSubmission.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(prisma.onefopSubmission.findMany.mock.calls[1][0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('applies limit/offset without a status too', async () => {
    await service.listForAdmin({ limit: 10, offset: 20 });
    const [{ take, skip }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect({ take, skip }).toEqual({ take: 10, skip: 20 });
  });

  it('builds its where with the shared builder (the one exports will use)', async () => {
    const filters = { status: 'APPROVED', formType: 'ONG', region: 'Centre', search: 'x', limit: 10, offset: 0 };
    const territory = { role: 'REGIONAL_ADMIN', region: 'Littoral' };
    await service.listForAdmin(filters, territory);
    const [{ where }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(where).toEqual(buildAdminListWhere(filters, territory));
  });
});
