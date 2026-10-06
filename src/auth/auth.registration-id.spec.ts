import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * The establishment ID is generated at registration (not approval) for every
 * file, from the (prefix, year) sequence. These tests pin where generation
 * happens in createCompanyRegistration, what it refuses before any write, the
 * issuance audit row, auto-approval reusing the ID, and findIdentifier for a
 * pending file. Assertions read Prisma call payloads: the only database this
 * project can reach is production.
 */

const SERIAL_SQL = 'nextval';

function makePrisma(options: { subdivisionCode?: string | null; auditFails?: boolean } = {}) {
  let last = 0;
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-user', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    company: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => ({ id: 'new-company', ...data })),
      update: jest.fn(async ({ data }: any) => data),
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
      findMany: jest.fn(async () => [
        { id: 'subdiv-douala1', name: 'Douala 1', departmentId: 'dept-wouri' },
      ]),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => ({
        id: 'subdiv-douala1',
        code: options.subdivisionCode === undefined ? '5812' : options.subdivisionCode,
      })),
    },
    establishment: { create: jest.fn(async ({ data }: any) => ({ id: 'est-1', ...data })) },
    auditLog: {
      create: jest.fn(async () => {
        if (options.auditFails) throw new Error('audit down');
        return {};
      }),
    },
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      if (strings.join('?').includes('establishment_serial_ensure')) {
        return [{ seq: 'public.establishment_serial_test' }];
      }
      last += 1;
      return [{ serial: BigInt(last) }];
    }),
  };
  prisma.$transaction = jest.fn(async (work: any) => work(prisma));
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

const LITTORAL_ADMIN = { id: 'regional-littoral', role: 'REGIONAL_ADMIN', region: 'Littoral' };

const nextvalCalls = (prisma: any) =>
  prisma.$queryRaw.mock.calls.filter((c: any[]) => (c[0] as string[]).join('?').includes(SERIAL_SQL));

const auditOf = (prisma: any, action: string) =>
  prisma.auditLog.create.mock.calls.map((c: any[]) => c[0].data).find((d: any) => d.action === action);

describe('createCompanyRegistration — ID generated at registration', () => {
  it('generates the ID before any write and stores it in company.create', async () => {
    const prisma = makePrisma();
    const result = await makeService(prisma).registerCompany('contact@societe.cm', 'password123', COMPANY_DATA);

    const ensureOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    expect(ensureOrder).toBeLessThan(prisma.user.create.mock.invocationCallOrder[0]);
    expect(ensureOrder).toBeLessThan(prisma.company.create.mock.invocationCallOrder[0]);

    const data = prisma.company.create.mock.calls[0][0].data;
    expect(data.establishmentId).toMatch(/^EN\d{2}000112$/);
    expect(data.establishmentIdGeneratedAt).toBeInstanceOf(Date);
    expect(result.company.establishmentId).toBe(data.establishmentId);
    // A pending file: the account stays in review, ID or not.
    expect(prisma.user.create.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL');
    // The -01 Establishment stays approval-time.
    expect(prisma.establishment.create).not.toHaveBeenCalled();
  });

  it('gives an assisted file its ID at creation too', async () => {
    const prisma = makePrisma();
    const result = await makeService(prisma).adminRegisterCompany(
      { ...COMPANY_DATA, email: 'contact@societe.cm' } as any,
      LITTORAL_ADMIN as any,
    );
    expect(result.company.establishmentId).toMatch(/^EN\d{2}000112$/);
  });

  it.each([undefined, '', 'VOCATIONAL_TRAINING_CENTER', 'ENTERPRISE'])(
    'refuses entityType %p with a 400 before any write or serial',
    async (entityType) => {
      const prisma = makePrisma();
      await expect(
        makeService(prisma).registerCompany('contact@societe.cm', 'password123', {
          ...COMPANY_DATA,
          entityType,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.company.create).not.toHaveBeenCalled();
    },
  );

  it('treats a subdivision without a code as a data fault: no serial, no write', async () => {
    const prisma = makePrisma({ subdivisionCode: null });
    await expect(
      makeService(prisma).registerCompany('contact@societe.cm', 'password123', COMPANY_DATA),
    ).rejects.toThrow('has no code');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('uses the last two digits of the subdivision code as the suffix', async () => {
    const prisma = makePrisma({ subdivisionCode: '0307' });
    await makeService(prisma).registerCompany('contact@societe.cm', 'password123', COMPANY_DATA);
    expect(prisma.company.create.mock.calls[0][0].data.establishmentId).toMatch(/^EN\d{2}000107$/);
  });
});

describe('issuance audit row', () => {
  it('records the issued ID against the registrant on self-registration', async () => {
    const prisma = makePrisma();
    await makeService(prisma).registerCompany('contact@societe.cm', 'password123', COMPANY_DATA);

    const row = auditOf(prisma, 'COMPANY_ESTABLISHMENT_ID_ISSUED');
    const issued = prisma.company.create.mock.calls[0][0].data.establishmentId;
    expect(row).toMatchObject({
      userId: 'new-user',
      resourceType: 'Company',
      resourceId: 'new-company',
      details: {
        establishmentId: issued,
        companyId: 'new-company',
        registrantUserId: 'new-user',
        entityType: 'ENTREPRISE',
        registrationMethod: 'SELF_REGISTRATION',
      },
    });
  });

  it('attributes it to the acting admin on the assisted route', async () => {
    const prisma = makePrisma();
    await makeService(prisma).adminRegisterCompany(
      { ...COMPANY_DATA, email: 'contact@societe.cm' } as any,
      LITTORAL_ADMIN as any,
    );
    expect(auditOf(prisma, 'COMPANY_ESTABLISHMENT_ID_ISSUED')).toMatchObject({
      userId: 'regional-littoral',
      details: { registrantUserId: 'new-user', registrationMethod: 'ASSISTED' },
    });
  });

  it('does not fail the registration when the audit write fails', async () => {
    const prisma = makePrisma({ auditFails: true });
    const result = await makeService(prisma).registerCompany('contact@societe.cm', 'password123', COMPANY_DATA);
    expect(result.company.establishmentId).toMatch(/^EN/);
  });
});

describe('public auto-approval reuses the registration ID', () => {
  it('generates once, activates, and builds -01 from that ID', async () => {
    const prisma = makePrisma();
    const result = await makeService(prisma).registerCompany('contact@admin.cm', 'password123', {
      ...COMPANY_DATA,
      entityType: 'ADMINISTRATION',
      taxNumber: '',
    });

    const issued = prisma.company.create.mock.calls[0][0].data.establishmentId;
    expect(issued).toMatch(/^AD\d{2}000112$/);
    expect(nextvalCalls(prisma)).toHaveLength(1);
    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(prisma.establishment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: `${issued}-01`, isPrincipal: true }),
    });
    expect(auditOf(prisma, 'COMPANY_REGISTRATION_AUTO_APPROVED').details.establishmentId).toBe(issued);
    expect(result.user.status).toBe('ACTIVE');
    expect(result.company.establishmentId).toBe(issued);
  });
});

describe('findIdentifier', () => {
  const company = (establishmentId: string | null) => ({
    id: 'c1',
    name: 'Societe Test',
    taxNumber: 'M012345678901A',
    phone: '699 00 00 00',
    establishmentId,
  });

  it('returns the ID of a file still awaiting review (Q3)', async () => {
    const prisma = makePrisma();
    prisma.company.findMany.mockResolvedValue([company('EN26000112')]);
    await expect(
      makeService(prisma).findIdentifier('societe test', 'M012345678901A', '69900 0000'),
    ).resolves.toEqual({ establishmentId: 'EN26000112', companyName: 'Societe Test' });
  });

  it('still answers a legacy file without an ID with the support message', async () => {
    const prisma = makePrisma();
    prisma.company.findMany.mockResolvedValue([company(null)]);
    await expect(
      makeService(prisma).findIdentifier('Societe Test', 'M012345678901A', '699000000'),
    ).rejects.toThrow('Identifiant non disponible');
  });
});
