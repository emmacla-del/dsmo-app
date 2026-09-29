import { BadRequestException } from '@nestjs/common';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';

describe('AdminQuestionnairesController.getAll — list params', () => {
  let service: { listForAdmin: jest.Mock };
  let controller: AdminQuestionnairesController;
  const req = { user: { id: 'a1', role: 'REGIONAL', region: 'Littoral' } };

  beforeEach(() => {
    service = { listForAdmin: jest.fn(async () => ({ items: [], total: 0 })) };
    controller = new AdminQuestionnairesController(service as unknown as QuestionnairesService, {} as any);
  });

  it('applies limit 100 and offset 0 by default, with or without a status', async () => {
    await controller.getAll(undefined, undefined, undefined, undefined, undefined, req);
    await controller.getAll('PENDING_REVIEW', undefined, undefined, undefined, undefined, req);
    expect(service.listForAdmin.mock.calls[0][0]).toMatchObject({ status: undefined, limit: 100, offset: 0 });
    expect(service.listForAdmin.mock.calls[1][0]).toMatchObject({ status: 'PENDING_REVIEW', limit: 100, offset: 0 });
  });

  it('parses string query params into integers and trims text filters', async () => {
    await controller.getAll('APPROVED', '10', '30', ' Centre ', ' mbarga ', req);
    expect(service.listForAdmin).toHaveBeenCalledWith(
      { status: 'APPROVED', region: 'Centre', search: 'mbarga', limit: 10, offset: 30 },
      expect.objectContaining({ role: 'REGIONAL', region: 'Littoral' }),
    );
  });

  it('answers 400 with a French message for invalid paging, before querying', async () => {
    const invalid: Array<[string | undefined, string | undefined]> = [
      ['0', undefined], ['101', undefined], ['abc', undefined], ['1.5', undefined], ['-1', undefined],
      [undefined, '-5'], [undefined, 'x'],
    ];
    for (const [limit, offset] of invalid) {
      await expect(controller.getAll(undefined, limit, offset, undefined, undefined, req)).rejects.toThrow(BadRequestException);
    }
    await expect(controller.getAll(undefined, '0', undefined, undefined, undefined, req)).rejects.toThrow(
      'Le paramètre « limit » doit être un entier entre 1 et 100.',
    );
    await expect(controller.getAll(undefined, undefined, '-5', undefined, undefined, req)).rejects.toThrow(
      'Le paramètre « offset » doit être un entier positif ou nul.',
    );
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('rejects an unknown status with 400 instead of a Prisma 500', async () => {
    await expect(controller.getAll('NOT_A_STATUS', undefined, undefined, undefined, undefined, req)).rejects.toThrow(
      'Statut de dossier inconnu.',
    );
    expect(service.listForAdmin).not.toHaveBeenCalled();
  });

  it('treats blank filters as absent', async () => {
    await controller.getAll('', '', '', '   ', '   ', req);
    expect(service.listForAdmin.mock.calls[0][0]).toEqual({
      status: undefined, region: undefined, search: undefined, limit: 100, offset: 0,
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
    const [{ where, take, skip }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect({ take, skip }).toEqual({ take: 10, skip: 20 });
    expect(where).toEqual({ AND: [{}] });
  });

  it('combines territory, status, region and search with AND', async () => {
    await service.listForAdmin(
      { status: 'APPROVED', region: 'Centre', search: 'sodecoton', limit: 10, offset: 0 },
      { role: 'REGIONAL', region: 'Littoral' },
    );
    const [{ where }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(where.AND[0]).toEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
    expect(where.AND[1]).toEqual({ status: 'APPROVED' });
    expect(where.AND[2]).toEqual({ region: { equals: 'Centre', mode: 'insensitive' } });
    expect(where.AND[3].OR).toEqual(
      expect.arrayContaining([
        { submissionId: { contains: 'sodecoton', mode: 'insensitive' } },
        { respondent: { respondentName: { contains: 'sodecoton', mode: 'insensitive' } } },
        { enterpriseDetail: { companyName: { contains: 'sodecoton', mode: 'insensitive' } } },
      ]),
    );
    expect(prisma.onefopSubmission.count).toHaveBeenCalledWith({ where });
  });

  it('never lets a region filter replace the caller territory (scope escape)', async () => {
    // A REGIONAL Littoral agent asking for region=Centre must get Littoral AND
    // Centre (i.e. nothing), not Centre's dossiers.
    await service.listForAdmin({ region: 'Centre', limit: 10, offset: 0 }, { role: 'REGIONAL', region: 'Littoral' });
    const [{ where }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(where).not.toHaveProperty('region');
    expect(where.AND).toContainEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
  });

  it('fails closed for an unassigned territorial account, whatever the filters', async () => {
    await service.listForAdmin({ region: 'Centre', limit: 10, offset: 0 }, { role: 'REGIONAL' });
    const [{ where }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(where.AND[0]).toEqual({ id: { in: [] } });
  });
});
