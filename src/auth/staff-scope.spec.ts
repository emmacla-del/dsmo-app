import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ONEFOP_STAFF_ROLES, assertCanManageRole, manageableRolesFor } from './staff-scope';
import { buildUserListWhere } from './user-list-filter';

describe('staff administration scope', () => {
  it('leaves SUPER_ADMIN unrestricted, limits SUPER_ADMIN_ONEFOP, and grants nothing to anyone else', () => {
    expect(manageableRolesFor('SUPER_ADMIN')).toBeNull();
    expect(manageableRolesFor('SUPER_ADMIN_ONEFOP')).toEqual(ONEFOP_STAFF_ROLES);
    expect(manageableRolesFor('SUPER_ADMIN_DSMO')).toEqual([]);
    expect(manageableRolesFor('REGIONAL')).toEqual([]);
    expect(manageableRolesFor(undefined)).toEqual([]);
  });

  it('never lets the ONEFOP administrator reach an administrator or company account', () => {
    for (const target of ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'SUPER_ADMIN_DSMO', 'COMPANY']) {
      expect(() => assertCanManageRole('SUPER_ADMIN_ONEFOP', target)).toThrow(ForbiddenException);
    }
    for (const target of ONEFOP_STAFF_ROLES) {
      expect(() => assertCanManageRole('SUPER_ADMIN_ONEFOP', target)).not.toThrow();
    }
    expect(() => assertCanManageRole('SUPER_ADMIN', 'SUPER_ADMIN_DSMO')).not.toThrow();
  });

  describe('user list ceiling', () => {
    const ceiling = manageableRolesFor('SUPER_ADMIN_ONEFOP');

    it('shows only ONEFOP staff to the ONEFOP administrator by default', () => {
      expect(buildUserListWhere({ allowedRoles: ceiling }).role).toEqual({ in: [...ONEFOP_STAFF_ROLES] });
    });

    it('intersects requested roles with the ceiling instead of widening it', () => {
      expect(buildUserListWhere({ roles: 'REGIONAL,SUPER_ADMIN', allowedRoles: ceiling }).role).toEqual({ in: ['REGIONAL'] });
      expect(buildUserListWhere({ role: 'SUPER_ADMIN_DSMO', allowedRoles: ceiling }).role).toEqual({ in: [] });
    });

    it('shows nothing when the scope is empty, and everything but companies when unrestricted', () => {
      expect(buildUserListWhere({ allowedRoles: [] }).role).toEqual({ in: [] });
      expect(buildUserListWhere({ allowedRoles: null }).role).toEqual({ not: 'COMPANY' });
    });
  });
});

describe('AuthService user management enforces the scope server-side', () => {
  const accounts: Record<string, { id: string; role: string; status: string; region?: string | null; department?: string | null; passwordHash?: string; passwordResetTokenHash?: string }> = {
    regional: { id: 'regional', role: 'REGIONAL', status: 'PENDING_APPROVAL', region: 'Littoral', department: 'Wouri', passwordHash: '$2b$10$secret', passwordResetTokenHash: 'reset-secret' },
    regionOnly: { id: 'regionOnly', role: 'REGIONAL', status: 'ACTIVE', region: 'Littoral', department: null },
    departmentOnly: { id: 'departmentOnly', role: 'CENTRAL', status: 'ACTIVE', region: null, department: 'Wouri' },
    noTerritory: { id: 'noTerritory', role: 'CENTRAL', status: 'ACTIVE', region: null, department: null },
    blankRegion: { id: 'blankRegion', role: 'CENTRAL', status: 'ACTIVE', region: '', department: null },
    dsmoAdmin: { id: 'dsmoAdmin', role: 'SUPER_ADMIN_DSMO', status: 'ACTIVE' },
  };
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => accounts[where.id] ?? null),
        update: jest.fn(async ({ where, data }: any) => ({ ...accounts[where.id], ...data })),
        delete: jest.fn(async () => ({})),
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => []),
      },
    };
    service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
  });

  it('lets the ONEFOP administrator manage an ONEFOP staff account', async () => {
    await expect(service.approveUser('regional', 'SUPER_ADMIN_ONEFOP')).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(service.setUserActive('regional', false, 'me', 'SUPER_ADMIN_ONEFOP')).resolves.toMatchObject({ isActive: false });
    await expect(service.updateUserRole('regional', 'DIVISIONAL', 'me', 'SUPER_ADMIN_ONEFOP')).resolves.toMatchObject({ role: 'DIVISIONAL' });
  });

  it('refuses promotion to DIVISIONAL without a region and a department, before any write', async () => {
    for (const id of ['regionOnly', 'departmentOnly']) {
      await expect(service.updateUserRole(id, 'DIVISIONAL', 'me', 'SUPER_ADMIN')).rejects.toThrow(
        'Les utilisateurs divisionnaires doivent avoir une région et un département assignés',
      );
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses promotion to REGIONAL without a region, before any write', async () => {
    for (const id of ['noTerritory', 'blankRegion', 'departmentOnly']) {
      await expect(service.updateUserRole(id, 'REGIONAL', 'me', 'SUPER_ADMIN')).rejects.toThrow(
        'Les utilisateurs régionaux doivent avoir une région assignée',
      );
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows promotion to REGIONAL when the account has a region', async () => {
    await expect(service.updateUserRole('regionOnly', 'REGIONAL', 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ role: 'REGIONAL' });
  });

  it('never returns password or token hashes from admin user mutations', async () => {
    const results = [
      await service.approveUser('regional', 'SUPER_ADMIN'),
      await service.rejectUser('regional', 'SUPER_ADMIN'),
      await service.updateUserRole('regional', 'DIVISIONAL', 'me', 'SUPER_ADMIN'),
      await service.setUserActive('regional', false, 'me', 'SUPER_ADMIN'),
    ];
    for (const result of results) {
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('passwordResetTokenHash');
      expect(result).toMatchObject({ id: 'regional' });
    }
  });

  it('refuses every action on an out-of-scope account, before any write', async () => {
    await expect(service.approveUser('dsmoAdmin', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.rejectUser('dsmoAdmin', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.setUserActive('dsmoAdmin', false, 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.deleteUser('dsmoAdmin', 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserRole('dsmoAdmin', 'REGIONAL', 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses to let the ONEFOP administrator grant an administrator role', async () => {
    await expect(service.updateUserRole('regional', 'SUPER_ADMIN', 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserRole('regional', 'SUPER_ADMIN_ONEFOP', 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps SUPER_ADMIN unrestricted', async () => {
    await expect(service.setUserActive('dsmoAdmin', false, 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ isActive: false });
    await expect(service.updateUserRole('regional', 'SUPER_ADMIN_ONEFOP', 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ role: 'SUPER_ADMIN_ONEFOP' });
  });

  it('lists only in-scope roles for the ONEFOP administrator', async () => {
    await service.listUsers({ roles: 'REGIONAL,SUPER_ADMIN' }, 'SUPER_ADMIN_ONEFOP');
    expect(prisma.user.findMany.mock.calls[0][0].where.role).toEqual({ in: ['REGIONAL'] });
  });
});

describe('AuthService — D1 SUPER_ADMIN_ONEFOP create and reassign', () => {
  const accounts: Record<string, any> = {
    pendingWouri: { id: 'pendingWouri', role: 'DIVISIONAL', status: 'PENDING_APPROVAL', region: 'Littoral', department: 'Wouri' },
    activeWouri: { id: 'activeWouri', role: 'DIVISIONAL', status: 'ACTIVE', region: 'Littoral', department: 'Wouri' },
    pendingCentre: { id: 'pendingCentre', role: 'DIVISIONAL', status: 'PENDING_APPROVAL', region: 'Centre', department: 'Mfoundi' },
    dsmoAdmin: { id: 'dsmoAdmin', role: 'SUPER_ADMIN_DSMO', status: 'ACTIVE', region: null, department: null },
  };
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => (where.id ? accounts[where.id] ?? null : null)),
        update: jest.fn(async ({ where, data }: any) => ({ ...accounts[where.id], ...data })),
        create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
  });

  it('SUPER_ADMIN_ONEFOP creates ONEFOP field staff; other roles are refused before any write', async () => {
    const dto = { email: 'a@b.cm', firstName: 'A', lastName: 'B', role: 'CENTRAL' };
    await expect(service.adminCreateMinefopUser(dto, 'SUPER_ADMIN_ONEFOP')).resolves.toMatchObject({ user: { role: 'CENTRAL' } });
    await expect(service.adminCreateMinefopUser(dto, 'SUPER_ADMIN')).resolves.toMatchObject({ user: { role: 'CENTRAL' } });
    prisma.user.create.mockClear();
    for (const actor of ['REGIONAL', 'SUPER_ADMIN_DSMO', 'CENTRAL']) {
      await expect(service.adminCreateMinefopUser(dto, actor)).rejects.toThrow(ForbiddenException);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN_ONEFOP cannot reassign an administrator (existing assertCanManageRole in updateUserTerritory)', async () => {
    await expect(service.updateUserTerritory('dsmoAdmin', 'REGIONAL', 'Littoral', null, 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserTerritory('pendingWouri', 'SUPER_ADMIN', null, null, 'me', 'SUPER_ADMIN_ONEFOP')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN_ONEFOP reassigns ONEFOP staff', async () => {
    await expect(service.updateUserTerritory('activeWouri', 'REGIONAL', 'Centre', null, 'me', 'SUPER_ADMIN_ONEFOP')).resolves.toMatchObject({ role: 'REGIONAL', region: 'Centre' });
  });
});
