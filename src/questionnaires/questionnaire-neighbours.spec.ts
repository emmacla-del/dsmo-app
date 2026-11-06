import { NotFoundException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';

const cursor = { id: 'current', submissionId: 'REF-current', submissionDate: new Date('2026-01-02T00:00:00Z') };
const row = (id: string) => ({ id, submissionId: `REF-${id}` });
const territory = { role: 'REGIONAL_ADMIN', region: 'Centre' };

function serviceWithCursor(value: typeof cursor | null) {
  const findFirst = jest.fn()
    .mockResolvedValueOnce(value)
    .mockResolvedValueOnce(row('previous'))
    .mockResolvedValueOnce(row('next'));
  // total, files before the cursor, cursor still in the list (in call order).
  const count = jest.fn()
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  const prisma = { onefopSubmission: { findFirst, count } } as any;
  return { service: new QuestionnairesService(prisma), findFirst, count };
}

describe('QuestionnairesService.getAdminQuestionnaireNeighbours', () => {
  it.each([
    ['newest', 'previous', 'gt', 'asc', 'next', 'lt', 'desc'],
    ['oldest', 'previous', 'lt', 'desc', 'next', 'gt', 'asc'],
  ] as const)('uses keyset order for %s sorting', async (sort, _previous, previousOp, previousOrder, _next, nextOp, nextOrder) => {
    const { service, findFirst } = serviceWithCursor(cursor);
    await expect(service.getAdminQuestionnaireNeighbours('current', { sort }, territory))
      .resolves.toEqual({ previous: row('previous'), next: row('next'), position: 2, total: 4 });
    expect(findFirst).toHaveBeenCalledTimes(3);
    expect(findFirst.mock.calls[1][0]).toMatchObject({
      where: { AND: expect.arrayContaining([{ OR: [
        { submissionDate: { [previousOp]: cursor.submissionDate } },
        { submissionDate: cursor.submissionDate, id: { [previousOp]: 'current' } },
      ] }]) },
      orderBy: [{ submissionDate: previousOrder }, { id: previousOrder }],
      select: { id: true, submissionId: true },
    });
    expect(findFirst.mock.calls[2][0]).toMatchObject({
      where: { AND: expect.arrayContaining([{ OR: [
        { submissionDate: { [nextOp]: cursor.submissionDate } },
        { submissionDate: cursor.submissionDate, id: { [nextOp]: 'current' } },
      ] }]) },
      orderBy: [{ submissionDate: nextOrder }, { id: nextOrder }],
    });
  });

  it('uses id as the tie-breaker and keeps a cursor that has left the filtered set', async () => {
    const { service, findFirst } = serviceWithCursor(cursor);
    await service.getAdminQuestionnaireNeighbours('current', { status: 'PENDING_REVIEW', assignment: 'me', assigneeId: 'another-agent' }, territory);
    expect(findFirst.mock.calls[0][0]).toMatchObject({ where: { AND: expect.arrayContaining([
      { id: 'current' },
      { region: { equals: 'Centre', mode: 'insensitive' } },
      { archivedAt: null },
    ]) } });
    const seekWhere = findFirst.mock.calls[2][0].where.AND;
    expect(seekWhere).toContainEqual({ status: 'PENDING_REVIEW' });
    expect(seekWhere).toContainEqual({ assigneeId: 'another-agent' });
    expect(seekWhere).toContainEqual({ OR: [
      { submissionDate: { lt: cursor.submissionDate } },
      { submissionDate: cursor.submissionDate, id: { lt: 'current' } },
    ] });
  });

  it('does not reveal a cursor outside the caller territory', async () => {
    const { service, findFirst } = serviceWithCursor(null);
    await expect(service.getAdminQuestionnaireNeighbours('foreign', {}, territory)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where.AND).toHaveLength(3);
  });

  it('uses effective active claims for assignment=me', async () => {
    const { service, findFirst } = serviceWithCursor(cursor);
    await service.getAdminQuestionnaireNeighbours('current', { assignment: 'me', assigneeId: 'agent-1' }, territory);
    const neighbourWhere = findFirst.mock.calls[2][0].where.AND;
    expect(neighbourWhere).toContainEqual({ status: { in: ['PENDING_REVIEW', 'CORRECTION_REQUESTED'] } });
    expect(neighbourWhere).toContainEqual({ OR: [
      { claimActivityAt: null },
      { claimActivityAt: { gt: expect.any(Date) } },
    ] });
    expect(neighbourWhere).toContainEqual({ assigneeId: 'agent-1' });
  });
});

describe('QuestionnairesService.getAdminQuestionnaireNeighbours position', () => {
  it('has no position when the file has left the filtered list', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce(cursor)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const count = jest.fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const service = new QuestionnairesService({ onefopSubmission: { findFirst, count } } as any);
    await expect(service.getAdminQuestionnaireNeighbours('current', {}, territory))
      .resolves.toEqual({ previous: null, next: null, position: null, total: 3 });
    expect(count.mock.calls[2][0].where.AND).toContainEqual({ id: 'current' });
  });
});

describe('QuestionnairesService.getAdminListFacets', () => {
  it('counts each option with the other filters kept and its own filter replaced', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const groupBy = jest.fn().mockResolvedValue([{ formType: 'ENTREPRISE', region: 'Centre', department: 'Mfoundi', _count: { _all: 2 } }]);
    const service = new QuestionnairesService({ onefopSubmission: { count, groupBy } } as any);
    // A national reader: a regional one has its region fixed by territoryWhere, whatever the facet.
    const facets = await service.getAdminListFacets({ quality: 'blocking', region: 'Centre' }, 'agent-1', { role: 'SUPER_ADMIN' });
    expect(facets.quality).toEqual({ clean: 2, warnings: 2, blocking: 2 });
    expect(facets.assignment).toEqual({ me: 2, unassigned: 2, other: 2 });
    expect(facets.formType).toEqual({ ENTREPRISE: 2 });
    // The region facet drops the region (and department) filter, keeps quality.
    const regionCall = groupBy.mock.calls.find((call) => call[0].by[0] === 'region')![0];
    expect(regionCall.where.AND).not.toContainEqual({ region: { equals: 'Centre', mode: 'insensitive' } });
    expect(JSON.stringify(regionCall.where.AND)).toContain('isBlocking');
  });

  it('answers 0 for « me » and « other » without a signed-in officer', async () => {
    const count = jest.fn().mockResolvedValue(5);
    const groupBy = jest.fn().mockResolvedValue([]);
    const service = new QuestionnairesService({ onefopSubmission: { count, groupBy } } as any);
    const facets = await service.getAdminListFacets({}, undefined, territory);
    expect(facets.assignment).toEqual({ me: 0, unassigned: 5, other: 0 });
  });
});
