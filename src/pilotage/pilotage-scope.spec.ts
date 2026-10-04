import { resolveTargetScope } from './pilotage-scope';
import { Territory } from '../auth/territory';

function prismaFor(regions: Array<{ id: string; name: string }>, departments: Array<{ id: string; name: string; regionId: string }>) {
  return {
    region: {
      findMany: jest.fn(async () => regions),
    },
    department: {
      findMany: jest.fn(async (args?: { where?: { regionId?: string } }) =>
        departments.filter((department) => !args?.where?.regionId || department.regionId === args.where.regionId),
      ),
      findUnique: jest.fn(async (args: { where: { id: string } }) =>
        departments.find((department) => department.id === args.where.id) ?? null,
      ),
    },
  };
}

const regions = [
  { id: 'r-centre', name: 'Centre' },
  { id: 'r-extreme', name: 'Extrême-Nord' },
];
const departments = [
  { id: 'd-mfoundi', name: 'Mfoundi', regionId: 'r-centre' },
  { id: 'd-lekie', name: 'Lékié', regionId: 'r-centre' },
];

describe('resolveTargetScope', () => {
  it('gives national roles the whole country, including a stray region', async () => {
    const prisma = prismaFor(regions, departments);
    for (const role of ['SUPER_ADMIN', 'ADMIN_ONEFOP']) {
      await expect(resolveTargetScope(prisma as any, { role, region: 'Littoral', regionId: 'r-other' }))
        .resolves.toEqual({ kind: 'national' });
    }
    expect(prisma.region.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when there is no actor, and for roles outside the territorial set', async () => {
    const prisma = prismaFor(regions, departments);
    await expect(resolveTargetScope(prisma as any, undefined)).resolves.toEqual({ kind: 'none' });
    await expect(resolveTargetScope(prisma as any, null)).resolves.toEqual({ kind: 'none' });
    for (const role of ['AUDITOR', 'COMPANY']) {
      await expect(resolveTargetScope(prisma as any, { role, region: 'Centre' })).resolves.toEqual({ kind: 'none' });
    }
    expect(prisma.region.findMany).not.toHaveBeenCalled();
  });

  it('resolves a regional account by case-insensitive name, and by regionId when one is present', async () => {
    const prisma = prismaFor(regions, departments);
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN', region: 'CENTRE' }))
      .resolves.toEqual({ kind: 'region', regionId: 'r-centre' });
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN', region: 'Centre', regionId: 'r-extreme' }))
      .resolves.toEqual({ kind: 'region', regionId: 'r-extreme' });
  });

  it('fails closed for a regional account with no region, an unknown name, or a name that only matches without accents', async () => {
    const prisma = prismaFor(regions, departments);
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN' })).resolves.toEqual({ kind: 'none' });
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN', region: 'Atlantis' })).resolves.toEqual({ kind: 'none' });
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN', region: 'Extreme-Nord' })).resolves.toEqual({ kind: 'none' });
  });

  it('fails closed when two regions share the same case-insensitive name', async () => {
    const prisma = prismaFor([{ id: 'a', name: 'Centre' }, { id: 'b', name: 'centre' }], []);
    await expect(resolveTargetScope(prisma as any, { role: 'REGIONAL_ADMIN', region: 'Centre' })).resolves.toEqual({ kind: 'none' });
  });

  it('resolves a divisional account by region and department names, or by departmentId', async () => {
    const prisma = prismaFor(regions, departments);
    await expect(resolveTargetScope(prisma as any, { role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'mfoundi' }))
      .resolves.toEqual({ kind: 'department', regionId: 'r-centre', departmentId: 'd-mfoundi' });
    await expect(resolveTargetScope(prisma as any, { role: 'DIVISIONAL_ADMIN', departmentId: 'd-lekie' }))
      .resolves.toEqual({ kind: 'department', regionId: 'r-centre', departmentId: 'd-lekie' });
  });

  it('fails closed for a divisional account missing its region or its department', async () => {
    const prisma = prismaFor(regions, departments);
    const cases: Territory[] = [
      { role: 'DIVISIONAL_ADMIN' },
      { role: 'DIVISIONAL_ADMIN', region: 'Centre' },
      { role: 'DIVISIONAL_ADMIN', department: 'Mfoundi' },
      { role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Wouri' },
      { role: 'DIVISIONAL_ADMIN', departmentId: 'missing' },
    ];
    for (const territory of cases) {
      await expect(resolveTargetScope(prisma as any, territory)).resolves.toEqual({ kind: 'none' });
    }
  });
});
