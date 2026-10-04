import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ONEFOP_STAFF_ROLES, assertCanApproveRegistration, assertCanManageRole, manageableRolesFor } from './staff-scope';
import { buildUserListWhere } from './user-list-filter';

describe('staff administration scope', () => {
  it('leaves SUPER_ADMIN unrestricted, limits SUPER_ADMIN_ONEFOP, and grants nothing to anyone else', () => {
    expect(manageableRolesFor('SUPER_ADMIN')).toBeNull();
    expect(manageableRolesFor('ADMIN_ONEFOP')).toEqual(ONEFOP_STAFF_ROLES);
    expect(manageableRolesFor('REGIONAL_ADMIN')).toEqual([]);
    expect(manageableRolesFor(undefined)).toEqual([]);
  });

  it('never lets the ONEFOP administrator reach an administrator or company account', () => {
    for (const target of ['SUPER_ADMIN', 'ADMIN_ONEFOP', 'COMPANY']) {
      expect(() => assertCanManageRole('ADMIN_ONEFOP', target)).toThrow(ForbiddenException);
    }
    for (const target of ONEFOP_STAFF_ROLES) {
      expect(() => assertCanManageRole('ADMIN_ONEFOP', target)).not.toThrow();
    }
    expect(() => assertCanManageRole('SUPER_ADMIN', 'SUPER_ADMIN')).not.toThrow();
  });

  describe('user list ceiling', () => {
    const ceiling = manageableRolesFor('ADMIN_ONEFOP');

    it('shows only ONEFOP staff to the ONEFOP administrator by default', () => {
      expect(buildUserListWhere({ allowedRoles: ceiling }).role).toEqual({ in: [...ONEFOP_STAFF_ROLES] });
    });

    it('intersects requested roles with the ceiling instead of widening it', () => {
      expect(buildUserListWhere({ roles: 'REGIONAL_ADMIN,SUPER_ADMIN', allowedRoles: ceiling }).role).toEqual({ in: ['REGIONAL_ADMIN'] });
      expect(buildUserListWhere({ role: 'SUPER_ADMIN', allowedRoles: ceiling }).role).toEqual({ in: [] });
    });

    it('shows nothing when the scope is empty, and everything but companies when unrestricted', () => {
      expect(buildUserListWhere({ allowedRoles: [] }).role).toEqual({ in: [] });
      expect(buildUserListWhere({ allowedRoles: null }).role).toEqual({ not: 'COMPANY' });
    });
  });
});

describe('AuthService user management enforces the scope server-side', () => {
  const accounts: Record<string, { id: string; role: string; status: string; region?: string | null; department?: string | null; passwordHash?: string; passwordResetTokenHash?: string }> = {
    regional: { id: 'regional', role: 'REGIONAL_ADMIN', status: 'PENDING_APPROVAL', region: 'Littoral', department: 'Wouri', passwordHash: '$2b$10$secret', passwordResetTokenHash: 'reset-secret' },
    regionOnly: { id: 'regionOnly', role: 'REGIONAL_ADMIN', status: 'ACTIVE', region: 'Littoral', department: null },
    departmentOnly: { id: 'departmentOnly', role: 'ADMIN_ONEFOP', status: 'ACTIVE', region: null, department: 'Wouri' },
    noTerritory: { id: 'noTerritory', role: 'ADMIN_ONEFOP', status: 'ACTIVE', region: null, department: null },
    blankRegion: { id: 'blankRegion', role: 'ADMIN_ONEFOP', status: 'ACTIVE', region: '', department: null },
    dsmoAdmin: { id: 'dsmoAdmin', role: 'SUPER_ADMIN', status: 'ACTIVE' },
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
      auditLog: { create: jest.fn(async () => ({})) },
    };
    service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
  });

  it('lets the ONEFOP administrator manage an ONEFOP staff account', async () => {
    await expect(service.approveUser('regional', 'me', 'ADMIN_ONEFOP')).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(service.setUserActive('regional', false, 'me', 'ADMIN_ONEFOP')).resolves.toMatchObject({ isActive: false });
    await expect(service.updateUserRole('regional', 'DIVISIONAL_ADMIN', 'me', 'ADMIN_ONEFOP')).resolves.toMatchObject({ role: 'DIVISIONAL_ADMIN' });
  });

  it('refuses promotion to DIVISIONAL without a region and a department, before any write', async () => {
    for (const id of ['regionOnly', 'departmentOnly']) {
      await expect(service.updateUserRole(id, 'DIVISIONAL_ADMIN', 'me', 'SUPER_ADMIN')).rejects.toThrow(
        'Les utilisateurs divisionnaires doivent avoir une région et un département assignés',
      );
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses promotion to REGIONAL without a region, before any write', async () => {
    for (const id of ['noTerritory', 'blankRegion', 'departmentOnly']) {
      await expect(service.updateUserRole(id, 'REGIONAL_ADMIN', 'me', 'SUPER_ADMIN')).rejects.toThrow(
        'Les utilisateurs régionaux doivent avoir une région assignée',
      );
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows promotion to REGIONAL when the account has a region', async () => {
    await expect(service.updateUserRole('regionOnly', 'REGIONAL_ADMIN', 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ role: 'REGIONAL_ADMIN' });
  });

  it('never returns password or token hashes from admin user mutations', async () => {
    const results = [
      await service.approveUser('regional', 'me', 'SUPER_ADMIN'),
      await service.rejectUser('regional', 'me', 'SUPER_ADMIN', undefined, 'motif'),
      await service.updateUserRole('regional', 'DIVISIONAL_ADMIN', 'me', 'SUPER_ADMIN'),
      await service.setUserActive('regional', false, 'me', 'SUPER_ADMIN'),
    ];
    for (const result of results) {
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('passwordResetTokenHash');
      expect(result).toMatchObject({ id: 'regional' });
    }
  });

  it('refuses every action on an out-of-scope account, before any write', async () => {
    await expect(service.approveUser('dsmoAdmin', 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.rejectUser('dsmoAdmin', 'me', 'ADMIN_ONEFOP', undefined, 'motif')).rejects.toThrow(ForbiddenException);
    await expect(service.setUserActive('dsmoAdmin', false, 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.deleteUser('dsmoAdmin', 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserRole('dsmoAdmin', 'REGIONAL_ADMIN', 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses to let the ONEFOP administrator grant an administrator role', async () => {
    await expect(service.updateUserRole('regional', 'SUPER_ADMIN', 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserRole('regional', 'ADMIN_ONEFOP', 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps SUPER_ADMIN unrestricted', async () => {
    await expect(service.setUserActive('dsmoAdmin', false, 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ isActive: false });
    await expect(service.updateUserRole('regional', 'ADMIN_ONEFOP', 'me', 'SUPER_ADMIN')).resolves.toMatchObject({ role: 'ADMIN_ONEFOP' });
  });

  it('lists only in-scope roles for the ONEFOP administrator', async () => {
    await service.listUsers({ roles: 'REGIONAL_ADMIN,SUPER_ADMIN' }, 'ADMIN_ONEFOP');
    expect(prisma.user.findMany.mock.calls[0][0].where.role).toEqual({ in: ['REGIONAL_ADMIN'] });
  });
});

describe('assertCanApproveRegistration (D3)', () => {
  const regional = { role: 'REGIONAL_ADMIN', region: 'Littoral' };
  const divisional = { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' };

  it('lets REGIONAL approve ONEFOP staff in its region (names match case-insensitively)', () => {
    expect(() => assertCanApproveRegistration(regional, { role: 'DIVISIONAL_ADMIN', region: 'LITTORAL', department: 'Nkam' })).not.toThrow();
  });

  it('refuses REGIONAL outside its region', () => {
    expect(() => assertCanApproveRegistration(regional, { role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' })).toThrow(ForbiddenException);
  });

  it('fails closed when the target has no region', () => {
    expect(() => assertCanApproveRegistration(regional, { role: 'DIVISIONAL_ADMIN', region: null })).toThrow(ForbiddenException);
    expect(() => assertCanApproveRegistration(regional, { role: 'DIVISIONAL_ADMIN', region: '' })).toThrow(ForbiddenException);
  });

  it('lets DIVISIONAL approve in its region and department', () => {
    expect(() => assertCanApproveRegistration(divisional, { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'wouri' })).not.toThrow();
  });

  it('refuses DIVISIONAL in another department, even in its region', () => {
    expect(() => assertCanApproveRegistration(divisional, { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Nkam' })).toThrow(ForbiddenException);
  });

  it('refuses DIVISIONAL when the actor has no territory (fail closed)', () => {
    expect(() => assertCanApproveRegistration({ role: 'DIVISIONAL_ADMIN' }, { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' })).toThrow(ForbiddenException);
  });

  it('never lets REGIONAL/DIVISIONAL reach administrator or company accounts, even in territory', () => {
    for (const target of ['SUPER_ADMIN', 'ADMIN_ONEFOP', 'COMPANY']) {
      expect(() => assertCanApproveRegistration(regional, { role: target, region: 'Littoral' })).toThrow(ForbiddenException);
      expect(() => assertCanApproveRegistration(divisional, { role: target, region: 'Littoral', department: 'Wouri' })).toThrow(ForbiddenException);
    }
  });

  it('refuses SUPER_ADMIN_ONEFOP on a non-ONEFOP target and allows ONEFOP staff anywhere', () => {
    for (const target of ['SUPER_ADMIN', 'SUPER_ADMIN', 'COMPANY']) {
      expect(() => assertCanApproveRegistration({ role: 'ADMIN_ONEFOP' }, { role: target })).toThrow(ForbiddenException);
    }
    expect(() => assertCanApproveRegistration({ role: 'ADMIN_ONEFOP' }, { role: 'REGIONAL_ADMIN', region: null })).not.toThrow();
  });

  it('lets SUPER_ADMIN approve anything', () => {
    for (const target of ['SUPER_ADMIN', 'COMPANY', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP']) {
      expect(() => assertCanApproveRegistration({ role: 'SUPER_ADMIN' }, { role: target })).not.toThrow();
    }
  });

  // The national roles are covered by the two tests above: ADMIN_ONEFOP
  // approves ONEFOP staff through assertCanManageRole and SUPER_ADMIN
  // approves anything. What is left are the roles manageableRolesFor gives
  // an empty scope to — they can approve nobody, anywhere.
  it('refuses the roles with no management scope at all', () => {
    for (const role of ['AUDITOR', 'COMPANY', undefined]) {
      expect(() => assertCanApproveRegistration({ role }, { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' })).toThrow(ForbiddenException);
    }
  });
});

describe('AuthService — D1 SUPER_ADMIN_ONEFOP create and reassign', () => {
  const accounts: Record<string, any> = {
    pendingWouri: { id: 'pendingWouri', role: 'DIVISIONAL_ADMIN', status: 'PENDING_APPROVAL', region: 'Littoral', department: 'Wouri' },
    activeWouri: { id: 'activeWouri', role: 'DIVISIONAL_ADMIN', status: 'ACTIVE', region: 'Littoral', department: 'Wouri' },
    pendingCentre: { id: 'pendingCentre', role: 'DIVISIONAL_ADMIN', status: 'PENDING_APPROVAL', region: 'Centre', department: 'Mfoundi' },
    dsmoAdmin: { id: 'dsmoAdmin', role: 'SUPER_ADMIN', status: 'ACTIVE', region: null, department: null },
  };
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    const mockRegions = [
      { id: 'reg-centre', name: 'Centre' },
      { id: 'reg-littoral', name: 'Littoral' },
    ];
    const mockDepartments = [
      { id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral', region: { id: 'reg-littoral', name: 'Littoral' } },
      { id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre', region: { id: 'reg-centre', name: 'Centre' } },
    ];

    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => (where.id ? accounts[where.id] ?? null : null)),
        update: jest.fn(async ({ where, data }: any) => ({ ...accounts[where.id], ...data })),
        create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
      },
      region: {
        findMany: jest.fn(async () => mockRegions),
      },
      department: {
        findMany: jest.fn(async ({ where }: any) =>
          mockDepartments.filter(d => !where?.regionId || d.regionId === where.regionId),
        ),
        findFirst: jest.fn(async () => null),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
  });

  it('ADMIN_ONEFOP creates ONEFOP field staff but cannot create its own rank', async () => {
    const field = { email: 'a@b.cm', firstName: 'A', lastName: 'B', role: 'REGIONAL_ADMIN', region: 'Littoral' };
    await expect(service.adminCreateMinefopUser(field, 'ADMIN_ONEFOP')).resolves.toMatchObject({ user: { role: 'REGIONAL_ADMIN' } });
    await expect(service.adminCreateMinefopUser(field, 'SUPER_ADMIN')).resolves.toMatchObject({ user: { role: 'REGIONAL_ADMIN' } });

    // MINEFOP_FIELD_ROLES is the first gate and holds only the two field
    // roles, so ADMIN_ONEFOP is refused as a *target* whoever the actor is —
    // the self-escalation the eleven-value model prevented by keeping the
    // manager outside the managed set. A 400, not a 403: the role is not
    // creatable through this route at all.
    prisma.user.create.mockClear();
    const ownRank = { ...field, role: 'ADMIN_ONEFOP' };
    await expect(service.adminCreateMinefopUser(ownRank, 'ADMIN_ONEFOP')).rejects.toThrow(BadRequestException);
    await expect(service.adminCreateMinefopUser(ownRank, 'SUPER_ADMIN')).rejects.toThrow(BadRequestException);

    // And the roles with no management scope are refused before any write.
    for (const actor of ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'AUDITOR', 'COMPANY']) {
      await expect(service.adminCreateMinefopUser(field, actor)).rejects.toThrow(ForbiddenException);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN_ONEFOP cannot reassign an administrator (existing assertCanManageRole in updateUserTerritory)', async () => {
    await expect(service.updateUserTerritory('dsmoAdmin', 'REGIONAL_ADMIN', 'Littoral', null, 'me', 'ADMIN_ONEFOP')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserTerritory('pendingWouri', 'SUPER_ADMIN', null, null, 'me', 'ADMIN_ONEFOP')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN_ONEFOP reassigns ONEFOP staff with canonical territory names', async () => {
    await expect(service.updateUserTerritory('activeWouri', 'REGIONAL_ADMIN', 'centre', null, 'me', 'ADMIN_ONEFOP')).resolves.toMatchObject({ role: 'REGIONAL_ADMIN', region: 'Centre' });
  });

  it('rejects staff territory reassignment with hierarchy mismatch', async () => {
    await expect(
      service.updateUserTerritory('activeWouri', 'DIVISIONAL_ADMIN', 'Centre', 'Wouri', 'me', 'ADMIN_ONEFOP'),
    ).rejects.toThrow("Département inconnu : 'Wouri'");
  });

  it('validates territory on adminCreateMinefopUser and stores canonical names', async () => {
    const dto = { email: 'div@minefop.cm', firstName: 'Div', lastName: 'Agent', role: 'DIVISIONAL_ADMIN', region: 'littoral', department: 'wouri' };
    const res = await service.adminCreateMinefopUser(dto, 'ADMIN_ONEFOP');
    expect(res.user).toMatchObject({
      role: 'DIVISIONAL_ADMIN',
      region: 'Littoral',
      department: 'Wouri',
    });
  });
});

describe('AuthService — D3 registration review by DR roles', () => {
  const accounts: Record<string, any> = {
    pendingWouri: { id: 'pendingWouri', role: 'DIVISIONAL_ADMIN', status: 'PENDING_APPROVAL', region: 'Littoral', department: 'Wouri' },
    activeWouri: { id: 'activeWouri', role: 'DIVISIONAL_ADMIN', status: 'ACTIVE', region: 'Littoral', department: 'Wouri' },
    pendingCentre: { id: 'pendingCentre', role: 'DIVISIONAL_ADMIN', status: 'PENDING_APPROVAL', region: 'Centre', department: 'Mfoundi' },
    dsmoAdmin: { id: 'dsmoAdmin', role: 'SUPER_ADMIN', status: 'ACTIVE', region: null, department: null },
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

  it('REGIONAL approves a pending registration in its region', async () => {
    await expect(service.approveUser('pendingWouri', 'me', 'REGIONAL_ADMIN', { region: 'Littoral' })).resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('REGIONAL cannot approve or reject outside its region, before any write', async () => {
    await expect(service.approveUser('pendingCentre', 'me', 'REGIONAL_ADMIN', { region: 'Littoral' })).rejects.toThrow(ForbiddenException);
    await expect(service.rejectUser('pendingCentre', 'me', 'REGIONAL_ADMIN', { region: 'Littoral' }, 'motif')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('REGIONAL/DIVISIONAL without a territory on the request fail closed', async () => {
    await expect(service.approveUser('pendingWouri', 'me', 'REGIONAL_ADMIN')).rejects.toThrow(ForbiddenException);
    await expect(service.approveUser('pendingWouri', 'me', 'DIVISIONAL_ADMIN')).rejects.toThrow(ForbiddenException);
  });

  it('DIVISIONAL can reject a pending registration but not deactivate an active colleague', async () => {
    const actor = { region: 'Littoral', department: 'Wouri' };
    await expect(service.rejectUser('pendingWouri', 'me', 'DIVISIONAL_ADMIN', actor, 'motif')).resolves.toMatchObject({ status: 'REJECTED' });
    await expect(service.rejectUser('activeWouri', 'me', 'DIVISIONAL_ADMIN', actor, 'motif')).rejects.toThrow("Cet utilisateur n'est pas en attente d'approbation");
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});
