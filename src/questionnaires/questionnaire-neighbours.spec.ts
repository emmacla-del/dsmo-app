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
  const prisma = { onefopSubmission: { findFirst } } as any;
  return { service: new QuestionnairesService(prisma), findFirst };
}

describe('QuestionnairesService.getAdminQuestionnaireNeighbours', () => {
  it.each([
    ['newest', 'previous', 'gt', 'asc', 'next', 'lt', 'desc'],
    ['oldest', 'previous', 'lt', 'desc', 'next', 'gt', 'asc'],
  ] as const)('uses keyset order for %s sorting', async (sort, _previous, previousOp, previousOrder, _next, nextOp, nextOrder) => {
    const { service, findFirst } = serviceWithCursor(cursor);
    await expect(service.getAdminQuestionnaireNeighbours('current', { sort }, territory))
      .resolves.toEqual({ previous: row('previous'), next: row('next') });
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
