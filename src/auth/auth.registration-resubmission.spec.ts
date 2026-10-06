import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthService } from './auth.service';
import { ResubmitRegistrationDto } from './dto/resubmit-registration.dto';

// The route's own pipe, so these assertions describe what the controller
// actually does with a body rather than what the DTO could allow.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  skipMissingProperties: false,
});
const asBody: ArgumentMetadata = { type: 'body', metatype: ResubmitRegistrationDto };

describe('ResubmitRegistrationDto — what a company may send', () => {
  it('accepts an empty body: a resubmission with no corrections is the status flip alone', async () => {
    await expect(pipe.transform({}, asBody)).resolves.toEqual({});
  });

  // The reason establishmentId is unreachable: it is not on the DTO, and an
  // unknown key is refused outright rather than quietly dropped.
  it('refuses an unknown key', async () => {
    await expect(pipe.transform({ establishmentId: 'LT-01-00001' }, asBody)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ totalEmployees: 40 }, asBody)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses an entityType outside the enum but accepts a real one', async () => {
    await expect(pipe.transform({ entityType: 'NOT_A_TYPE' }, asBody)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ entityType: 'ADMINISTRATION' }, asBody)).resolves.toMatchObject({
      entityType: 'ADMINISTRATION',
    });
  });

  it('refuses a negative or non-numeric socialCapital', async () => {
    await expect(pipe.transform({ socialCapital: -1 }, asBody)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ socialCapital: 'abc' }, asBody)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses a non-string field', async () => {
    await expect(pipe.transform({ name: 42 }, asBody)).rejects.toThrow(BadRequestException);
  });

  it('accepts the entity phone as a string and refuses a non-string one', async () => {
    await expect(pipe.transform({ phone: '655000000' }, asBody)).resolves.toEqual({
      phone: '655000000',
    });
    await expect(pipe.transform({ phone: 655000000 }, asBody)).rejects.toThrow(BadRequestException);
  });

  it('accepts a valid email and refuses a malformed one', async () => {
    await expect(pipe.transform({ email: 'nouveau@example.cm' }, asBody)).resolves.toEqual({
      email: 'nouveau@example.cm',
    });
    for (const email of ['pas-un-email', '', 42]) {
      await expect(pipe.transform({ email }, asBody)).rejects.toThrow(BadRequestException);
    }
  });
});

const COMPANY = {
  id: 'c1',
  userId: 'u-co',
  name: 'Menuiserie Centrale',
  taxNumber: 'M123',
  mainActivity: 'Travail du bois',
  secondaryActivity: null,
  parentCompany: null,
  address: 'Rue 12, Douala',
  cnpsNumber: 'CNPS1',
  fax: null,
  socialCapital: 1_000_000,
  entityType: 'ENTREPRISE',
  region: 'Littoral',
  department: 'Wouri',
  subdivision: 'Douala I',
  regionId: 'r-lt',
  departmentId: 'd-wouri',
  subdivisionId: 's-dla1',
};

const USER = {
  id: 'u-co',
  email: 'co@example.cm',
  role: 'COMPANY',
  status: 'COMPLEMENTS_REQUESTED',
  isActive: true,
  approvalComment: 'NIU illisible',
};

function makeService(
  overrides: {
    user?: Record<string, unknown>;
    company?: Record<string, unknown>;
    flipCount?: number;
    clash?: { id: string } | null;
    emailTaken?: { id: string } | null;
  } = {},
) {
  const company = { ...COMPANY, ...(overrides.company ?? {}) };
  const user = { ...USER, ...(overrides.user ?? {}) };
  const tx = {
    user: {
      updateMany: jest.fn(async () => ({ count: overrides.flipCount ?? 1 })),
      findUnique: jest.fn(async () => ({ ...user, status: 'PENDING_APPROVAL' })),
      findFirst: jest.fn(async (_args: any) => overrides.emailTaken ?? null),
      update: jest.fn(async (_args: any) => user),
    },
    company: {
      update: jest.fn(async () => company),
      findFirst: jest.fn(async () => overrides.clash ?? null),
      findUnique: jest.fn(async () => company),
    },
    auditLog: { create: jest.fn(async (_args: any) => ({})) },
    // The canonical territory records the resolver reads. Deliberately a
    // different region from the company's, so a move is observable.
    region: { findUnique: jest.fn(async () => ({ id: 'r-ce', name: 'Centre' })) },
    department: {
      findUnique: jest.fn(async () => ({ id: 'd-mfoundi', name: 'Mfoundi', regionId: 'r-ce' })),
    },
    subdivision: {
      findUnique: jest.fn(async () => ({
        id: 's-yde1',
        name: 'Yaoundé I',
        departmentId: 'd-mfoundi',
      })),
    },
  };
  const prisma: any = {
    user: { findUnique: jest.fn(async () => user) },
    company: { findUnique: jest.fn(async () => company) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any), prisma, tx };
}

const auditDetails = (tx: ReturnType<typeof makeService>['tx']) =>
  (tx.auditLog.create.mock.calls[0][0] as any).data.details;

describe('AuthService.resubmitRegistration', () => {
  it('with no body, flips the status and writes nothing to Company', async () => {
    const { service, tx } = makeService();
    const result = await service.resubmitRegistration('u-co');

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-co', status: 'COMPLEMENTS_REQUESTED' },
      data: { status: 'PENDING_APPROVAL' },
    });
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(auditDetails(tx)).toMatchObject({ companyId: 'c1', changes: {} });
    expect(result).toMatchObject({ status: 'PENDING_APPROVAL' });
  });

  it('writes only the fields that changed and audits a before/after diff', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      // name and cnpsNumber are resent unchanged; only taxNumber moves.
      name: 'Menuiserie Centrale',
      cnpsNumber: 'CNPS1',
      taxNumber: 'M999',
    } as ResubmitRegistrationDto);

    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { taxNumber: 'M999' },
    });
    expect(auditDetails(tx).changes).toEqual({ taxNumber: { before: 'M123', after: 'M999' } });
  });

  it('refuses a resubmission when no complements were requested, before opening a transaction', async () => {
    const { service, prisma } = makeService({ user: { status: 'PENDING_APPROVAL' } });
    await expect(service.resubmitRegistration('u-co')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a non-company account', async () => {
    const { service } = makeService({ user: { role: 'DIVISIONAL_ADMIN' } });
    await expect(service.resubmitRegistration('u-co')).rejects.toThrow(BadRequestException);
  });

  // The race: a reviewer decided (or another tab resubmitted) between the read
  // and the write. The conditional updateMany matches nothing, and the
  // corrections must not be half-applied.
  it('409s when the status moved under it, and never touches Company or the audit log', async () => {
    const { service, tx } = makeService({ flipCount: 0 });
    await expect(
      service.resubmitRegistration('u-co', { name: 'Autre nom' } as ResubmitRegistrationDto),
    ).rejects.toThrow(ConflictException);
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('409s when the new taxNumber belongs to another company, excluding its own row', async () => {
    const { service, tx } = makeService({ clash: { id: 'c2' } });
    await expect(
      service.resubmitRegistration('u-co', { taxNumber: 'M999' } as ResubmitRegistrationDto),
    ).rejects.toThrow(ConflictException);
    expect(tx.company.findFirst).toHaveBeenCalledWith({
      where: { taxNumber: 'M999', id: { not: 'c1' } },
      select: { id: true },
    });
    expect(tx.company.update).not.toHaveBeenCalled();
  });

  it('resolves a territory move on the transaction client and persists only resolved values', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      regionId: 'r-ce',
      departmentId: 'd-mfoundi',
      subdivisionId: 's-yde1',
      // Names sent alongside ids are ignored: ids win in the resolver, and only
      // what the canonical records say is persisted.
      region: 'Pas celle-là',
      department: 'Ignoré',
      subdivision: 'Ignoré',
    } as ResubmitRegistrationDto);

    expect(tx.region.findUnique).toHaveBeenCalled();
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        region: 'Centre',
        department: 'Mfoundi',
        subdivision: 'Yaoundé I',
        regionId: 'r-ce',
        departmentId: 'd-mfoundi',
        subdivisionId: 's-yde1',
      },
    });
    expect(auditDetails(tx).changes).toMatchObject({
      region: { before: 'Littoral', after: 'Centre' },
      department: { before: 'Wouri', after: 'Mfoundi' },
    });
  });

  it('refuses a partial territory chain rather than half-moving the file', async () => {
    const { service, tx } = makeService();
    await expect(
      service.resubmitRegistration('u-co', { regionId: 'r-ce' } as ResubmitRegistrationDto),
    ).rejects.toThrow(BadRequestException);
    expect(tx.company.update).not.toHaveBeenCalled();
  });

  it('lets a company correct entityType, which is a field change and nothing more', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      entityType: 'ADMINISTRATION',
    } as ResubmitRegistrationDto);

    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { entityType: 'ADMINISTRATION' },
    });
    expect(auditDetails(tx).changes).toEqual({
      entityType: { before: 'ENTREPRISE', after: 'ADMINISTRATION' },
    });
  });
});

describe('AuthService.resubmitRegistration — entity phone and email', () => {
  it('writes a changed entity phone through company.update and audits it', async () => {
    const { service, tx } = makeService({ company: { phone: '655000000' } });
    await service.resubmitRegistration('u-co', { phone: '699000000' } as ResubmitRegistrationDto);

    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { phone: '699000000' },
    });
    expect(auditDetails(tx).changes).toEqual({
      phone: { before: '655000000', after: '699000000' },
    });
  });

  it('stores a corrected email trimmed and lowercased', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      email: '  Nouveau@Example.CM ',
    } as ResubmitRegistrationDto);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-co' },
      data: { email: 'nouveau@example.cm' },
    });
    expect(auditDetails(tx).changes.email).toEqual({
      before: 'co@example.cm',
      after: 'nouveau@example.cm',
    });
  });

  it('treats a case-only variant of the current email as no change', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', { email: 'CO@Example.cm' } as ResubmitRegistrationDto);

    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('writes a changed email to User, not Company, and audits it', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      email: 'nouveau@example.cm',
    } as ResubmitRegistrationDto);

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: 'nouveau@example.cm', mode: 'insensitive' },
        id: { not: 'u-co' },
      },
      select: { id: true },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-co' },
      data: { email: 'nouveau@example.cm' },
    });
    // Email-only correction: nothing for Company.
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(auditDetails(tx).changes).toEqual({
      email: { before: 'co@example.cm', after: 'nouveau@example.cm' },
    });
  });

  it('leaves emailVerified alone when the email changes', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', {
      email: 'nouveau@example.cm',
    } as ResubmitRegistrationDto);

    const data = (tx.user.update.mock.calls[0][0] as any).data;
    expect(data).toEqual({ email: 'nouveau@example.cm' });
  });

  it('writes and audits nothing for an unchanged email', async () => {
    const { service, tx } = makeService();
    await service.resubmitRegistration('u-co', { email: 'co@example.cm' } as ResubmitRegistrationDto);

    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(auditDetails(tx).changes).toEqual({});
  });

  it('409s with an email-specific message when the email belongs to another account, and writes nothing', async () => {
    const { service, tx } = makeService({ emailTaken: { id: 'u-other' } });
    const attempt = service.resubmitRegistration('u-co', {
      email: 'pris@example.cm',
      name: 'Autre nom',
    } as ResubmitRegistrationDto);

    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toThrow('Un utilisateur avec cet email existe déjà');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('maps a P2002 race on the user write to the email 409, not the NIU one', async () => {
    const { service, tx } = makeService();
    tx.user.update.mockRejectedValueOnce(
      new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.resubmitRegistration('u-co', { email: 'nouveau@example.cm' } as ResubmitRegistrationDto),
    ).rejects.toThrow('Un utilisateur avec cet email existe déjà');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.listCompanyRegistrations — resubmission diff and ADMINISTRATION flag', () => {
  const COMPLEMENTS_AT = new Date('2026-03-01T10:00:00Z');
  const RESUBMITTED_AT = new Date('2026-03-02T10:00:00Z');

  function makeQueueService(entityType: string | null, auditRows: any[]) {
    const row = {
      id: 'c1',
      name: 'Menuiserie Centrale',
      taxNumber: 'NA-placeholder',
      cnpsNumber: null,
      subdivisionId: 's-dla1',
      entityType,
      region: 'Littoral',
      department: 'Wouri',
      createdAt: new Date('2026-02-01'),
      user: {
        id: 'u-co',
        email: 'co@example.cm',
        status: 'PENDING_APPROVAL',
        createdAt: new Date('2026-01-01'),
        approvalComment: 'NIU illisible',
        rejectionReason: null,
        registrationNumber: 'INS-2026-0001',
      },
    };
    const prisma: any = {
      company: {
        count: jest.fn(async () => 1),
        // The second call is the duplicate-hint lookup, which excludes the rows
        // already in hand; it must not be served this same row back.
        findMany: jest.fn(async (args: any) => (args?.where?.id?.notIn ? [] : [row])),
      },
      auditLog: { findMany: jest.fn(async () => auditRows) },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any) };
  }

  const resubmittedRow = {
    action: 'COMPANY_REGISTRATION_RESUBMITTED',
    resourceId: 'u-co',
    createdAt: RESUBMITTED_AT,
    details: { companyId: 'c1', changes: { taxNumber: { before: 'NA-x', after: 'M999' } } },
  };
  const complementsRow = {
    action: 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED',
    resourceId: 'u-co',
    createdAt: COMPLEMENTS_AT,
    details: { companyId: 'c1', message: 'NIU illisible' },
  };

  it('surfaces the last resubmission diff when it is newer than the complements request', async () => {
    const { service } = makeQueueService('ENTREPRISE', [resubmittedRow, complementsRow]);
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});

    expect(result.items[0].lastResubmission).toEqual({
      at: RESUBMITTED_AT,
      changes: { taxNumber: { before: 'NA-x', after: 'M999' } },
    });
  });

  // A second round of complements was requested after the company's last
  // correction, so that diff is stale and must not be shown next to the new
  // request.
  it('reports no resubmission when complements were requested again afterwards', async () => {
    const staleResubmission = { ...resubmittedRow, createdAt: new Date('2026-02-20T10:00:00Z') };
    const { service } = makeQueueService('ENTREPRISE', [complementsRow, staleResubmission]);
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});

    expect(result.items[0].lastResubmission).toBeNull();
  });

  it('reports no resubmission on a file that has never been resubmitted', async () => {
    const { service } = makeQueueService('ENTREPRISE', [complementsRow]);
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});

    expect(result.items[0].lastResubmission).toBeNull();
  });

  it('flags an ADMINISTRATION file for the central-structure check, and only that one', async () => {
    const admin = await makeQueueService('ADMINISTRATION', []).service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      {},
    );
    expect(admin.items[0].requiresCentralStructureCheck).toBe(true);

    const entreprise = await makeQueueService('ENTREPRISE', []).service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      {},
    );
    expect(entreprise.items[0].requiresCentralStructureCheck).toBe(false);
  });
});
