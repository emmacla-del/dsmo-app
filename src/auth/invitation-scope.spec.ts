import { AuthService } from './auth.service';

// The staff listing reports the scope of the group link an account came
// through, so the approval screen can weigh it against the territory the
// officer chose for themselves (CLAUDE.md §21, 2026-10-25). Read from the
// sign-up's audit row, so no column was added to User.

describe('listUsers reports the invitation link scope', () => {
  const link = {
    id: 'link-centre',
    label: 'DREFOP Centre — cadres',
    level: 'regional',
    region: 'Centre',
    department: null,
  };

  function harness(users: any[], auditRows: any[] = [], links: any[] = [link]) {
    const prisma: any = {
      user: {
        count: jest.fn(async () => users.length),
        findMany: jest.fn(async () => users),
      },
      auditLog: { findMany: jest.fn(async () => auditRows) },
      staffInvitationLink: { findMany: jest.fn(async () => links) },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any) };
  }

  const officer = (over: any = {}) => ({
    id: 'u1',
    role: 'REGIONAL_ADMIN',
    region: 'Centre',
    department: null,
    registrationMethod: 'INVITATION_LINK',
    ...over,
  });

  it("names the link's scope on an account that came through one", async () => {
    const { service } = harness([officer()], [{ userId: 'u1', resourceId: 'link-centre' }]);
    const result = await service.listUsers({}, 'SUPER_ADMIN');
    expect(result.users[0].invitationScope).toEqual({
      label: 'DREFOP Centre — cadres',
      level: 'regional',
      region: 'Centre',
      department: null,
    });
  });

  it('reports the scope unchanged when the officer chose another region', async () => {
    // The choice stands -- the server does not refuse it (owner's decision).
    // The listing simply states both, and the screen flags the difference.
    const { service } = harness(
      [officer({ region: 'Littoral' })],
      [{ userId: 'u1', resourceId: 'link-centre' }],
    );
    const result = await service.listUsers({}, 'SUPER_ADMIN');
    expect(result.users[0].region).toBe('Littoral');
    expect(result.users[0].invitationScope).toMatchObject({ region: 'Centre' });
  });

  it('asks for nothing when no listed account came through a link', async () => {
    const { prisma, service } = harness([officer({ registrationMethod: 'SELF' })]);
    const result = await service.listUsers({}, 'SUPER_ADMIN');
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.staffInvitationLink.findMany).not.toHaveBeenCalled();
    expect(result.users[0].invitationScope).toBeNull();
  });

  it('looks up only the accounts that came through a link', async () => {
    const { prisma, service } = harness(
      [officer(), officer({ id: 'u2', registrationMethod: 'SELF' })],
      [{ userId: 'u1', resourceId: 'link-centre' }],
    );
    await service.listUsers({}, 'SUPER_ADMIN');
    expect(prisma.auditLog.findMany.mock.calls[0][0].where.userId).toEqual({ in: ['u1'] });
  });

  it('leaves the scope null when the audit row or the link is gone', async () => {
    // The sign-up's audit write is best-effort, and a link may be deleted.
    // Neither may break the queue or invent a mismatch.
    const missingAudit = harness([officer()], []);
    expect((await missingAudit.service.listUsers({}, 'SUPER_ADMIN')).users[0].invitationScope).toBeNull();

    const missingLink = harness([officer()], [{ userId: 'u1', resourceId: 'gone' }], []);
    expect((await missingLink.service.listUsers({}, 'SUPER_ADMIN')).users[0].invitationScope).toBeNull();
  });

  it('stays at two queries however many accounts the page holds', async () => {
    const many = Array.from({ length: 50 }, (_, i) => officer({ id: `u${i}` }));
    const rows = many.map((u) => ({ userId: u.id, resourceId: 'link-centre' }));
    const { prisma, service } = harness(many, rows);
    await service.listUsers({ pageSize: 50 }, 'SUPER_ADMIN');
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.staffInvitationLink.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.staffInvitationLink.findMany.mock.calls[0][0].where.id).toEqual({ in: ['link-centre'] });
  });
});
