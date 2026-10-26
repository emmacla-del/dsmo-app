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
  DREFOP: { code: 'DREFOP', name: 'Délégation Régionale', parentCode: null, category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', requiresRegion: true, requiresDepartment: false, isActive: true },
  'DREFOP-SPE': { code: 'DREFOP-SPE', name: "Service de la Promotion de l'Emploi", parentCode: 'DREFOP', category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', requiresRegion: true, requiresDepartment: false, isActive: true },
  'DREFOP-SPE-BAE': { code: 'DREFOP-SPE-BAE', name: "Bureau d'Appui à l'Emploi", parentCode: 'DREFOP-SPE', category: 'DECONCENTRE', roleMapping: 'REGIONAL_ADMIN', requiresRegion: true, requiresDepartment: false, isActive: true },
  DDEFOP: { code: 'DDEFOP', name: 'Délégation Départementale', parentCode: null, category: 'DECONCENTRE', roleMapping: 'DIVISIONAL_ADMIN', requiresRegion: true, requiresDepartment: true, isActive: true },
  'DDEFOP-BAG': { code: 'DDEFOP-BAG', name: 'Bureau des Affaires Générales', parentCode: 'DDEFOP', category: 'DECONCENTRE', roleMapping: 'DIVISIONAL_ADMIN', requiresRegion: true, requiresDepartment: true, isActive: true },
  SG: { code: 'SG', name: 'Secrétariat Général', parentCode: null, category: 'CENTRALE', roleMapping: 'CENTRAL_AGENT', requiresRegion: false, requiresDepartment: false, isActive: true },
  ONEFOP: { code: 'ONEFOP', name: "Observatoire National de l'Emploi et de la Formation Professionnelle", parentCode: 'SG', category: 'RATTACHE', roleMapping: 'CENTRAL_AGENT', requiresRegion: false, requiresDepartment: false, isActive: true },
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
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.email) return users.find((u) => u.email === where.email.equals.toLowerCase()) ?? null;
        // The post-occupancy lookup (service-post.ts): the same post of the
        // same service in the same territory, held by a live account.
        const matches = (filter: any, value: any) =>
          filter === null
            ? value === null || value === undefined
            : String(value ?? '').toLowerCase() === String(filter.equals).toLowerCase();
        return (
          users.find(
            (u) =>
              u.serviceCode === where.serviceCode &&
              u.positionType === where.positionType &&
              matches(where.region, u.region) &&
              matches(where.department, u.department) &&
              where.status.in.includes(u.status),
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `user-${users.length + 1}`, ...data };
        users.push(row);
        return { id: row.id, email: row.email };
      }),
    },
    region: { findMany: jest.fn(async () => [{ id: 'reg-centre', name: 'Centre' }, { id: 'reg-littoral', name: 'Littoral' }]) },
    department: {
      findMany: jest.fn(async ({ where }: any) => where?.regionId === 'reg-littoral'
        ? [{ id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral' }]
        : [{ id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre' }]),
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
const PERSON = { email: 'Agent.Un@Minefop.cm', firstName: 'Marie', lastName: 'Ngono', matricule: 'M-12345', region: 'Centre', password: 'long-enough-1' };

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

  /**
   * A link made before the post columns existed. create() will not make one
   * any more, so it is inserted as the database still holds it: post-less,
   * its holder choosing their own service and post, which is the behaviour
   * those links keep until they expire.
   */
  function withLegacyLink(overrides: any = {}) {
    const ctx = makeService();
    const token = 'legacy-token';
    ctx.prisma.__links.push({
      id: 'link-legacy',
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      label: 'Ancien lien', level: 'regional', region: 'Centre', department: null,
      serviceCode: null, positionType: null, maxUses: 50, useCount: 0,
      expiresAt: new Date(Date.now() + 7 * 86400_000), revokedAt: null, revokedBy: null,
      createdBy: SUPER.id, createdAt: new Date(), ...overrides,
    });
    return { ...ctx, link: { token } };
  }

  it('creates a PENDING_APPROVAL account on the post the link carries, whatever the request says', async () => {
    const { service, prisma, link } = await withLink();
    // The service, the post AND the region belong to the link: a request
    // naming another unit, another post and another region gets none of
    // them.
    const r = await service.signUp({
      ...PERSON, token: link.token, serviceCode: 'DREFOP-SPE-BAE', positionType: 'CHEF_SERVICE', region: 'Littoral',
    } as any);
    expect(r).toEqual({ email: 'agent.un@minefop.cm', status: 'PENDING_APPROVAL' });
    expect(prisma.__users[0]).toMatchObject({
      role: 'REGIONAL_ADMIN', region: 'Centre', department: null,
      serviceCode: 'DREFOP', positionType: 'STAFF', poste: 'Cadre', matricule: 'M-12345',
      status: 'PENDING_APPROVAL', isActive: false, createdBy: SUPER.id, registrationMethod: 'INVITATION_LINK',
    });
    expect(prisma.__links[0].useCount).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_INVITATION_LINK_USED' }) }));
  });

  it('takes the post title from the organigramme', async () => {
    const { service, prisma, link } = await withLink({ ...REGIONAL_LINK, serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE' });
    await service.signUp({ ...PERSON, token: link.token });
    expect(prisma.__users[0].poste).toBe("Chef du Service de la Promotion de l'Emploi");
  });

  it('refuses a head post the territory already has a holder for', async () => {
    const { service, prisma, link } = await withLink({
      ...REGIONAL_LINK, serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE',
    });
    await service.signUp({ ...PERSON, token: link.token });
    // One Chef du Service de la Promotion de l'Emploi per region: the second
    // person to open the link is refused, not queued behind the first. The
    // use already spent by the first is not refunded, and theirs is not spent.
    await expect(service.signUp({ ...PERSON, email: 'second@minefop.cm', token: link.token }))
      .rejects.toThrow(ConflictException);
    expect(prisma.__users).toHaveLength(1);
    expect(prisma.__links[0].useCount).toBe(1);
    // Cadres are not singular -- 'stops at the use limit' opens two of them
    // on one service.
  });

  it('the matricule is required', async () => {
    const { service, prisma, link } = await withLink();
    await expect(service.signUp({ ...PERSON, matricule: '', token: link.token })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, matricule: '   ', token: link.token })).rejects.toThrow(BadRequestException);
    const { matricule, ...noMatricule } = PERSON;
    await expect(service.signUp({ ...noMatricule, token: link.token })).rejects.toThrow(BadRequestException);
    expect(prisma.__users).toHaveLength(0);
    expect(prisma.__links[0].useCount).toBe(0);
  });

  it('a link that pins a territory gives it, and a different one in the request changes nothing', async () => {
    // The departmental link pins both halves, so neither is asked for and
    // neither can be talked out of: this is what ties a staff account to the
    // delegation that invited it.
    const departmental = await withLink({
      label: 'Personnel DDEFOP', level: 'departmental', region: 'Centre', department: 'Mfoundi',
      serviceCode: 'DDEFOP', positionType: 'STAFF',
    });
    await expect(departmental.service.signUp({ ...PERSON, token: departmental.link.token, department: '' }))
      .resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    await expect(departmental.service.signUp({
      ...PERSON, email: 'other@m.cm', token: departmental.link.token, region: 'Littoral', department: 'Wouri',
    })).resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(departmental.prisma.__users.map((u: any) => [u.region, u.department])).toEqual([
      ['Centre', 'Mfoundi'],
      ['Centre', 'Mfoundi'],
    ]);
  });

  it('a link that pins no territory asks the officer for what the service needs', async () => {
    // The national link that creates the delegates themselves: few enough
    // that a national officer checks each claim by hand.
    const { service, prisma, link } = withLegacyLink({ region: null, department: null });
    const { region, ...withoutRegion } = PERSON;
    await expect(service.signUp({ ...withoutRegion, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' }))
      .rejects.toThrow('Choisissez une région.');
    expect(prisma.__links[0].useCount).toBe(0);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF', region: 'Littoral' }))
      .resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(prisma.__users[0]).toMatchObject({ region: 'Littoral', department: null });
  });

  it('refuses the link whose service has left the organigramme since it was made', async () => {
    const { service, link } = withLegacyLink({ serviceCode: 'GONE', positionType: 'STAFF' });
    await expect(service.signUp({ ...PERSON, token: link.token })).rejects.toThrow(BadRequestException);
  });

  it('a central link gives CENTRAL_AGENT on its own service', async () => {
    const { service, prisma, link } = await withLink({ label: 'Central', level: 'central', serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL' });
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'STAFF' }))
      .resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(prisma.__users[0]).toMatchObject({ role: 'CENTRAL_AGENT', serviceCode: 'SG', poste: 'Secrétaire Général' });
  });

  it('a link with no post lets its holder choose, at any depth under the delegation', async () => {
    const { service, prisma, link } = withLegacyLink();
    await service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP-SPE-BAE', positionType: 'STAFF' });
    expect(prisma.__users[0]).toMatchObject({ region: 'Centre', serviceCode: 'DREFOP-SPE-BAE', positionType: 'STAFF', poste: 'Cadre' });
  });

  it('a link with no post refuses a service outside its scope, and an unknown post', async () => {
    const { service, link } = withLegacyLink();
    await expect(service.signUp({ ...PERSON, token: link.token })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DDEFOP-BAG', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'SG', positionType: 'STAFF' })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'MINISTRE' })).rejects.toThrow(BadRequestException);
  });

  it('stops at the use limit', async () => {
    const { service, prisma, link } = await withLink({ ...REGIONAL_LINK, maxUses: 2 });
    await service.signUp({ ...PERSON, email: 'a@m.cm', token: link.token });
    await service.signUp({ ...PERSON, email: 'b@m.cm', token: link.token });
    await expect(service.signUp({ ...PERSON, email: 'c@m.cm', token: link.token })).rejects.toThrow(GoneException);
    expect(prisma.__users).toHaveLength(2);
    await expect(service.preview(link.token)).rejects.toThrow(GoneException);
  });

  it('stops when revoked or expired, and refuses an unknown token', async () => {
    const { service, prisma, link } = await withLink();
    await service.revoke(link.id, ONEFOP);
    await expect(service.signUp({ ...PERSON, token: link.token })).rejects.toThrow(GoneException);

    const other = await withLink();
    other.prisma.__links[0].expiresAt = new Date(Date.now() - 1000);
    await expect(other.service.preview(other.link.token)).rejects.toThrow(GoneException);
    await expect(service.preview('not-a-token')).rejects.toThrow(GoneException);
    await expect(service.preview(undefined)).rejects.toThrow(GoneException);
    expect(prisma.__users).toHaveLength(0);
  });

  it('refuses an email already in use, a missing name and a short password -- without spending a use', async () => {
    const { service, prisma, link } = await withLink();
    await service.signUp({ ...PERSON, token: link.token });
    await expect(service.signUp({ ...PERSON, token: link.token })).rejects.toThrow(ConflictException);
    await expect(service.signUp({ ...PERSON, email: 'n@m.cm', firstName: '', token: link.token })).rejects.toThrow(BadRequestException);
    await expect(service.signUp({ ...PERSON, email: 'p@m.cm', password: 'short', token: link.token })).rejects.toThrow(BadRequestException);
    expect(prisma.__links[0].useCount).toBe(1);
  });

  it('preview names the post the form must show, the scope, and never the creator', async () => {
    const { service, link } = await withLink({
      label: 'DDEFOP Mfoundi', level: 'departmental', region: 'Centre', department: 'Mfoundi',
      serviceCode: 'DDEFOP', positionType: 'STAFF',
    });
    const p = await service.preview(link.token);
    expect(p).toMatchObject({
      label: 'DDEFOP Mfoundi', level: 'departmental', role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi',
      serviceCode: 'DDEFOP', serviceName: 'Délégation Départementale', positionType: 'STAFF', positionTitle: 'Cadre',
    });
    expect(JSON.stringify(p)).not.toContain(SUPER.id);
    expect(JSON.stringify(p)).not.toContain('tokenHash');
  });

  it('preview of a link with no post says so, so the form knows to ask', async () => {
    const { service, link } = withLegacyLink();
    await expect(service.preview(link.token)).resolves.toMatchObject({
      serviceCode: null, serviceName: null, positionType: null, positionTitle: null,
    });
  });
});

/**
 * One link for a whole regional delegation: the regional services and the
 * divisional ones under it. The region is the link's and is never asked; the
 * unit decides the role; a divisional unit then asks for the division, and
 * only the divisions of the link's own region are accepted.
 */
describe('StaffInvitationLinkService territorial link', () => {
  const TERRITORIAL = { label: 'Personnel de la région du Centre', level: 'territorial', region: 'Centre' };

  async function withTerritorialLink(input: any = TERRITORIAL) {
    const ctx = makeService();
    const link = await ctx.service.create(input, SUPER);
    return { ...ctx, link };
  }

  it('is made for a region, with no post and no department', async () => {
    const { service, prisma } = makeService();
    const r = await service.create(TERRITORIAL, ONEFOP);
    expect(r).toMatchObject({
      level: 'territorial', region: 'Centre', department: null,
      serviceCode: null, serviceName: null, positionType: null, positionTitle: null,
      // Which of the two roles it produces is not known until a unit is
      // picked, so the link promises neither.
      role: null,
    });
    expect(prisma.__links[0]).toMatchObject({ serviceCode: null, positionType: null });
  });

  it('needs its region, and a post sent with it is not stored', async () => {
    const { service, prisma } = makeService();
    await expect(service.create({ ...TERRITORIAL, region: '' }, SUPER)).rejects.toThrow(BadRequestException);
    await service.create({ ...TERRITORIAL, serviceCode: 'DREFOP', positionType: 'STAFF' }, SUPER);
    expect(prisma.__links[0]).toMatchObject({ level: 'territorial', serviceCode: null, positionType: null });
  });

  it('a regional unit gives REGIONAL_ADMIN in the link region, with no division asked', async () => {
    const { service, prisma, link } = await withTerritorialLink();
    const { region, ...noRegion } = PERSON;
    await service.signUp({ ...noRegion, token: link.token, serviceCode: 'DREFOP-SPE', positionType: 'CHEF_SERVICE' });
    expect(prisma.__users[0]).toMatchObject({
      role: 'REGIONAL_ADMIN', region: 'Centre', department: null,
      serviceCode: 'DREFOP-SPE', poste: "Chef du Service de la Promotion de l'Emploi",
    });
  });

  it('a divisional unit gives DIVISIONAL_ADMIN, the division chosen inside the link region', async () => {
    const { service, prisma, link } = await withTerritorialLink();
    const { region, ...noRegion } = PERSON;
    await service.signUp({ ...noRegion, token: link.token, serviceCode: 'DDEFOP-BAG', positionType: 'STAFF', department: 'Mfoundi' });
    expect(prisma.__users[0]).toMatchObject({
      role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi', serviceCode: 'DDEFOP-BAG', poste: 'Cadre',
    });
  });

  it('refuses a division of another region, and a division left blank', async () => {
    const { service, prisma, link } = await withTerritorialLink();
    // Wouri is Littoral's: the link pins Centre, so it is not on offer.
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DDEFOP', positionType: 'STAFF', department: 'Wouri' }))
      .rejects.toThrow('Choisissez un département valide pour la région sélectionnée.');
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DDEFOP', positionType: 'STAFF' }))
      .rejects.toThrow('Choisissez un département.');
    expect(prisma.__users).toHaveLength(0);
    expect(prisma.__links[0].useCount).toBe(0);
  });

  it('offers neither a central service nor a post the unit does not have', async () => {
    const { service, link } = await withTerritorialLink();
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL' }))
      .rejects.toThrow('Ce service n\'est pas couvert par ce lien.');
    await expect(service.signUp({ ...PERSON, token: link.token, serviceCode: 'DREFOP', positionType: 'MINISTRE' }))
      .rejects.toThrow("Ce poste n'existe pas dans ce service.");
  });

  it('a central link is unaffected: no territory at all', async () => {
    const { service, prisma, link } = await withTerritorialLink({
      label: 'Services centraux', level: 'central', serviceCode: 'SG', positionType: 'SECRETAIRE_GENERAL',
    });
    await service.signUp({ ...PERSON, token: link.token });
    expect(prisma.__users[0]).toMatchObject({ role: 'CENTRAL_AGENT', region: null, department: null });
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
