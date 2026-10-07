import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Company login emails are stored trimmed and lowercased, and every lookup by
 * a typed address is case-insensitive, so Jean@x.cm and jean@x.cm are one
 * account. Assertions read the Prisma call payloads: the only database this
 * project can reach is production.
 */

/**
 * The establishment ID generator's two raw statements (ensure, then
 * nextval) against an in-memory sequence: serials 1, 2, 3...
 */
function sequenceQueryRaw() {
  let last = 0;
  return jest.fn(async (strings: TemplateStringsArray) => {
    if (strings.join('?').includes('establishment_serial_ensure')) return [{ seq: 'public.establishment_serial_test' }];
    last += 1;
    return [{ serial: BigInt(last) }];
  });
}

function makePrisma(existing: Record<string, unknown> | null = null) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => existing),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-user', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    company: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-company', ...data })),
    },
    region: {
      findMany: jest.fn(async () => [{ id: 'reg-littoral', name: 'Littoral' }]),
      findUnique: jest.fn(async () => ({ id: 'reg-littoral', name: 'Littoral' })),
    },
    department: {
      findMany: jest.fn(async () => [{ id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral' }]),
      findFirst: jest.fn(async () => null),
    },
    subdivision: {
      // Every subdivision is coded; the ID suffix is the code's last two digits.
      findUnique: jest.fn(async () => ({ code: '5812' })),
      findMany: jest.fn(async () => [
        { id: 'subdiv-douala1', name: 'Douala 1', departmentId: 'dept-wouri' },
      ]),
      findFirst: jest.fn(async () => null),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $queryRaw: sequenceQueryRaw(),
  };
  prisma.$transaction = jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : fn));
  return prisma;
}

function makeService(prisma: any) {
  const jwtService = { sign: jest.fn(() => 'signed-token') };
  const notificationService = { sendEmailVerificationEmail: jest.fn(async () => undefined) };
  const systemSettings = { getSettings: jest.fn(async () => ({ passwordMinLength: 8 })) };
  return new AuthService(prisma, jwtService as any, notificationService as any, {} as any, systemSettings as any);
}

const COMPANY_DATA = {
  name: 'Societe Test',
  mainActivity: 'Commerce',
  region: 'Littoral',
  department: 'Wouri',
  subdivision: 'Douala 1',
  address: 'BP 1234 Douala',
  taxNumber: 'M012345678901A',
  entityType: 'ENTREPRISE',
};

const insensitive = (email: string) => ({ email: { equals: email, mode: 'insensitive' } });

describe('company email normalisation', () => {
  it('public registration stores the email trimmed and lowercased', async () => {
    const prisma = makePrisma();
    await makeService(prisma).registerCompany('  Jean.Dupont@Societe.CM ', 'password123', COMPANY_DATA);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: insensitive('jean.dupont@societe.cm') });
    expect(prisma.user.create.mock.calls[0][0].data.email).toBe('jean.dupont@societe.cm');
  });

  it('public registration refuses a case-variant of an existing email', async () => {
    const prisma = makePrisma({ id: 'u-existing', email: 'jean@x.cm' });
    await expect(
      makeService(prisma).registerCompany('Jean@X.cm', 'password123', COMPANY_DATA),
    ).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('assisted registration stores and audits the normalised email', async () => {
    const prisma = makePrisma();
    await makeService(prisma).adminRegisterCompany(
      { ...COMPANY_DATA, email: 'Contact@Societe.cm' } as any,
      { id: 'regional-littoral', role: 'REGIONAL_ADMIN', region: 'Littoral' } as any,
    );

    expect(prisma.user.create.mock.calls[0][0].data.email).toBe('contact@societe.cm');
    const assisted = prisma.auditLog.create.mock.calls
      .map((c: any[]) => c[0].data)
      .find((d: any) => d.action === 'COMPANY_REGISTRATION_ASSISTED');
    expect(assisted.details.email).toBe('contact@societe.cm');
  });
});

describe('case-insensitive lookups', () => {
  it('check-email reports a case-variant of a taken address as unavailable', async () => {
    const prisma = makePrisma({ id: 'u-existing' });
    await expect(makeService(prisma).isEmailAvailable(' Jean@X.cm ')).resolves.toEqual({ available: false });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: insensitive('Jean@X.cm') });
  });

  it('check-email reports a free address as available', async () => {
    await expect(makeService(makePrisma()).isEmailAvailable('libre@x.cm')).resolves.toEqual({
      available: true,
    });
  });

  it('check-email treats a missing or blank address as unavailable, without a query', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(service.isEmailAvailable('   ')).resolves.toEqual({ available: false });
    await expect(service.isEmailAvailable(undefined as any)).resolves.toEqual({ available: false });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('login looks the email up case-insensitively', async () => {
    const prisma = makePrisma();
    await expect(makeService(prisma).validateUser('Jean@X.cm', 'pw')).resolves.toBeFalsy();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: insensitive('Jean@X.cm') });
  });

  it('forgot-password looks the email up case-insensitively', async () => {
    const prisma = makePrisma();
    await makeService(prisma).forgotPassword('Jean@X.cm');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: insensitive('Jean@X.cm') });
  });
});

describe('staff email normalisation', () => {
  it('adminCreateMinefopUser stores the email lowercased and refuses a case-variant of a taken one', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.adminCreateMinefopUser(
      { email: ' Agent@MINEFOP.cm', firstName: 'Awa', lastName: 'Nkomo', role: 'REGIONAL_ADMIN', region: 'Littoral' },
      'SUPER_ADMIN',
      'actor-1',
    );
    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'agent@minefop.cm' }) });

    const taken = makePrisma({ id: 'u-existing' });
    await expect(
      makeService(taken).adminCreateMinefopUser(
        { email: 'AGENT@minefop.cm', firstName: 'Awa', lastName: 'Nkomo', role: 'REGIONAL_ADMIN', region: 'Littoral' },
        'SUPER_ADMIN',
        'actor-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(taken.user.findFirst).toHaveBeenCalledWith({ where: insensitive('agent@minefop.cm') });
    expect(taken.user.create).not.toHaveBeenCalled();
  });
});
