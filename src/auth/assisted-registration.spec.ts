import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Phase 2 (territorial admin monitoring) — admin-assisted registration.
 *
 * Four properties this route must hold, each a real hazard in the design
 * rather than a hypothetical one:
 *
 *  1. Attribution: ASSISTED, createdBy and assigneeId = the acting admin.
 *  2. No session leak. registerCompany ends in this.login(); the assisted
 *     path must not, or the admin receives a token for the declarant's
 *     account.
 *  3. Always queues (DECISION 2), even for ADMINISTRATION, which
 *     auto-approves on the public route.
 *  4. Territorial isolation. A REGIONAL_ADMIN registering outside its
 *     ressort is refused, and the check runs on canonical names.
 */

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-user', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    company: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-company', ...data })),
    },
    region: {
      findMany: jest.fn(async () => [
        { id: 'reg-littoral', name: 'Littoral' },
        { id: 'reg-centre', name: 'Centre' },
      ]),
      findUnique: jest.fn(async () => null),
    },
    department: {
      findMany: jest.fn(async ({ where }: any) =>
        [
          { id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral' },
          { id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre' },
        ].filter((d) => !where?.regionId || d.regionId === where.regionId),
      ),
      findFirst: jest.fn(async () => null),
    },
    subdivision: {
      findMany: jest.fn(async ({ where }: any) =>
        [
          { id: 'sub-douala1', name: 'Douala 1', departmentId: 'dept-wouri' },
          { id: 'sub-yaounde1', name: 'Yaoundé 1', departmentId: 'dept-mfoundi' },
        ].filter((s) => !where?.departmentId || s.departmentId === where.departmentId),
      ),
      findFirst: jest.fn(async () => null),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  } as any;
}

function makeService(prisma: any) {
  const jwtService = { sign: jest.fn(() => 'signed-token') };
  const notificationService = { sendEmailVerificationEmail: jest.fn(async () => undefined) };
  const systemSettings = { getSettings: jest.fn(async () => ({ passwordMinLength: 8 })) };
  return new AuthService(prisma, jwtService as any, notificationService as any, {} as any, systemSettings as any);
}

const LITTORAL_ADMIN = {
  id: 'regional-littoral',
  role: 'REGIONAL_ADMIN',
  region: 'Littoral',
  department: null,
  regionId: null,
  departmentId: null,
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    email: 'contact@societe.cm',
    name: 'Societe Test',
    mainActivity: 'Commerce',
    region: 'Littoral',
    department: 'Wouri',
    subdivision: 'Douala 1',
    address: 'BP 1234 Douala',
    taxNumber: 'M012345678901A',
    entityType: 'ENTERPRISE',
    ...overrides,
  } as any;
}

describe('AuthService.adminRegisterCompany', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('records ASSISTED, the acting admin as author, and the admin as assignee', async () => {
    await service.adminRegisterCompany(body(), LITTORAL_ADMIN as any);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.registrationMethod).toBe('ASSISTED');
    expect(data.createdBy).toBe('regional-littoral');
    expect(data.assigneeId).toBe('regional-littoral');
    expect(data.role).toBe('COMPANY');
  });

  it('queues for approval and issues no session', async () => {
    const result = await service.adminRegisterCompany(body(), LITTORAL_ADMIN as any);

    expect(prisma.user.create.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL');
    // The admin gets a password to hand over, not a token for the account.
    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(result).not.toHaveProperty('access_token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('queues an assisted ADMINISTRATION, which the public route auto-approves', async () => {
    await service.adminRegisterCompany(
      body({ entityType: 'ADMINISTRATION', taxNumber: '' }),
      LITTORAL_ADMIN as any,
    );

    // autoApproveRegistration would have updated the user to ACTIVE and
    // allocated an establishment id. DECISION 2 says it must not run here.
    expect(prisma.user.create.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL');
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
  });

  it("refuses a registration outside the actor's ressort, before any write", async () => {
    await expect(
      service.adminRegisterCompany(
        body({ region: 'Centre', department: 'Mfoundi', subdivision: 'Yaoundé 1' }),
        LITTORAL_ADMIN as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it('checks the ressort against canonical names, not the spelling sent', async () => {
    // 'littoral' resolves to 'Littoral' before the authority check runs, so a
    // lowercase body from the actor's own region is allowed, not refused.
    await expect(
      service.adminRegisterCompany(
        body({ region: 'littoral', department: 'wouri', subdivision: 'douala 1' }),
        LITTORAL_ADMIN as any,
      ),
    ).resolves.toMatchObject({ temporaryPassword: expect.any(String) });

    expect(prisma.user.create.mock.calls[0][0].data.region).toBe('Littoral');
  });

  it('lets a national actor register anywhere', async () => {
    const central = { id: 'super-1', role: 'SUPER_ADMIN', region: null, department: null };
    await expect(
      service.adminRegisterCompany(
        body({ region: 'Centre', department: 'Mfoundi', subdivision: 'Yaoundé 1' }),
        central as any,
      ),
    ).resolves.toMatchObject({ temporaryPassword: expect.any(String) });
  });

  it('journals the assisted registration against the acting admin', async () => {
    await service.adminRegisterCompany(body(), LITTORAL_ADMIN as any);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'regional-littoral',
          action: 'COMPANY_REGISTRATION_ASSISTED',
          resourceType: 'User',
          resourceId: 'new-user',
        }),
      }),
    );
  });
});

describe('AuthService.registerCompany — unchanged by the Phase 2 extraction', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('still self-registers, logs the declarant in, and returns the company block', async () => {
    const result: any = await service.registerCompany('contact@societe.cm', 'password123', body());

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.registrationMethod).toBe('SELF_REGISTRATION');
    expect(data.createdBy).toBeNull();
    expect(data.assigneeId).toBeNull();
    expect(result.access_token).toBe('signed-token');
    expect(result.company).toMatchObject({ id: 'new-company', name: 'Societe Test' });
    expect(result).not.toHaveProperty('temporaryPassword');
  });
});
