import { BadRequestException } from '@nestjs/common';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { buildAdminListWhere } from './admin-list-filter';

type ListArgs = {
  status?: string; limit?: string; offset?: string; region?: string;
  search?: string; formType?: string; period?: string;
};

describe('AdminQuestionnairesController.getAll — list params', () => {
  let service: { listForAdmin: jest.Mock };
  let controller: AdminQuestionnairesController;
  const req = { user: { id: 'a1', role: 'REGIONAL', region: 'Littoral' } };
  const getAll = (a: ListArgs = {}) =>
    controller.getAll(a.status, a.limit, a.offset, a.region, a.search, a.formType, a.period, req);

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
      formType: 'COOPERATIVE', period: '30d',
    });
    expect(service.listForAdmin).toHaveBeenCalledWith(
      { status: 'APPROVED', formType: 'COOPERATIVE', period: '30d', region: 'Centre', search: 'mbarga', limit: 10, offset: 30 },
      expect.objectContaining({ role: 'REGIONAL', region: 'Littoral' }),
    );
  });

  it('answers 400 with a French message for invalid paging, before querying', async () => {
    const invalid: ListArgs[] = [
      { limit: '0' }, { limit: '101' }, { limit: 'abc' }, { limit: '1.5' }, { limit: '-1' },
      { offset: '-5' }, { offset: 'x' },
    ];
    for (const args of invalid) {
      await expect(getAll(args)).rejects.toThrow(BadRequestException);
    }
    await expect(getAll({ limit: '0' })).rejects.toThrow('Le paramètre « limit » doit être un entier entre 1 et 100.');
    await expect(getAll({ offset: '-5' })).rejects.toThrow('Le paramètre « offset » doit être un entier positif ou nul.');
    expect(service.listForAdmin).not.toHaveBeenCalled();
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

  it('treats blank filters as absent', async () => {
    await getAll({ status: '', limit: '', offset: '', region: '   ', search: '   ', formType: ' ', period: '' });
    expect(service.listForAdmin.mock.calls[0][0]).toEqual({
      status: undefined, formType: undefined, period: undefined, region: undefined, search: undefined, limit: 100, offset: 0,
    });
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

  it('applies limit/offset without a status too', async () => {
    await service.listForAdmin({ limit: 10, offset: 20 });
    const [{ take, skip }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect({ take, skip }).toEqual({ take: 10, skip: 20 });
  });

  it('builds its where with the shared builder (the one exports will use)', async () => {
    const filters = { status: 'APPROVED', formType: 'ONG', region: 'Centre', search: 'x', limit: 10, offset: 0 };
    const territory = { role: 'REGIONAL', region: 'Littoral' };
    await service.listForAdmin(filters, territory);
    const [{ where }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(where).toEqual(buildAdminListWhere(filters, territory));
  });
});
