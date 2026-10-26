/**
 * Postgres-level test for the group-link sign-up: a territorial link created,
 * used, and refused.
 *
 * WHY THIS FILE EXISTS. Every other test of this flow reaches Prisma through
 * an in-memory stub, which carries no constraints and, more to the point, no
 * DATA. The model rests on what the live organigramme says: that there is one
 * DREFOP carrying requiresRegion and one DDEFOP carrying requiresDepartment,
 * that their services offer posts, and that a department belongs to exactly
 * one region. A stub asserts those things by restating them. This file reads
 * them, and then drives the real create() and signUp() against them -- the
 * blind spot that let the quota index collision through on 2026-10-25.
 *
 * SAFETY. Every test runs inside an interactive transaction that is always
 * rolled back, including when an assertion fails, so no account, no link and
 * no audit entry survives a run. afterAll re-counts all three tables to prove
 * it, and every address written carries a sentinel so a leak would be
 * identifiable at a glance.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1, because the default `npm test`
 * must not reach for a database. Run it with `npm run test:pg`.
 *
 * signUp opens a transaction of its own, which a TransactionClient cannot do,
 * so the client handed to the service runs that callback inline: the write
 * still happens once, inside the outer transaction this file rolls back.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { StaffInvitationLinkService } from './staff-invitation-link.service';
import { GENERIC_POSITION_TYPE } from './service-post';
import type { PrismaService } from '../prisma/prisma.service';
import type { SystemSettingsService } from '../system-settings/system-settings.service';

const ENABLED = process.env.PG_INTEGRATION === '1';
const SENTINEL = 'ROLLBACK_SENTINEL';
const MAIL = 'pg-rollback-sentinel.invalid';

const SETTINGS = { getSettings: async () => ({ passwordMinLength: 8 }) } as unknown as SystemSettingsService;
const PERSON = { firstName: 'Essai', lastName: 'Rollback', matricule: 'PG-000', password: 'long-enough-1' };

(ENABLED ? describe : describe.skip)('group-link sign-up against Postgres', () => {
  let prisma: PrismaClient;
  let actorId: string;
  let regionName: string;
  let departmentName: string;
  let foreignDepartment: string;
  let headPost: { serviceCode: string; positionType: string };
  let counts: { users: number; links: number; audits: number };
  let bootstrapped: string[] = [];

  /**
   * The columns the write needs. When migration 20261025160000 has deployed
   * this only asserts the two are there; when it has not, it adds them inside
   * the test's own transaction so the test still means something before the
   * deploy, and says that it had to.
   */
  async function ensureSchemaUnderTest(tx: Prisma.TransactionClient): Promise<void> {
    const present = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'staff_invitation_links' AND column_name = 'serviceCode'`,
    );
    if (present.length === 0) {
      await tx.$executeRawUnsafe(`ALTER TABLE "staff_invitation_links" ADD COLUMN IF NOT EXISTS "serviceCode" TEXT`);
      await tx.$executeRawUnsafe(`ALTER TABLE "staff_invitation_links" ADD COLUMN IF NOT EXISTS "positionType" TEXT`);
      bootstrapped = ['20261025160000_staff_invitation_link_post'];
    }
  }

  /** Runs `work` in a transaction that is always rolled back. */
  async function inRollback<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    let value!: T;
    let failure: unknown;
    try {
      await prisma.$transaction(
        async (tx) => {
          await ensureSchemaUnderTest(tx);
          try {
            value = await work(tx);
          } catch (error) {
            // Kept so the rollback below still happens, then rethrown.
            failure = error;
          }
          throw new Error(SENTINEL);
        },
        { timeout: 90_000 },
      );
    } catch (error) {
      if (!String((error as Error).message).includes(SENTINEL)) throw error;
    }
    if (failure !== undefined) throw failure;
    return value;
  }

  /** The service, writing through the test's transaction. */
  function serviceOn(tx: Prisma.TransactionClient): StaffInvitationLinkService {
    const client: any = new Proxy(tx as any, {
      get(target, prop) {
        if (prop === '$transaction') return (fn: (inner: unknown) => unknown) => fn(client);
        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return new StaffInvitationLinkService(client as PrismaService, SETTINGS);
  }

  const territorialLink = (tx: Prisma.TransactionClient) =>
    serviceOn(tx).create(
      { label: 'Essai rollback', level: 'territorial', region: regionName },
      { id: actorId, role: 'SUPER_ADMIN' },
    );

  beforeAll(async () => {
    prisma = new PrismaClient();

    const actor =
      (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) ??
      (await prisma.user.findFirst({ select: { id: true } }));
    if (!actor) throw new Error('this database has no user to create a link with');
    actorId = actor.id;

    // What the model assumes about the organigramme, read rather than
    // restated: one template node per delegation level, carrying the
    // territory flags the sign-up drives its questions from.
    const drefop = await prisma.minefopService.findUnique({ where: { code: 'DREFOP' } });
    const ddefop = await prisma.minefopService.findUnique({ where: { code: 'DDEFOP' } });
    if (!drefop || !ddefop) throw new Error('this database has no DREFOP or no DDEFOP');
    expect({ code: drefop.code, role: drefop.roleMapping, region: drefop.requiresRegion, dept: drefop.requiresDepartment })
      .toEqual({ code: 'DREFOP', role: 'REGIONAL_ADMIN', region: true, dept: false });
    expect({ code: ddefop.code, role: ddefop.roleMapping, region: ddefop.requiresRegion, dept: ddefop.requiresDepartment })
      .toEqual({ code: 'DDEFOP', role: 'DIVISIONAL_ADMIN', region: true, dept: true });

    // A region with a division of its own, and a division belonging to
    // another region: the pair the territory rule is about.
    const regions = await prisma.region.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    let chosen: { id: string; name: string } | undefined;
    let chosenDepartment: string | undefined;
    for (const region of regions) {
      const department = await prisma.department.findFirst({ where: { regionId: region.id }, select: { name: true } });
      if (department) {
        chosen = region;
        chosenDepartment = department.name;
        break;
      }
    }
    if (!chosen || !chosenDepartment) throw new Error('this database has no region with a department');
    regionName = chosen.name;
    departmentName = chosenDepartment;
    const foreign = await prisma.department.findFirst({
      where: { regionId: { not: chosen.id } },
      select: { name: true },
    });
    if (!foreign) throw new Error('this database has departments in one region only');
    foreignDepartment = foreign.name;

    // A real head post under DREFOP: the one the occupancy rule is for.
    const post = await prisma.servicePosition.findFirst({
      where: { isActive: true, positionType: { not: GENERIC_POSITION_TYPE }, service: { code: 'DREFOP' } },
      select: { serviceCode: true, positionType: true },
    });
    if (!post) throw new Error('this database has no head post on DREFOP');
    headPost = post;

    counts = {
      users: await prisma.user.count(),
      links: await prisma.staffInvitationLink.count(),
      audits: await prisma.auditLog.count(),
    };
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      const after = {
        users: await prisma.user.count(),
        links: await prisma.staffInvitationLink.count(),
        audits: await prisma.auditLog.count(),
      };
      await prisma.$disconnect();
      // Guards the rollback itself: a leak here means a test wrote to the
      // shared database, which no run of this file may do.
      expect(after).toEqual(counts);
    }
    if (bootstrapped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `staff-signup-pg: schema applied inside the test transaction because it is not deployed yet: ${bootstrapped.join(', ')}`,
      );
    }
  }, 120_000);

  it('creates a territorial link for a real region, with no post and no department', async () => {
    const link = await inRollback(async (tx) => territorialLink(tx));
    expect(link).toMatchObject({
      level: 'territorial',
      region: regionName,
      department: null,
      serviceCode: null,
      positionType: null,
      role: null,
      state: 'active',
    });
    expect(typeof link.token).toBe('string');
  }, 120_000);

  it('a regional unit gives REGIONAL_ADMIN in the link region, asking no territory', async () => {
    const account = await inRollback(async (tx) => {
      const service = serviceOn(tx);
      const link = await service.create(
        { label: 'Essai rollback', level: 'territorial', region: regionName },
        { id: actorId, role: 'SUPER_ADMIN' },
      );
      await service.signUp({
        ...PERSON,
        token: link.token,
        email: `regional@${MAIL}`,
        serviceCode: 'DREFOP',
        positionType: GENERIC_POSITION_TYPE,
      });
      return tx.user.findFirst({
        where: { email: `regional@${MAIL}` },
        select: { role: true, region: true, department: true, serviceCode: true, poste: true, status: true, isActive: true },
      });
    });

    expect(account).toEqual({
      role: 'REGIONAL_ADMIN',
      region: regionName,
      department: null,
      serviceCode: 'DREFOP',
      poste: 'Cadre',
      status: 'PENDING_APPROVAL',
      isActive: false,
    });
  }, 120_000);

  it('a divisional unit takes the division, which must belong to the link region', async () => {
    const result = await inRollback(async (tx) => {
      const service = serviceOn(tx);
      const link = await service.create(
        { label: 'Essai rollback', level: 'territorial', region: regionName },
        { id: actorId, role: 'SUPER_ADMIN' },
      );
      const refused = await service
        .signUp({
          ...PERSON,
          token: link.token,
          email: `foreign@${MAIL}`,
          serviceCode: 'DDEFOP',
          positionType: GENERIC_POSITION_TYPE,
          department: foreignDepartment,
        })
        .then(() => null)
        .catch((error) => error);
      await service.signUp({
        ...PERSON,
        token: link.token,
        email: `divisional@${MAIL}`,
        serviceCode: 'DDEFOP',
        positionType: GENERIC_POSITION_TYPE,
        department: departmentName,
      });
      const account = await tx.user.findFirst({
        where: { email: `divisional@${MAIL}` },
        select: { role: true, region: true, department: true },
      });
      const leak = await tx.user.count({ where: { email: `foreign@${MAIL}` } });
      return { refused, account, leak };
    });

    // A division of another region is not on offer, whatever the request says.
    expect(result.refused).toBeInstanceOf(BadRequestException);
    expect(result.leak).toBe(0);
    expect(result.account).toEqual({
      role: 'DIVISIONAL_ADMIN',
      region: regionName,
      department: departmentName,
    });
  }, 120_000);

  it('refuses a head post the territory already has a holder for', async () => {
    const refused = await inRollback(async (tx) => {
      const service = serviceOn(tx);
      const link = await service.create(
        { label: 'Essai rollback', level: 'territorial', region: regionName },
        { id: actorId, role: 'SUPER_ADMIN' },
      );
      // The incumbent, written and rolled back with everything else.
      await tx.user.create({
        data: {
          email: `incumbent@${MAIL}`,
          passwordHash: 'x',
          firstName: 'Titulaire',
          lastName: 'Rollback',
          role: 'REGIONAL_ADMIN',
          region: regionName,
          serviceCode: headPost.serviceCode,
          positionType: headPost.positionType,
          status: 'ACTIVE',
          isActive: true,
        },
      });
      return service
        .signUp({
          ...PERSON,
          token: link.token,
          email: `second@${MAIL}`,
          serviceCode: headPost.serviceCode,
          positionType: headPost.positionType,
        })
        .then(() => null)
        .catch((error) => error);
    });

    expect(refused).toBeInstanceOf(ConflictException);
  }, 120_000);

  it('preview tells the form the region and that it must ask for the unit', async () => {
    const preview = await inRollback(async (tx) => {
      const service = serviceOn(tx);
      const link = await service.create(
        { label: 'Essai rollback', level: 'territorial', region: regionName },
        { id: actorId, role: 'SUPER_ADMIN' },
      );
      return service.preview(link.token);
    });

    expect(preview).toMatchObject({
      level: 'territorial',
      region: regionName,
      department: null,
      serviceCode: null,
      positionType: null,
      positionTitle: null,
      role: null,
    });
  }, 120_000);
});
