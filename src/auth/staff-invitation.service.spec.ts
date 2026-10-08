import { BadRequestException, ConflictException, ForbiddenException, GoneException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GENERIC_POSITION_TYPE, STAFF_INVITATION_PURPOSE, StaffInvitationService } from './staff-invitation.service';

/**
 * Staff invitation links, placed in the MINEFOP organigramme. A real
 * JwtService signs and verifies, so expiry, tampering and purpose checks run
 * for real; Prisma is a stub holding a small slice of the seeded organigramme,
 * because the only database this project can reach is production.
 */

const SECRET = 'test-secret-for-staff-invitations';

const SUPER = { id: 'super-1', role: 'SUPER_ADMIN' };
const ONEFOP = { id: 'onefop-1', role: 'ADMIN_ONEFOP' };

// A slice of prisma/seed.ts, with roleMapping as it is after the
// role_model_refactor migration.
const SERVICES: Record<string, any> = {
  ONEFOP: { code: 'ONEFOP', name: "Observatoire National de l'Emploi et de la Formation Professionnelle", roleMapping: 'ADMIN_ONEFOP', isActive: true },
  DREFOP: { code: 'DREFOP', name: "Délégation Régionale de l'Emploi et de la Formation Professionnelle", roleMapping: 'REGIONAL_ADMIN', isActive: true },
  'DREFOP-SPE': { code: 'DREFOP-SPE', name: "Service de la Promotion de l'Emploi", roleMapping: 'REGIONAL_ADMIN', isActive: true },
  DDEFOP: { code: 'DDEFOP', name: "Délégation Départementale de l'Emploi et de la Formation Professionnelle", roleMapping: 'DIVISIONAL_ADMIN', isActive: true },
  CLOSED: { code: 'CLOSED', name: 'Service fermé', roleMapping: 'REGIONAL_ADMIN', isActive: false },
  AUDIT: { code: 'AUDIT', name: 'Audit', roleMapping: 'AUDITOR', isActive: true },
};
const POSITIONS = [
  { serviceCode: 'ONEFOP', positionType: 'DIRECTEUR', title: "Directeur de l'ONEFOP", isActive: true },
  { serviceCode: 'DREFOP', positionType: 'DELEGUE_REGIONAL', title: "Délégué Régional de l'Emploi et de la Formation Professionnelle", isActive: true },
  { serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE', title: "Chef du Service de la Promotion de l'Emploi", isActive: true },
  { serviceCode: 'DDEFOP', positionType: 'DELEGUE_DEPARTEMENTAL', title: "Délégué Départemental de l'Emploi et de la Formation Professionnelle", isActive: true },
];

function activeUser(actor: { id: string; role: string }) {
  return { ...actor, status: 'ACTIVE', isActive: true };
}

function makePrisma(opts: { taken?: boolean } = {}) {
  const users: Record<string, any> = { [SUPER.id]: activeUser(SUPER), [ONEFOP.id]: activeUser(ONEFOP) };
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
    minefopService: {
      findUnique: jest.fn(async ({ where }: any) => SERVICES[where.code] ?? null),
    },
    servicePosition: {
      findFirst: jest.fn(async ({ where }: any) =>
        POSITIONS.find((p) => p.serviceCode === where.serviceCode && p.positionType === where.positionType && p.isActive) ?? null,
      ),
    },
    region: { findMany: jest.fn(async () => [{ id: 'reg-centre', name: 'Centre' }]) },
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

const REGIONAL_DELEGATE = { email: 'delegue@minefop.cm', serviceCode: 'DREFOP', positionType: 'DELEGUE_REGIONAL', region: 'Centre' };
const DIVISIONAL_DELEGATE = {
  email: 'dd@minefop.cm', serviceCode: 'DDEFOP', positionType: 'DELEGUE_DEPARTEMENTAL', region: 'Centre', department: 'Mfoundi',
};
const CENTRAL = { email: 'Central@Minefop.cm', serviceCode: 'ONEFOP', positionType: 'DIRECTEUR' };

describe('StaffInvitationService.create — placed in the organigramme', () => {
  it('takes the role from the service: a central service is ADMIN_ONEFOP, valid 24 hours', async () => {
    const { service, jwt } = makeService(makePrisma());
    const before = Date.now();
    const r = await service.create(CENTRAL, SUPER);
    expect(r).toMatchObject({
      email: 'central@minefop.cm', role: 'ADMIN_ONEFOP', region: null, serviceCode: 'ONEFOP',
      positionType: 'DIRECTEUR', positionTitle: "Directeur de l'ONEFOP",
    });
    const payload: any = jwt.verify(r.token);
    expect(payload).toMatchObject({ purpose: STAFF_INVITATION_PURPOSE, invitedBy: SUPER.id, serviceCode: 'ONEFOP' });
    const ttl = new Date(r.expiresAt).getTime() - before;
    expect(ttl).toBeGreaterThan(23.9 * 3600_000);
    expect(ttl).toBeLessThanOrEqual(24 * 3600_000 + 1000);
  });

  it('a regional delegation post is REGIONAL_ADMIN with its region, valid 72 hours', async () => {
    const { service } = makeService(makePrisma());
    const before = Date.now();
    const r = await service.create(REGIONAL_DELEGATE, ONEFOP);
    expect(r).toMatchObject({ role: 'REGIONAL_ADMIN', region: 'Centre', department: null, positionType: 'DELEGUE_REGIONAL' });
    expect(new Date(r.expiresAt).getTime() - before).toBeGreaterThan(71.9 * 3600_000);
  });

  it('a divisional delegation post is DIVISIONAL_ADMIN with region and department', async () => {
    const { service } = makeService(makePrisma());
    const r = await service.create(DIVISIONAL_DELEGATE, ONEFOP);
    expect(r).toMatchObject({ role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' });
  });

  it('an agent with no head post is placed as "Cadre" in any service', async () => {
    const { service } = makeService(makePrisma());
    const r = await service.create(
      { email: 'agent@minefop.cm', serviceCode: 'DREFOP-SPE', positionType: GENERIC_POSITION_TYPE, region: 'Centre' },
      ONEFOP,
    );
    expect(r).toMatchObject({ role: 'REGIONAL_ADMIN', positionType: 'STAFF', positionTitle: 'Cadre' });
  });

  it('ADMIN_ONEFOP may NOT invite into a central service (no self-escalation)', async () => {
    const { service } = makeService(makePrisma());
    await expect(service.create(CENTRAL, ONEFOP)).rejects.toThrow(ForbiddenException);
  });

  it('a territorial account cannot invite anyone', async () => {
    const { service } = makeService(makePrisma());
    await expect(service.create(DIVISIONAL_DELEGATE, { id: 'r', role: 'REGIONAL_ADMIN' })).rejects.toThrow(ForbiddenException);
  });

  it('refuses an unknown or closed service, and a service whose role is not invitable', async () => {
    const { service } = makeService(makePrisma());
    for (const serviceCode of ['NOPE', 'CLOSED', 'AUDIT', '']) {
      await expect(service.create({ ...REGIONAL_DELEGATE, serviceCode }, SUPER)).rejects.toThrow(BadRequestException);
    }
  });

  it('refuses a position that does not exist in that service', async () => {
    const { service } = makeService(makePrisma());
    // A real position, but of the departmental delegation, not the regional one.
    await expect(service.create({ ...REGIONAL_DELEGATE, positionType: 'DELEGUE_DEPARTEMENTAL' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_DELEGATE, positionType: '' }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('refuses a territorial post with no or an unknown territory', async () => {
    const { service } = makeService(makePrisma());
    await expect(service.create({ ...REGIONAL_DELEGATE, region: undefined }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_DELEGATE, region: 'Atlantide' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...DIVISIONAL_DELEGATE, department: undefined }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('refuses an email that already has an account, and an invalid email', async () => {
    await expect(makeService(makePrisma({ taken: true })).service.create(CENTRAL, SUPER)).rejects.toThrow(ConflictException);
    await expect(makeService(makePrisma()).service.create({ ...CENTRAL, email: 'not-an-email' }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('records the invitation in the audit log', async () => {
    const prisma = makePrisma();
    await makeService(prisma).service.create(CENTRAL, SUPER);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: SUPER.id,
          action: 'STAFF_INVITATION_CREATED',
          details: expect.objectContaining({ serviceCode: 'ONEFOP', positionType: 'DIRECTEUR' }),
        }),
      }),
    );
  });
});

describe('StaffInvitationService.accept', () => {
  async function invite(prisma: any, input: any, actor = SUPER) {
    const { service } = makeService(prisma);
    return { service, ...(await service.create(input, actor)) };
  }

  it('creates an ACTIVE account placed in the organigramme, from the token alone', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, DIVISIONAL_DELEGATE, ONEFOP);
    // Anything the request adds about role, territory or post is ignored.
    await service.accept({ ...ACCEPT, token, role: 'SUPER_ADMIN', region: 'Littoral', serviceCode: 'ONEFOP', poste: 'Ministre' } as any);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'dd@minefop.cm',
      role: 'DIVISIONAL_ADMIN',
      region: 'Centre',
      department: 'Mfoundi',
      serviceCode: 'DDEFOP',
      positionType: 'DELEGUE_DEPARTEMENTAL',
      poste: "Délégué Départemental de l'Emploi et de la Formation Professionnelle",
      status: 'ACTIVE',
      isActive: true,
      mustChangePassword: false,
      createdBy: ONEFOP.id,
      registrationMethod: 'INVITATION',
    });
    expect(data.passwordHash).not.toBe(ACCEPT.password);
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_INVITATION_ACCEPTED' }) }),
    );
  });

  it('works once: the same link is refused after the account exists', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, CENTRAL);
    await service.accept({ ...ACCEPT, token });
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(ConflictException);
    await expect(service.preview(token)).rejects.toThrow(ConflictException);
  });

  it('refuses an expired link', async () => {
    const jwt = new JwtService({ secret: SECRET });
    const prisma = makePrisma();
    const { service } = makeService(prisma, jwt);
    const expired = jwt.sign(
      {
        purpose: STAFF_INVITATION_PURPOSE, email: 'c@m.cm', role: 'ADMIN_ONEFOP', region: null, department: null,
        serviceCode: 'ONEFOP', positionType: 'DIRECTEUR', positionTitle: 'x', invitedBy: SUPER.id,
      },
      { expiresIn: -10 },
    );
    await expect(service.accept({ ...ACCEPT, token: expired })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a tampered link, one signed with another key, and another purpose', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, REGIONAL_DELEGATE);
    const [h, , s] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({
        purpose: STAFF_INVITATION_PURPOSE, email: 'delegue@minefop.cm', role: 'ADMIN_ONEFOP', region: null, department: null,
        serviceCode: 'ONEFOP', positionType: 'DIRECTEUR', positionTitle: 'x', invitedBy: SUPER.id,
      }),
    ).toString('base64url');
    await expect(service.accept({ ...ACCEPT, token: `${h}.${forgedBody}.${s}` })).rejects.toThrow(GoneException);

    const otherKey = new JwtService({ secret: 'someone-else' }).sign({
      purpose: STAFF_INVITATION_PURPOSE, email: 'c@m.cm', role: 'ADMIN_ONEFOP', serviceCode: 'ONEFOP', positionType: 'DIRECTEUR', invitedBy: SUPER.id,
    });
    await expect(service.accept({ ...ACCEPT, token: otherKey })).rejects.toThrow(GoneException);

    const twoFactor = new JwtService({ secret: SECRET }).sign({ sub: SUPER.id, purpose: '2fa_pending' });
    await expect(service.accept({ ...ACCEPT, token: twoFactor })).rejects.toThrow(GoneException);
    await expect(service.accept({ ...ACCEPT, token: '' })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("dies with its inviter: a suspended or demoted inviter's links stop working", async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, REGIONAL_DELEGATE, ONEFOP);
    prisma.user.findUnique.mockImplementation(async () => ({ ...ONEFOP, status: 'ACTIVE', isActive: false }));
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(GoneException);
    prisma.user.findUnique.mockImplementation(async () => ({ ...ONEFOP, role: 'REGIONAL_ADMIN', status: 'ACTIVE', isActive: true }));
    await expect(service.accept({ ...ACCEPT, token })).rejects.toThrow(GoneException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('requires a name and a password of the configured length', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, CENTRAL);
    await expect(service.accept({ ...ACCEPT, token, firstName: ' ' })).rejects.toThrow(BadRequestException);
    await expect(service.accept({ ...ACCEPT, token, password: 'short' })).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('preview returns the post and territory the invitation fixes, for the form', async () => {
    const prisma = makePrisma();
    const { service, token } = await invite(prisma, REGIONAL_DELEGATE);
    await expect(service.preview(token)).resolves.toMatchObject({
      email: 'delegue@minefop.cm',
      role: 'REGIONAL_ADMIN',
      region: 'Centre',
      department: null,
      serviceCode: 'DREFOP',
      serviceName: "Délégation Régionale de l'Emploi et de la Formation Professionnelle",
      positionType: 'DELEGUE_REGIONAL',
      positionTitle: "Délégué Régional de l'Emploi et de la Formation Professionnelle",
    });
  });
});
