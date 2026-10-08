import { BadRequestException, ConflictException, ForbiddenException, GoneException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { STAFF_INVITATION_PURPOSE, StaffInvitationService } from './staff-invitation.service';

/**
 * Staff invitation links. A real JwtService signs and verifies, so expiry,
 * tampering and purpose checks run for real; Prisma is a stub, because the
 * only database this project can reach is production.
 */

const SECRET = 'test-secret-for-staff-invitations';

const SUPER = { id: 'super-1', role: 'SUPER_ADMIN' };
const ONEFOP = { id: 'onefop-1', role: 'ADMIN_ONEFOP' };

function activeUser(actor: { id: string; role: string }) {
  return { ...actor, status: 'ACTIVE', isActive: true };
}

function makePrisma(opts: { taken?: boolean; users?: Record<string, any> } = {}) {
  const users: Record<string, any> = {
    [SUPER.id]: activeUser(SUPER),
    [ONEFOP.id]: activeUser(ONEFOP),
    ...(opts.users ?? {}),
  };
  let taken = !!opts.taken;
  const prisma: any = {
    user: {
      findFirst: jest.fn(async () => (taken ? { id: 'existing' } : null)),
      findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null),
      create: jest.fn(async ({ data }: any) => {
        taken = true;
        return { id: 'new-agent', ...data };
      }),
    },
    region: {
      findMany: jest.fn(async () => [{ id: 'reg-centre', name: 'Centre' }]),
    },
    department: {
      findMany: jest.fn(async () => [{ id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre' }]),
      findFirst: jest.fn(async () => null),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  return prisma;
}

function makeService(prisma: any, jwt = new JwtService({ secret: SECRET })) {
  const systemSettings = { getSettings: jest.fn(async () => ({ passwordMinLength: 8 })) };
  return { service: new StaffInvitationService(prisma, jwt, systemSettings as any), jwt };
}

const ACCEPT = { firstName: 'Marie', lastName: 'Ngono', password: 'long-enough-1' };

describe('StaffInvitationService.create — who may invite whom', () => {
  it('SUPER_ADMIN invites a central administrator, valid 24 hours', async () => {
    const { service, jwt } = makeService(makePrisma());
    const before = Date.now();
    const r = await service.create({ email: 'Central@Minefop.cm', role: 'ADMIN_ONEFOP' }, SUPER);
    expect(r.email).toBe('central@minefop.cm');
    expect(r.region).toBeNull();
    const payload: any = jwt.verify(r.token);
    expect(payload.purpose).toBe(STAFF_INVITATION_PURPOSE);
    expect(payload.invitedBy).toBe(SUPER.id);
    const ttl = new Date(r.expiresAt).getTime() - before;
    expect(ttl).toBeGreaterThan(23.9 * 3600_000);
    expect(ttl).toBeLessThanOrEqual(24 * 3600_000 + 1000);
  });

  it('ADMIN_ONEFOP may NOT invite a central administrator (no self-escalation)', async () => {
    const { service } = makeService(makePrisma());
    await expect(service.create({ email: 'x@m.cm', role: 'ADMIN_ONEFOP' }, ONEFOP)).rejects.toThrow(ForbiddenException);
  });

  it.each(['SUPER_ADMIN', 'AUDITOR', 'COMPANY', 'nonsense'])('refuses to invite role %s', async (role) => {
    const { service } = makeService(makePrisma());
    await expect(service.create({ email: 'x@m.cm', role }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('a territorial account cannot invite anyone', async () => {
    const { service } = makeService(makePrisma());
    await expect(
      service.create({ email: 'x@m.cm', role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' }, { id: 'r', role: 'REGIONAL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN_ONEFOP invites a regional delegate, region fixed, valid 72 hours', async () => {
    const { service } = makeService(makePrisma());
    const before = Date.now();
    const r = await service.create(
      { email: 'delegue@minefop.cm', role: 'REGIONAL_ADMIN', region: 'Centre', positionType: 'DELEGUE_REGIONAL' },
      ONEFOP,
    );
    expect(r).toMatchObject({ role: 'REGIONAL_ADMIN', region: 'Centre', department: null, positionType: 'DELEGUE_REGIONAL' });
    expect(new Date(r.expiresAt).getTime() - before).toBeGreaterThan(71.9 * 3600_000);
  });

  it('invites a divisional agent with region and department', async () => {
    const { service } = makeService(makePrisma());
    const r = await service.create(
      { email: 'agent@minefop.cm', role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi', positionType: 'STAFF' },
      SUPER,
    );
    expect(r).toMatchObject({ region: 'Centre', department: 'Mfoundi', positionType: 'STAFF' });
  });

  it('a delegate position must match its territorial level', async () => {
    const { service } = makeService(makePrisma());
    await expect(
      service.create({ email: 'x@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre', positionType: 'DELEGUE_DEPARTEMENTAL' }, SUPER),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({ email: 'x@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre', positionType: 'NOT_A_POSITION' }, SUPER),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a territorial invitation with no or an unknown territory', async () => {
    const { service } = makeService(makePrisma());
    await expect(service.create({ email: 'x@m.cm', role: 'REGIONAL_ADMIN' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ email: 'x@m.cm', role: 'REGIONAL_ADMIN', region: 'Atlantide' }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('refuses an email that already has an account, and an invalid email', async () => {
    await expect(makeService(makePrisma({ taken: true })).service.create({ email: 'x@m.cm', role: 'ADMIN_ONEFOP' }, SUPER)).rejects.toThrow(ConflictException);
    await expect(makeService(makePrisma()).service.create({ email: 'not-an-email', role: 'ADMIN_ONEFOP' }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('records the invitation in the audit log', async () => {
    const prisma = makePrisma();
    await makeService(prisma).service.create({ email: 'c@m.cm', role: 'ADMIN_ONEFOP' }, SUPER);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: SUPER.id, action: 'STAFF_INVITATION_CREATED' }) }),
    );
  });
});

describe('StaffInvitationService.accept', () => {
  async function invite(prisma: any, input: any, actor = SUPER) {
    const { service } = makeService(prisma);
    return { service, ...(await service.create(input, actor)) };
  }

  it('creates an ACTIVE account with the role, territory and position from the token', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, {
      email: 'delegue@minefop.cm', role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi', positionType: 'DELEGUE_DEPARTEMENTAL',
    });
    // Anything the request adds about role or territory is ignored.
    await service.accept({ ...ACCEPT, token, role: 'SUPER_ADMIN', region: 'Littoral' } as any);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'delegue@minefop.cm',
      role: 'DIVISIONAL_ADMIN',
      region: 'Centre',
      department: 'Mfoundi',
      positionType: 'DELEGUE_DEPARTEMENTAL',
      status: 'ACTIVE',
      isActive: true,
      mustChangePassword: false,
      createdBy: SUPER.id,
      registrationMethod: 'INVITATION',
    });
    expect(data.passwordHash).not.toBe(ACCEPT.password);
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_INVITATION_ACCEPTED' }) }),
    );
  });

  it('works once: the same link is refused after the account exists', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, { email: 'c@m.cm', role: 'ADMIN_ONEFOP' });
    await service.accept({ ...ACCEPT, token });
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(ConflictException);
    await expect(service.preview(token)).rejects.toThrow(ConflictException);
  });

  it('refuses an expired link', async () => {
    const jwt = new JwtService({ secret: SECRET });
    const prisma = makePrisma();
    const { service } = makeService(prisma, jwt);
    const expired = jwt.sign(
      { purpose: STAFF_INVITATION_PURPOSE, email: 'c@m.cm', role: 'ADMIN_ONEFOP', region: null, department: null, positionType: null, invitedBy: SUPER.id },
      { expiresIn: -10 },
    );
    await expect(service.accept({ ...ACCEPT, token: expired })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a tampered link, one signed with another key, and another purpose', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, { email: 'c@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre' });
    const [h, , s] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ purpose: STAFF_INVITATION_PURPOSE, email: 'c@m.cm', role: 'ADMIN_ONEFOP', region: null, department: null, positionType: null, invitedBy: SUPER.id }),
    ).toString('base64url');
    await expect(service.accept({ ...ACCEPT, token: `${h}.${forgedBody}.${s}` })).rejects.toThrow(GoneException);

    const otherKey = new JwtService({ secret: 'someone-else' }).sign({ purpose: STAFF_INVITATION_PURPOSE, email: 'c@m.cm', role: 'ADMIN_ONEFOP', invitedBy: SUPER.id });
    await expect(service.accept({ ...ACCEPT, token: otherKey })).rejects.toThrow(GoneException);

    const twoFactor = new JwtService({ secret: SECRET }).sign({ sub: SUPER.id, purpose: '2fa_pending' });
    await expect(service.accept({ ...ACCEPT, token: twoFactor })).rejects.toThrow(GoneException);
    await expect(service.accept({ ...ACCEPT, token: '' })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("dies with its inviter: a suspended or demoted inviter's links stop working", async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, { email: 'a@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre' }, ONEFOP);
    prisma.user.findUnique.mockImplementation(async () => ({ ...ONEFOP, status: 'ACTIVE', isActive: false }));
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(GoneException);
    prisma.user.findUnique.mockImplementation(async () => ({ ...ONEFOP, role: 'REGIONAL_ADMIN', status: 'ACTIVE', isActive: true }));
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('requires a name and a password of the configured length', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, { email: 'c@m.cm', role: 'ADMIN_ONEFOP' });
    await expect(service.accept({ ...ACCEPT, token, firstName: ' ' })).rejects.toThrow(BadRequestException);
    await expect(service.accept({ ...ACCEPT, token, password: 'short' })).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('preview returns what the invitation fixes, for the form', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, { email: 'r@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre', positionType: 'DELEGUE_REGIONAL' });
    await expect(service.preview(token)).resolves.toMatchObject({
      email: 'r@m.cm', role: 'REGIONAL_ADMIN', region: 'Centre', department: null, positionType: 'DELEGUE_REGIONAL',
    });
  });
});
