import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
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
  } = {},
) {
  const company = { ...COMPANY, ...(overrides.company ?? {}) };
  const user = { ...USER, ...(overrides.user ?? {}) };
  const tx = {
    user: {
      updateMany: jest.fn(async () => ({ count: overrides.flipCount ?? 1 })),
      findUnique: jest.fn(async () => ({ ...user, status: 'PENDING_APPROVAL' })),
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
