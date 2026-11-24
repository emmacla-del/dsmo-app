import { UserStatus } from '@prisma/client';
import { DsmoService } from './dsmo.service';

function serviceWith(groups: Array<{ status: UserStatus; isActive: boolean; _count: { _all: number } }>) {
  const groupBy = jest.fn().mockResolvedValue(groups);
  const service = Object.create(DsmoService.prototype);
  service.prisma = { user: { groupBy } };
  return { service: service as DsmoService, groupBy };
}

const group = (status: UserStatus, isActive: boolean, count: number) => ({ status, isActive, _count: { _all: count } });

describe('DsmoService.getCompanyStats', () => {
  it('derives every figure from one query', async () => {
    const { service, groupBy } = serviceWith([
      group(UserStatus.ACTIVE, true, 18),
      group(UserStatus.ACTIVE, false, 2),
      group(UserStatus.PENDING_APPROVAL, false, 5),
      group(UserStatus.COMPLEMENTS_REQUESTED, true, 3),
      group(UserStatus.REJECTED, false, 1),
    ]);
    await expect(service.getCompanyStats()).resolves.toEqual({
      total: 29, active: 18, suspended: 2, pendingValidation: 8, rejected: 1,
    });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('leaves out archived accounts and keeps the territory', async () => {
    const { service, groupBy } = serviceWith([]);
    await service.getCompanyStats({ role: 'REGIONAL_ADMIN' } as any);
    const { where } = groupBy.mock.calls[0][0];
    expect(where.archivedAt).toBeNull();
    expect(where.company).toEqual({ is: { id: { in: [] } } });
  });

  it('includes archived account groups only when explicitly requested', async () => {
    const { service, groupBy } = serviceWith([]);
    await service.getCompanyStats(undefined, true);
    expect(groupBy.mock.calls[0][0].where.OR).toEqual([
      { archivedAt: null },
      { archivedAt: { not: null } },
    ]);
  });
});
