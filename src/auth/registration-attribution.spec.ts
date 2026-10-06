import { AuthService } from './auth.service';

/**
 * Phase 1 (territorial admin monitoring) — attribution contract.
 *
 * `registrationMethod` and `createdBy` were migrated, indexed and
 * FK-constrained but written by nothing. These tests pin the value each
 * creation path writes, so a later refactor cannot silently drop the
 * attribution and leave the monitoring dashboard counting zeros.
 *
 * The assertions read the `prisma.user.create` payload rather than a DB
 * row: the only database this project can reach is production, so the
 * create call is the deepest layer that can be exercised safely here.
 */

type CreateCall = { data: Record<string, any> };

function makePrisma() {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: CreateCall) => ({ id: 'new-user', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    company: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: CreateCall) => ({ id: 'new-company', ...data })),
    },
    region: {
      findMany: jest.fn(async () => [{ id: 'reg-littoral', name: 'Littoral' }]),
      findUnique: jest.fn(async () => ({ id: 'reg-littoral', name: 'Littoral' })),
    },
    department: {
      findMany: jest.fn(async () => [
        { id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral' },
      ]),
      findFirst: jest.fn(async () => null),
    },
    subdivision: {
      findMany: jest.fn(async () => [
        { id: 'subdiv-douala1', name: 'Douala 1', departmentId: 'dept-wouri' },
      ]),
      findFirst: jest.fn(async () => null),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  return prisma;
}

function makeService(prisma: any) {
  const jwtService = { sign: jest.fn(() => 'signed-token') };
  const notificationService = { sendEmailVerificationEmail: jest.fn(async () => undefined) };
  const systemSettings = { getSettings: jest.fn(async () => ({ passwordMinLength: 8 })) };
  return new AuthService(prisma, jwtService as any, notificationService as any, {} as any, systemSettings as any);
}

/** The `data` passed to the last prisma.user.create call. */
function lastUserCreate(prisma: any): Record<string, any> {
  const calls = prisma.user.create.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0].data;
}

const COMPANY_DATA = {
  name: 'Societe Test',
  mainActivity: 'Commerce',
  region: 'Littoral',
  department: 'Wouri',
  subdivision: 'Douala 1',
  address: 'BP 1234 Douala',
  taxNumber: 'M012345678901A',
  entityType: 'ENTERPRISE',
};

describe('Phase 1 — registrationMethod and createdBy on every creation path', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('public staff self-registration is SELF_REGISTRATION with no creator', async () => {
    await service.register('agent@minefop.cm', 'password123', 'Marie', 'Ebanda', 'REGIONAL_ADMIN', 'Littoral');

    const data = lastUserCreate(prisma);
    expect(data.registrationMethod).toBe('SELF_REGISTRATION');
    // No creating admin exists on a public path — the absence is the signal.
    // Asserted as "no author" rather than on the JS representation: this path
    // omits the key while registerCompany writes an explicit null, and both
    // store NULL. A test that pinned `undefined` would break on a refactor
    // that changed nothing about the column.
    expect(data.createdBy ?? null).toBeNull();
  });

  it('public company registration is SELF_REGISTRATION with no creator', async () => {
    await service.registerCompany('contact@societe.cm', 'password123', COMPANY_DATA);

    const data = lastUserCreate(prisma);
    expect(data.role).toBe('COMPANY');
    expect(data.registrationMethod).toBe('SELF_REGISTRATION');
    expect(data.createdBy ?? null).toBeNull();
    expect(data.assigneeId ?? null).toBeNull();
    expect(data.status).toBe('PENDING_APPROVAL');
  });

  it('admin-created staff is ADMIN_CREATED and records the acting admin', async () => {
    await service.adminCreateMinefopUser(
      { email: 'div@minefop.cm', firstName: 'Div', lastName: 'Agent', role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
      'SUPER_ADMIN',
      'superadmin-id',
    );

    const data = lastUserCreate(prisma);
    expect(data.registrationMethod).toBe('ADMIN_CREATED');
    expect(data.createdBy).toBe('superadmin-id');
  });

  it('exposes both columns on the returned public user', async () => {
    const result = await service.adminCreateMinefopUser(
      { email: 'div2@minefop.cm', firstName: 'Div', lastName: 'Agent', role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
      'SUPER_ADMIN',
      'superadmin-id',
    );

    // Phase 1c moved both out of SECRET_USER_FIELDS, so the admin console
    // can render attribution without a second round trip.
    expect(result.user).toMatchObject({
      registrationMethod: 'ADMIN_CREATED',
      createdBy: 'superadmin-id',
    });
  });
});
