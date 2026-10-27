/**
 * Database-backed regression test for assisted-registration audit atomicity.
 *
 * Opt-in through `npm run test:pg`; ordinary unit runs never connect to Postgres.
 * The service uses a real interactive Prisma transaction. Only the assisted
 * audit insert is intercepted, after the user, company, and establishment-ID
 * audit have already been written, so this verifies that Postgres rolls all
 * of those writes back when the later audit insert fails.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';

const ENABLED = process.env.PG_INTEGRATION === '1';

function withFailingAssistedAudit(tx: any) {
  return new Proxy(tx, {
    get(target, property) {
      if (property === 'auditLog') {
        const delegate = Reflect.get(target, property, target);
        return new Proxy(delegate, {
          get(auditTarget, method) {
            if (method === 'create') {
              return async (args: any) => {
                if (args.data.action === 'COMPANY_REGISTRATION_ASSISTED') {
                  throw new Error('forced assisted audit failure');
                }
                return auditTarget.create(args);
              };
            }
            const value = Reflect.get(auditTarget, method, auditTarget);
            return typeof value === 'function' ? value.bind(auditTarget) : value;
          },
        });
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function withRealTransactionAndFailingAudit(prisma: PrismaClient) {
  return new Proxy(prisma as any, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (tx: any) => Promise<unknown>, options?: unknown) =>
          target.$transaction(
            (tx: any) => callback(withFailingAssistedAudit(tx)),
            options,
          );
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

(ENABLED ? describe : describe.skip)('assisted registration audit rollback against Postgres', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('leaves no user or company when the assisted audit insert fails', async () => {
    const suffix = randomUUID();
    const email = `pg-assisted-audit-rollback-${suffix}@example.invalid`;
    const companyName = `PG assisted audit rollback ${suffix}`;
    let userId: string | undefined;
    let companyId: string | undefined;

    try {
      const [actor, subdivision] = await Promise.all([
        prisma.user.findFirst({ select: { id: true } }),
        prisma.subdivision.findFirst({
          select: {
            id: true,
            name: true,
            department: {
              select: {
                id: true,
                name: true,
                region: { select: { id: true, name: true } },
              },
            },
          },
        }),
      ]);
      if (!actor) throw new Error('Postgres test database has no user to attribute the audit to.');
      if (!subdivision) throw new Error('Postgres test database has no subdivision for registration.');

      const service = new AuthService(
        withRealTransactionAndFailingAudit(prisma),
        { sign: () => 'unused' } as any,
        { sendEmailVerificationEmail: async () => undefined } as any,
        {} as any,
        { getSettings: async () => ({ passwordMinLength: 8 }) } as any,
      );

      await expect(
        service.adminRegisterCompany(
          {
            email,
            name: companyName,
            mainActivity: 'Integration test',
            region: subdivision.department.region.name,
            regionId: subdivision.department.region.id,
            department: subdivision.department.name,
            departmentId: subdivision.department.id,
            subdivision: subdivision.name,
            subdivisionId: subdivision.id,
            address: 'Postgres rollback test',
            taxNumber: `PG-${suffix}`,
            entityType: 'ENTREPRISE',
          },
          { id: actor.id, role: 'SUPER_ADMIN' },
        ),
      ).rejects.toThrow('forced assisted audit failure');

      const persistedUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      userId = persistedUser?.id;
      const persistedCompany = userId
        ? await prisma.company.findUnique({ where: { userId }, select: { id: true } })
        : null;
      companyId = persistedCompany?.id;

      expect(persistedUser).toBeNull();
      expect(persistedCompany).toBeNull();
    } finally {
      // Defensive cleanup if a regression ever causes partial or full commit.
      const leakedUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId ??= leakedUser?.id;
      if (userId) {
        const leakedCompany = await prisma.company.findUnique({ where: { userId }, select: { id: true } });
        companyId ??= leakedCompany?.id;
      }
      const resourceIds = [userId, companyId].filter((id): id is string => Boolean(id));
      if (resourceIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { resourceId: { in: resourceIds } } });
      }
      await prisma.company.deleteMany({ where: { name: companyName } });
      await prisma.user.deleteMany({ where: { email } });
    }
  }, 120_000);
});
