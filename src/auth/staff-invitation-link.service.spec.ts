import { BadRequestException, ConflictException, ForbiddenException, GoneException } from '@nestjs/common';
import * as crypto from 'crypto';
import { StaffInvitationLinkService, linkState } from './staff-invitation-link.service';

/**
 * Group invitation links. Prisma is an in-memory stub -- the only database
 * this project can reach is production -- whose conditional updateMany
 * applies the same where-clause the real query does, so the use limit and
 * revocation are exercised, not assumed.
 */

const SUPER = { id: 'super-1', role: 'SUPER_ADMIN' };
const ONEFOP = { id: 'onefop-1', role: 'ADMIN_ONEFOP' };

const SERVICES: Record<string, any> = {
  DREFOP: { code: 'DREFOP', name: 'Délégation Régionale', parentCode: null, category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', isActive: true },
  'DREFOP-SPE': { code: 'DREFOP-SPE', name: "Service de la Promotion de l'Emploi", parentCode: 'DREFOP', category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', isActive: true },
  'DREFOP-SPE-BAE': { code: 'DREFOP-SPE-BAE', name: "Bureau d'Appui à l'Emploi", parentCode: 'DREFOP-SPE', category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', isActive: true },
  DDEFOP: { code: 'DDEFOP', name: 'Délégation Départementale', parentCode: null, category: 'DECONCENTRE', roleMapping: 'DIVISIONAL_ADMIN', isActive: true },
  'DDEFOP-BAG': { code: 'DDEFOP-BAG', name: 'Bureau des Affaires Générales', parentCode: 'DDEFOP', category: 'DECONCENTRE', roleMapping: 'DIVISIONAL_ADMIN', isActive: true },
  SG: { code: 'SG', name: 'Secrétariat Général', parentCode: null, category: 'CENTRALE', roleMapping: 'CENTRAL_AGENT', isActive: true },
  ONEFOP: { code: 'ONEFOP', name: "Observatoire National de l'Emploi et de la Formation Professionnelle", parentCode: null, category: 'RATTACHE', roleMapping: 'CENTRAL_AGENT', isActive: true },
};
const POSITIONS = [
  { serviceCode: 'DREFOP', positionType: 'DELEGUE_REGIONAL', title: 'Délégué Régional', isActive: true },
  { serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE', title: "Chef du Service de la Promotion de l'Emploi", isActive: true },
  { serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL', title: 'Secrétaire Général', isActive: true },
];

function makePrisma() {
  const links: any[] = [];
  const users: any[] = [];
  const prisma: any = {
    staffInvitationLink: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `link-${links.length + 1}`, useCount: 0, revokedAt: null, revokedBy: null, createdAt: new Date(), ...data };
        links.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = links.find((l) => (where.id ? l.id === where.id : l.tokenHash === where.tokenHash));
        return row ? { ...row } : null;
      }),
      findMany: jest.fn(async () => links.map((l) => ({ ...l, createdByUser: { firstName: 'Super', lastName: 'Admin', email: 's@m.cm' } })).reverse()),
      update: jest.fn(async ({ where, data }: any) => {
        const row = links.find((l) => l.id === where.id);
        Object.assign(row, data);
        return { ...row };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = links.find((l) => l.id === where.id);
        const ok = row && row.revokedAt === where.revokedAt && row.expiresAt > where.expiresAt.gt && row.useCount < where.useCount.lt;
        if (!ok) return { count: 0 };
        row.useCount += data.useCount.increment;
        return { count: 1 };
      }),
    },
    minefopService: {
      findUnique: jest.fn(async ({ where }: any) => SERVICES[where.code] ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        (where.code.in as string[]).map((code) => SERVICES[code]).filter(Boolean)),
    },
    servicePosition: {
      findFirst: jest.fn(async ({ where }: any) =>
        POSITIONS.find((p) => p.serviceCode === where.serviceCode && p.positionType === where.positionType) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        POSITIONS.filter((p) => (where.serviceCode.in as string[]).includes(p.serviceCode))),
    },
    user: {
      findFirst: jest.fn(async ({ where }: any) => users.find((u) => u.email === where.email.equals.toLowerCase()) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `user-${users.length + 1}`, ...data };
        users.push(row);
        return { id: row.id, email: row.email };
      }),
    },
    region: { findMany: jest.fn(async () => [{ id: 'reg-centre', name: 'Centre' }]) },
    department: {
      findMany: jest.fn(async () => [{ id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre' }]),
      findFirst: jest.fn(async () => null),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    __links: links,
    __users: users,
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return prisma;
}

function makeService(prisma = makePrisma()) {
  const settings = { getSettings: jest.fn(async () => ({ passwordMinLength: 8 })) };
  return { prisma, service: new StaffInvitationLinkService(prisma, settings as any) };
}

// A link is made for one post: the cadres of a regional delegation, here.
const REGIONAL_LINK = {
  label: 'Personnel DREFOP Centre',
  level: 'regional',
  region: 'Centre',
  serviceCode: 'DREFOP',
  positionType: 'STAFF',
};
const PERSON = { email: 'Agent.Un@Minefop.cm', firstName: 'Marie', lastName: 'Ngono', password: 'long-enough-1' };

describe('StaffInvitationLinkService.create', () => {
  it('creates a regional link, 7 days and 50 uses by default, storing only the hash of the token', async () => {
    const { service, prisma } = makeService();
    const before = Date.now();
    const r = await service.create(REGIONAL_LINK, ONEFOP);
    expect(r).toMatchObject({
      level: 'regional', role: 'REGIONAL_ADMIN', region: 'Centre', department: null, maxUses: 50, useCount: 0, state: 'active',
      serviceCode: 'DREFOP', positionType: 'STAFF', serviceName: 'Délégation Régionale', positionTitle: 'Cadre',
    });
    expect(new Date(r.expiresAt).getTime() - before).toBeGreaterThan(6.99 * 86400_000);
    const stored = prisma.__links[0];
    expect(stored.tokenHash).toBe(crypto.createHash('sha256').update(r.token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(r.token);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_INVITATION_LINK_CREATED' }) }));
  });

  it('a departmental link needs region and department; a central link none', async () => {
    const { service } = makeService();
    const post = { serviceCode: 'DDEFOP', positionType: 'STAFF' };
    await expect(service.create({ label: 'x', level: 'departmental', region: 'Centre', ...post }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ label: 'x', level: 'departmental', region: 'Centre', department: 'Mfoundi', ...post }, SUPER))
      .resolves.toMatchObject({ role: 'DIVISIONAL_ADMIN', department: 'Mfoundi' });
    await expect(service.create({ label: 'x', level: 'central', serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL' }, ONEFOP))
      .resolves.toMatchObject({ role: 'CENTRAL_AGENT', region: null, positionTitle: 'Secrétaire Général' });
  });

  it('a link is made for a post: the service and the position type are both required', async () => {
    const { service } = makeService();
    const { serviceCode, positionType, ...noPost } = REGIONAL_LINK;
    await expect(service.create(noPost, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...noPost, serviceCode: 'DREFOP' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...noPost, positionType: 'STAFF' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...noPost, serviceCode: ' ', positionType: ' ' }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('refuses a service outside the level and a post the service does not offer', async () => {
    const { service } = makeService();
    // SG is a central service: a regional link cannot point at it.
    await expect(service.create({ ...REGIONAL_LINK, serviceCode: 'SG' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, serviceCode: 'NOWHERE' }, SUPER)).rejects.toThrow(BadRequestException);
    // CHEF_SERVICE exists on DREFOP-SPE, not on the delegation itself.
    await expect(service.create({ ...REGIONAL_LINK, positionType: 'CHEF_SERVICE' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE' }, SUPER))
      .resolves.toMatchObject({ serviceName: "Service de la Promotion de l'Emploi", positionTitle: "Chef du Service de la Promotion de l'Emploi" });
  });

  it('refuses a bad level, a missing name and out-of-range limits', async () => {
    const { service } = makeService();
    await expect(service.create({ ...REGIONAL_LINK, level: 'admin' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, label: ' ' }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, expiresInDays: 31 }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, maxUses: 0 }, SUPER)).rejects.toThrow(BadRequestException);
    await expect(service.create({ ...REGIONAL_LINK, maxUses: 201 }, SUPER)).rejects.toThrow(BadRequestException);
  });

  it('only SUPER_ADMIN and ADMIN_ONEFOP manage links', async () => {
    const { service } = makeService();
    await expect(service.create(REGIONAL_LINK, { id: 'r', role: 'REGIONAL_ADMIN' })).rejects.toThrow(ForbiddenException);
    await expect(service.create(REGIONAL_LINK, { id: 'c', role: 'CENTRAL_AGENT' })).rejects.toThrow(ForbiddenException);
    await expect(service.list({ role: 'DIVISIONAL_ADMIN' })).rejects.toThrow(ForbiddenException);
  });
});

describe('StaffInvitationLinkService.signUp', () => {
  async function withLink(input: any = REGIONAL_LINK) {
    const ctx = makeService();
    const link = await ctx.service.create(input, SUPER);
    return { ...ctx, link };
  }

  it('creates a PENDING_APPROVAL account in the link territory, any depth under the delegation', async () => {
    const { service, prisma, link } = await withLink();
    const r = await service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP-SPE-BAE', positionType: 'STAFF', region: 'Littoral' } as any);
    expect(r).toEqual({ email: 'agent.un@minefop.cm', status: 'PENDING_APPROVAL' });
    expect(prisma.__users[0]).toMatchObject({
      role: 'REGIONAL_ADMIN', region: 'Centre', department: null, serviceCode: 'DREFOP-SPE-BAE', positionType: 'STAFF', poste: 'Cadre',
      status: 'PENDING_APPROVAL', isActive: false, createdBy: SUPER.id, registrationMethod: 'INVITATION_LINK',
    });
    expect(prisma.__links[0].useCount).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_INVITATION_LINK_USED' }) }));
  });

  it('takes the post title from the organigramme', async () => {
    const { service, prisma, link } = await withLink();
    await service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE' });
    expect(prisma.__users[0].poste).toBe("Chef du Service de la Promotion de l'Emploi");
  });

  it('refuses a service outside the link scope, a central link from a delegation, and an unknown post', async () => {
    const { service, link } = await withLink();
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DDEFOP-BAG', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'SG', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'MINISTRE' })).rejects.toThrow(BadRequestException);

    const central = await withLink({ label: 'Central', level: 'central', serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL' });
    await expect(central.service.signUp({ ...PERSON, token: central.link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(central.service.signUp({ ...PERSON, token: central.link.token, serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL' }))
      .resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(central.prisma.__users[0].role).toBe('CENTRAL_AGENT');
  });

  it('stops at the use limit', async () => {
    const { service, prisma, link } = await withLink({ ...REGIONAL_LINK, maxUses: 2 });
    await service.signUp({ ...PERSON, email: 'a@m.cm', token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' });
    await service.signUp({ ...PERSON, email: 'b@m.cm', token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' });
    await expect(service.signUp({ ...PERSON, email: 'c@m.cm', token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(GoneException);
    expect(prisma.__users).toHaveLength(2);
    await expect(service.preview(link.token)).rejects.toThrow(GoneException);
  });

  it('stops when revoked or expired, and refuses an unknown token', async () => {
    const { service, prisma, link } = await withLink();
    await service.revoke(link.id, ONEFOP);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(GoneException);

    const other = await withLink();
    other.prisma.__links[0].expiresAt = new Date(Date.now() - 1000);
    await expect(other.service.preview(other.link.token)).rejects.toThrow(GoneException);
    await expect(service.preview('not-a-token')).rejects.toThrow(GoneException);
    await expect(service.preview(undefined)).rejects.toThrow(GoneException);
    expect(prisma.__users).toHaveLength(0);
  });

  it('refuses an email already in use, a missing name and a short password -- without spending a use', async () => {
    const { service, prisma, link } = await withLink();
    await service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' });
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(ConflictException);
    await expect(service.signUp({ ...PERSON, email: 'n@m.cm', firstName: '', token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, email: 'p@m.cm', password: 'short', token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    expect(prisma.__links[0].useCount).toBe(1);
  });

  it('preview tells the form the scope, never the creator', async () => {
    const { service, link } = await withLink({
      label: 'DDEFOP Mfoundi', level: 'departmental', region: 'Centre', department: 'Mfoundi',
      serviceCode: 'DDEFOP', positionType: 'STAFF',
    });
    const p = await service.preview(link.token);
    expect(p).toMatchObject({ label: 'DDEFOP Mfoundi', level: 'departmental', role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' });
    expect(JSON.stringify(p)).not.toContain(SUPER.id);
  });
});

describe('StaffInvitationLinkService list / revoke', () => {
  it('lists newest first with state and creator, without the token hash', async () => {
    const { service } = makeService();
    await service.create({ ...REGIONAL_LINK, label: 'first' }, SUPER);
    await service.create({ ...REGIONAL_LINK, label: 'second' }, SUPER);
    const list = await service.list(ONEFOP);
    expect(list.map((l) => l.label)).toEqual(['second', 'first']);
    expect(list[0]).toMatchObject({ state: 'active', createdByName: 'Super Admin' });
    expect(JSON.stringify(list)).not.toContain('tokenHash');
  });

  it('names the post of every link in one pass, whatever the number of links', async () => {
    const { service, prisma } = makeService();
    await service.create(REGIONAL_LINK, SUPER);
    await service.create({ ...REGIONAL_LINK, label: 'chefs', serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE' }, SUPER);
    prisma.minefopService.findMany.mockClear();
    prisma.servicePosition.findMany.mockClear();
    const list = await service.list(SUPER);
    expect(list.map((l) => [l.serviceName, l.positionTitle])).toEqual([
      ["Service de la Promotion de l'Emploi", "Chef du Service de la Promotion de l'Emploi"],
      ['Délégation Régionale', 'Cadre'],
    ]);
    expect(prisma.minefopService.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.servicePosition.findMany).toHaveBeenCalledTimes(1);
  });

  it('a link made before the post columns existed carries none, and still lists and revokes', async () => {
    const { service, prisma } = makeService();
    prisma.__links.push({
      id: 'link-old', tokenHash: 'h', label: 'Ancien lien', level: 'central',
      region: null, department: null, serviceCode: null, positionType: null,
      maxUses: 50, useCount: 3, expiresAt: new Date(Date.now() + 86400_000),
      revokedAt: null, revokedBy: null, createdBy: SUPER.id, createdAt: new Date(),
    });
    const [listed] = await service.list(SUPER);
    expect(listed).toMatchObject({ label: 'Ancien lien', serviceCode: null, serviceName: null, positionType: null, positionTitle: null });
    // Nothing to look up: no service code means no query for names.
    expect(prisma.minefopService.findMany).not.toHaveBeenCalled();
    await expect(service.revoke('link-old', SUPER)).resolves.toMatchObject({ state: 'revoked', positionTitle: null });
  });

  it('linkState', () => {
    const base = { revokedAt: null, expiresAt: new Date(Date.now() + 1000), useCount: 0, maxUses: 1 };
    expect(linkState(base)).toBe('active');
    expect(linkState({ ...base, useCount: 1 })).toBe('full');
    expect(linkState({ ...base, expiresAt: new Date(Date.now() - 1) })).toBe('expired');
    expect(linkState({ ...base, revokedAt: new Date() })).toBe('revoked');
  });
});
