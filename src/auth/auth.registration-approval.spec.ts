import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthService } from './auth.service';
import { REGISTRATION_REJECTED_LOGIN_MESSAGE } from '../common/registration-messages';

describe('AuthService company registration approval', () => {
  const companyUser = {
    id: 'u-co',
    email: 'co@example.cm',
    role: 'COMPANY',
    status: 'PENDING_APPROVAL',
    isActive: true,
    passwordHash: 'hash',
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  const company = {
    id: 'c1',
    userId: 'u-co',
    name: 'Menuiserie',
    entityType: 'ENTREPRISE',
    taxNumber: 'M123',
    cnpsNumber: 'CNPS1',
    region: 'Littoral',
    department: 'Wouri',
    subdivision: 'Douala I',
    regionId: 'r-lt',
    departmentId: 'd-wouri',
    subdivisionId: 's-dla1',
    establishmentId: null,
    createdAt: new Date('2026-01-01'),
  };
  const subdivision = { id: 's-dla1', code: '12' };

  let prisma: any;
  let notifications: any;
  let pdf: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(async () => ({ ...companyUser })),
        update: jest.fn(async ({ data }: any) => ({ ...companyUser, ...data })),
      },
      company: {
        findUnique: jest.fn(async () => ({ ...company })),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: any) => ({ ...company, ...data })),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      subdivision: {
        findUnique: jest.fn(async () => ({ ...subdivision })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
      $executeRaw: jest.fn(async () => 1),
      $transaction: jest.fn(async (work: any) => work(prisma)),
    };
    notifications = {
      sendRegistrationApprovedEmail: jest.fn(async () => undefined),
      sendRegistrationRejectedEmail: jest.fn(async () => undefined),
      sendRegistrationComplementsEmail: jest.fn(async () => undefined),
    };
    pdf = { generateRegistrationAttestation: jest.fn(async () => ({ storagePath: 'p', signedUrl: 'u' })) };
    service = new AuthService(prisma, {} as any, notifications, pdf, {} as any);
  });

  it('approves a COMPANY: issues an establishmentId, sets ACTIVE, audits the actor', async () => {
    const result = await service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN');
    expect(result).toMatchObject({ status: 'ACTIVE', isActive: true });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'actor-1',
        action: 'COMPANY_REGISTRATION_APPROVED',
        resourceType: 'User',
        resourceId: 'u-co',
        details: expect.objectContaining({ companyId: 'c1' }),
      }),
    });
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ establishmentId: expect.stringMatching(/^EN\d{6}12$/) }),
    }));
  });

  it('refuses approval when entityType is null', async () => {
    prisma.company.findUnique.mockResolvedValue({ ...company, entityType: null });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries once on a unique violation then succeeds', async () => {
    let attempts = 0;
    prisma.$transaction.mockImplementation(async (work: any) => {
      attempts += 1;
      if (attempts === 1) {
        throw new PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5' } as any);
      }
      return work(prisma);
    });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN')).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(attempts).toBe(2);
  });

  it('rejects a COMPANY with a required reason, sets isActive false, audits', async () => {
    await expect(service.rejectUser('u-co', 'actor-1', 'SUPER_ADMIN', undefined, '')).rejects.toThrow(
      'Le motif de rejet est obligatoire.',
    );
    const result = await service.rejectUser('u-co', 'actor-1', 'SUPER_ADMIN', undefined, 'Dossier incomplet');
    expect(result).toMatchObject({ status: 'REJECTED', isActive: false });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'actor-1',
        action: 'COMPANY_REGISTRATION_REJECTED',
        details: expect.objectContaining({ reason: 'Dossier incomplet' }),
      }),
    });
  });

  it('requests complements and resubmits back to PENDING_APPROVAL', async () => {
    await expect(service.requestComplements('u-co', 'actor-1', 'SUPER_ADMIN', undefined, '')).rejects.toThrow(
      'Le message de demande de compléments est obligatoire.',
    );
    await expect(service.requestComplements('u-co', 'actor-1', 'SUPER_ADMIN', undefined, 'Joindre le NIU')).resolves.toMatchObject({
      status: 'COMPLEMENTS_REQUESTED',
    });
    prisma.user.findUnique.mockResolvedValue({ ...companyUser, status: 'COMPLEMENTS_REQUESTED' });
    await expect(service.resubmitRegistration('u-co')).resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-co',
        action: 'COMPANY_REGISTRATION_RESUBMITTED',
      }),
    });
  });

  it('requires an actor id on approve', async () => {
    await expect(service.approveUser('u-co', '', 'SUPER_ADMIN')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.validateUser company pending login', () => {
  it('lets a COMPANY in PENDING_APPROVAL through after password checks', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'u-co',
          email: 'co@example.cm',
          role: 'COMPANY',
          status: 'PENDING_APPROVAL',
          isActive: true,
          passwordHash: await require('bcrypt').hash('secret', 4),
          failedLoginAttempts: 0,
          lockedUntil: null,
        })),
        update: jest.fn(),
      },
      company: { findFirst: jest.fn() },
    };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any);
    const user = await service.validateUser('co@example.cm', 'secret');
    expect(user).toMatchObject({ id: 'u-co', status: 'PENDING_APPROVAL', role: 'COMPANY' });
  });

  // Mirrors the mock above; each case below differs only in the account row.
  const serviceFor = async (overrides: Record<string, unknown>) => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'u-co',
          email: 'co@example.cm',
          role: 'COMPANY',
          status: 'ACTIVE',
          isActive: true,
          rejectionReason: null,
          passwordHash: await require('bcrypt').hash('secret', 4),
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...overrides,
        })),
        update: jest.fn(),
      },
      company: { findFirst: jest.fn() },
    };
    return new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any);
  };

  it('returns null on a wrong password, without saying why', async () => {
    const service = await serviceFor({});
    await expect(service.validateUser('co@example.cm', 'wrong')).resolves.toBeNull();
  });

  it('refuses a REJECTED registration with a fixed message carrying no reviewer reason', async () => {
    const service = await serviceFor({
      status: 'REJECTED',
      isActive: false,
      rejectionReason: 'Documents illisibles',
    });
    const error = await service.validateUser('co@example.cm', 'secret').catch((e) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(REGISTRATION_REJECTED_LOGIN_MESSAGE);
    expect(error.message).not.toContain('Documents illisibles');
  });

  // The rejection message sits after the password check, so it cannot be
  // probed by someone who does not already hold the credentials.
  it('checks the password before reporting a rejection', async () => {
    const service = await serviceFor({
      status: 'REJECTED',
      isActive: false,
      rejectionReason: 'Documents illisibles',
    });
    await expect(service.validateUser('co@example.cm', 'wrong')).resolves.toBeNull();
  });

  it('keeps the existing message for a suspension that is not a rejection', async () => {
    const service = await serviceFor({ status: 'ACTIVE', isActive: false });
    const error = await service.validateUser('co@example.cm', 'secret').catch((e) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe('Votre compte a été désactivé. Contactez un administrateur.');
  });
});

// Role boundaries for the company-registration review routes. CENTRAL,
// SUPER_ADMIN and SUPER_ADMIN_ONEFOP approve companies nationally; that
// national reach must NOT leak into the staff-registration path, which
// stays on assertCanApproveRegistration / D3.
describe('AuthService registration review — approver role boundaries', () => {
  const company = {
    id: 'c1',
    userId: 'u-co',
    name: 'Menuiserie',
    entityType: 'ENTREPRISE',
    taxNumber: 'M123',
    cnpsNumber: null,
    region: 'Littoral',
    department: 'Wouri',
    subdivision: 'Douala I',
    regionId: 'r-lt',
    departmentId: 'd-wouri',
    subdivisionId: 's-dla1',
    establishmentId: null,
    createdAt: new Date('2026-01-01'),
  };

  function makeService(target: Record<string, unknown>) {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({ ...target })),
        update: jest.fn(async ({ data }: any) => ({ ...target, ...data })),
      },
      company: {
        findUnique: jest.fn(async () => ({ ...company })),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: any) => ({ ...company, ...data })),
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      subdivision: { findUnique: jest.fn(async () => ({ id: 's-dla1', code: '12' })) },
      auditLog: { create: jest.fn(async () => ({})) },
      $executeRaw: jest.fn(async () => 1),
      $transaction: jest.fn(async (work: any) => work(prisma)),
    };
    const notifications = {
      sendRegistrationApprovedEmail: jest.fn(async () => undefined),
      sendRegistrationRejectedEmail: jest.fn(async () => undefined),
      sendRegistrationComplementsEmail: jest.fn(async () => undefined),
    };
    const pdf = { generateRegistrationAttestation: jest.fn(async () => ({ storagePath: 'p', signedUrl: 'u' })) };
    return {
      prisma,
      notifications,
      service: new AuthService(prisma, {} as any, notifications as any, pdf as any, {} as any),
    };
  }

  const pendingCompanyUser = {
    id: 'u-co',
    email: 'co@example.cm',
    role: 'COMPANY',
    status: 'PENDING_APPROVAL',
    isActive: true,
  };

  // A pending staff registration in Littoral/Wouri — inside no CENTRAL
  // territory check, but outside CENTRAL's user-management scope.
  const pendingStaffUser = {
    id: 'u-staff',
    email: 'agent@minefop.cm',
    role: 'REGIONAL',
    status: 'PENDING_APPROVAL',
    isActive: true,
    region: 'Littoral',
    department: 'Wouri',
  };

  it('CENTRAL approves a company registration nationally', async () => {
    const { service, prisma } = makeService(pendingCompanyUser);
    await expect(service.approveUser('u-co', 'actor-central', 'CENTRAL', {})).resolves.toMatchObject({
      status: 'ACTIVE',
      isActive: true,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'actor-central',
        action: 'COMPANY_REGISTRATION_APPROVED',
      }),
    });
  });

  it('SUPER_ADMIN_ONEFOP approves a company registration nationally', async () => {
    const { service } = makeService(pendingCompanyUser);
    await expect(
      service.approveUser('u-co', 'actor-onefop', 'SUPER_ADMIN_ONEFOP', {}),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('CENTRAL still cannot approve a STAFF registration, before any write', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(service.approveUser('u-staff', 'actor-central', 'CENTRAL', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('CENTRAL still cannot reject a STAFF registration, before any write', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(
      service.rejectUser('u-staff', 'actor-central', 'CENTRAL', {}, 'motif'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('emails the company on approval, rejection and complements request', async () => {
    const approved = makeService(pendingCompanyUser);
    await approved.service.approveUser('u-co', 'actor-1', 'CENTRAL', {});
    expect(approved.notifications.sendRegistrationApprovedEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      expect.stringMatching(/^EN\d{6}12$/),
    );

    const rejected = makeService(pendingCompanyUser);
    await rejected.service.rejectUser('u-co', 'actor-1', 'CENTRAL', {}, 'Dossier incomplet');
    expect(rejected.notifications.sendRegistrationRejectedEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      'Dossier incomplet',
    );

    const complements = makeService(pendingCompanyUser);
    await complements.service.requestComplements('u-co', 'actor-1', 'CENTRAL', {}, 'Joindre le NIU');
    expect(complements.notifications.sendRegistrationComplementsEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      'Joindre le NIU',
    );
  });

  it('a failing mail server does not fail the decision', async () => {
    const { service, notifications } = makeService(pendingCompanyUser);
    notifications.sendRegistrationApprovedEmail.mockRejectedValue(new Error('SMTP unreachable'));
    await expect(service.approveUser('u-co', 'actor-1', 'CENTRAL', {})).resolves.toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('CENTRAL cannot request complements on a STAFF account', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(
      service.requestComplements('u-staff', 'actor-central', 'CENTRAL', {}, 'message'),
    ).rejects.toThrow('Les demandes de compléments concernent uniquement les comptes entreprise.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.listCompanyRegistrations — region filter', () => {
  function makeService() {
    const prisma: any = {
      company: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => []),
      },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any) };
  }

  it('applies the region filter server-side, on top of the territory scope', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'REGIONAL', region: 'Littoral' },
      { region: 'Littoral' },
    );
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          region: { equals: 'Littoral', mode: 'insensitive' },
          AND: [{ region: { equals: 'Littoral', mode: 'insensitive' } }],
        }),
      }),
    );
  });

  it('refuses a region outside the actor jurisdiction instead of widening it', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.listCompanyRegistrations({ role: 'REGIONAL', region: 'Littoral' }, { region: 'Centre' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('lets a DIVISIONAL reviewer narrow to its own region', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' },
      { region: 'Littoral' },
    );
    expect(prisma.company.findMany).toHaveBeenCalled();
  });

  it('lets a national role narrow to any region', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'CENTRAL' }, { region: 'Centre' });
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ region: { equals: 'Centre', mode: 'insensitive' } }],
        }),
      }),
    );
  });
});
