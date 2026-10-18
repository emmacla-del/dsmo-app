import { QuestionnairesService } from './questionnaires.service';

// B11 (E2E 2026-10-17): the admin questionnaires page shows seven totals and
// asked for them with limit=1, so each query returned a whole declaration —
// rawData and every detail relation — to read `total`. limit=0 is the
// count-only request: the row query is not made at all.
describe('QuestionnairesService.listForAdmin — count-only requests', () => {
  function serviceWith(prisma: any): QuestionnairesService {
    const service = Object.create(QuestionnairesService.prototype) as QuestionnairesService;
    (service as any).prisma = prisma;
    return service;
  }

  const prismaWith = () => {
    const findMany = jest.fn(async (_args?: Record<string, unknown>) => [] as unknown[]);
    const count = jest.fn(async (_args?: Record<string, unknown>) => 42);
    return { prisma: { onefopSubmission: { findMany, count } }, findMany, count };
  };

  it('limit 0 answers the count without reading a single row', async () => {
    const { prisma, findMany, count } = prismaWith();
    const result = await serviceWith(prisma).listForAdmin({ limit: 0, offset: 0 } as any);

    expect(findMany).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [], total: 42 });
  });

  it('any other limit still reads the rows', async () => {
    const { prisma, findMany } = prismaWith();
    await serviceWith(prisma).listForAdmin({ limit: 1, offset: 0 } as any);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1, skip: 0 }));
  });
});
