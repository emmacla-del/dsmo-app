import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthService } from './auth.service';
import { REGISTRATION_REJECTED_LOGIN_MESSAGE } from '../common/registration-messages';

/**
 * The generator's two raw statements (establishment_serial_ensure, then
 * nextval) against a fresh in-memory sequence: serials 1, 2, 3...
 */
function sequenceQueryRaw() {
  let last = 0;
  return jest.fn(async (strings: TemplateStringsArray) => {
    if (strings.join('?').includes('establishment_serial_ensure')) return [{ seq: 'public.establishment_serial_test' }];
    last += 1;
    return [{ serial: BigInt(last) }];
  });
}

// The reviewer's four marks, as the review dialog sends them once every row
// is ticked. cnpsVerified is ignored for the two types without a CNPS row.
const VERIFIED = { nameVerified: true, phoneVerified: true, contactEmailVerified: true, cnpsVerified: true };

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
  // The account row as the database would hold it, mutated by the writes the
  // service makes. A decision is read back after it is written -- and
  // resubmitRegistration re-reads the row inside its transaction -- so a fixed
  // row would keep reporting a status the service had already moved past.
  // Holding one mutable row lets a test walk the real chain
  // (PENDING_APPROVAL -> COMPLEMENTS_REQUESTED -> PENDING_APPROVAL) instead of
  // hardcoding each intermediate status per test.
  let userRow: Record<string, any>;

  beforeEach(() => {
    userRow = { ...companyUser };
    prisma = {
      user: {
        findUnique: jest.fn(async () => ({ ...userRow })),
        update: jest.fn(async ({ data }: any) => {
          Object.assign(userRow, data);
          return { ...userRow };
        }),
        // Mirrors the conditional flip the service leans on for concurrency:
        // the write lands only while the row still matches `where`, and the
        // count of 0 is what makes a losing resubmission bail out.
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where?.status !== undefined && userRow.status !== where.status) {
            return { count: 0 };
          }
          Object.assign(userRow, data);
          return { count: 1 };
        }),
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
      establishment: {
        create: jest.fn(async ({ data }: any) => ({ id: 'est-1', ...data })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
      $queryRaw: sequenceQueryRaw(),
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
    const result = await service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED);
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

  it('approves a file that already holds its ID: no generation, no ID write, -01 from that ID', async () => {
    // Every file registered since IDs moved to registration arrives like this;
    // only legacy files reach the generator at approval.
    prisma.company.findUnique.mockResolvedValue({ ...company, establishmentId: 'EN26000712' });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).resolves.toMatchObject({ status: 'ACTIVE' });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    // The only company write left is the attestation stamp after COMMIT.
    expect(prisma.company.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ establishmentId: expect.anything() }) }),
    );
    expect(prisma.establishment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'EN26000712-01', isPrincipal: true }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'COMPANY_REGISTRATION_APPROVED',
        details: expect.objectContaining({ establishmentId: 'EN26000712' }),
      }),
    });
  });

  it('approveUser mints -01 Establishment with isPrincipal: true, status: ACTIVE', async () => {
    await service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED);
    expect(prisma.establishment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: expect.stringMatching(/^EN\d{6}12-01$/),
        name: 'Menuiserie',
        isPrincipal: true,
        status: 'ACTIVE',
        companyId: 'c1',
        regionId: 'r-lt',
        departmentId: 'd-wouri',
        subdivisionId: 's-dla1',
        region: 'Littoral',
        department: 'Wouri',
        subdivision: 'Douala I',
        email: 'co@example.cm',
      }),
    });
  });

  it('refuses approval when entityType is null', async () => {
    prisma.company.findUnique.mockResolvedValue({ ...company, entityType: null });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approves with a 4-digit subdivision code and extracts the 2-digit suffix', async () => {
    prisma.subdivision.findUnique.mockResolvedValue({ id: 's-dla1', code: '5801' });
    const result = await service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED);
    expect(result).toMatchObject({ status: 'ACTIVE', isActive: true });
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ establishmentId: expect.stringMatching(/^EN\d{6}01$/) }),
    }));
    expect(prisma.establishment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: expect.stringMatching(/^EN\d{6}01-01$/),
      }),
    });
  });

  it('refuses approval when subdivision code is missing or empty', async () => {
    prisma.subdivision.findUnique.mockResolvedValue({ id: 's-dla1', code: null });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(
      "Code d'arrondissement introuvable pour cet établissement.",
    );

    prisma.subdivision.findUnique.mockResolvedValue({ id: 's-dla1', code: '   ' });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(
      "Code d'arrondissement introuvable pour cet établissement.",
    );
  });

  // The "structure centrale" confirmation. The queue's
  // requiresCentralStructureCheck tells the dialog to show the checkbox; these
  // pin that the server refuses the approval on its own when it is not sent,
  // so the checkbox cannot be bypassed by calling the route directly.
  it('refuses to approve an ADMINISTRATION file without the central-structure confirmation', async () => {
    prisma.company.findUnique.mockResolvedValue({ ...company, entityType: 'ADMINISTRATION' });
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(
      'La confirmation « structure centrale » est obligatoire pour approuver une administration.',
    );
    // Refused before the transaction: no Establishment, no audit row, and
    // the account is left in PENDING_APPROVAL.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(userRow.status).toBe('PENDING_APPROVAL');
  });

  it('approves an ADMINISTRATION file once the confirmation is sent, issuing an AD identifier', async () => {
    prisma.company.findUnique.mockResolvedValue({ ...company, entityType: 'ADMINISTRATION' });
    await expect(
      service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, { ...VERIFIED, centralStructureConfirmed: true }),
    ).resolves.toMatchObject({ status: 'ACTIVE', isActive: true });
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ establishmentId: expect.stringMatching(/^AD\d{6}12$/) }),
    }));
  });

  // Strictly `true`, so the confirmation cannot arrive by accident: a client
  // serialising its form as strings does not get an administration approved.
  it('does not accept a merely truthy central-structure confirmation', async () => {
    prisma.company.findUnique.mockResolvedValue({ ...company, entityType: 'ADMINISTRATION' });
    await expect(
      service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, {
        ...VERIFIED,
        centralStructureConfirmed: 'true' as unknown as boolean,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // The gate is scoped to ADMINISTRATION: every other entity type approves
  // without the flag, as the first test above already does implicitly.
  it('does not require the confirmation for a non-ADMINISTRATION file', async () => {
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
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
    await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).resolves.toMatchObject({ status: 'ACTIVE' });
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
    await expect(service.resubmitRegistration('u-co')).resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-co',
        action: 'COMPANY_REGISTRATION_RESUBMITTED',
      }),
    });
  });

  // The reviewer's marks on the entity's name, phone, contact email and CNPS.
  // The dialog only prompts for them; these pin that the server refuses an
  // approval on its own when one that applies is not strictly `true`.
  describe('verification gate', () => {
    function expectNothingWritten() {
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.company.update).not.toHaveBeenCalled();
      expect(prisma.establishment.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(userRow.status).toBe('PENDING_APPROVAL');
    }

    it('refuses an approval that carries no flags, naming every row, before any write', async () => {
      // The legacy Flutter approve sends no body at all.
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN')).rejects.toThrow(
        "Vérifiez chaque information de l'entité avant d'approuver : Nom de l'entité, " +
          "Téléphone / WhatsApp de l'entité, Email de contact, N° CNPS.",
      );
      expectNothingWritten();
    });

    it.each(['nameVerified', 'phoneVerified', 'contactEmailVerified', 'cnpsVerified'])(
      'refuses when %s is missing, false or merely truthy',
      async (flag) => {
        for (const value of [undefined, false, 'true', 1, null]) {
          await expect(
            service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, { ...VERIFIED, [flag]: value } as any),
          ).rejects.toThrow(BadRequestException);
        }
        expectNothingWritten();
      },
    );

    it('names only the rows still unchecked', async () => {
      await expect(
        service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, { ...VERIFIED, phoneVerified: false, cnpsVerified: undefined }),
      ).rejects.toThrow("avant d'approuver : Téléphone / WhatsApp de l'entité, N° CNPS.");
    });

    it.each(['COOPERATIVE', 'CTD', 'ONG', 'VOCATIONAL_TRAINING'])('requires the CNPS flag for %s', async (entityType) => {
      prisma.company.findUnique.mockResolvedValue({ ...company, entityType });
      const { cnpsVerified, ...threeRows } = VERIFIED;
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, threeRows)).rejects.toThrow(
        "avant d'approuver : N° CNPS.",
      );
      expectNothingWritten();
    });

    it.each([
      ['ADMINISTRATION', { centralStructureConfirmed: true }],
      ['PROJECT_PROGRAM', {}],
    ])('approves %s on the three rows alone, with no CNPS row', async (entityType, extra) => {
      prisma.company.findUnique.mockResolvedValue({ ...company, entityType, cnpsNumber: null });
      const { cnpsVerified, ...threeRows } = VERIFIED;
      await expect(
        service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, { ...threeRows, ...extra }),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
      const { details } = prisma.auditLog.create.mock.calls[0][0].data;
      expect(details.verification).not.toHaveProperty('cnpsVerified');
      expect(details.verification.attested).not.toHaveProperty('cnpsNumber');
    });

    it('records the flags and the values they attest in the approval audit entry', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...company, phone: '655000000', establishmentId: 'EN26000712' });
      await service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'actor-1',
          action: 'COMPANY_REGISTRATION_APPROVED',
          resourceType: 'User',
          resourceId: 'u-co',
          details: {
            companyId: 'c1',
            establishmentId: 'EN26000712',
            verification: {
              nameVerified: true,
              phoneVerified: true,
              contactEmailVerified: true,
              cnpsVerified: true,
              attested: {
                name: 'Menuiserie',
                phone: '655000000',
                contactEmail: 'co@example.cm',
                cnpsNumber: 'CNPS1',
              },
            },
          },
        },
      });
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
        findFirst: jest.fn(async () => ({
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
        findFirst: jest.fn(async () => ({
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
      establishment: { create: jest.fn(async ({ data }: any) => ({ id: 'est-1', ...data })) },
      auditLog: { create: jest.fn(async () => ({})) },
      $queryRaw: sequenceQueryRaw(),
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
    role: 'REGIONAL_ADMIN',
    status: 'PENDING_APPROVAL',
    isActive: true,
    region: 'Littoral',
    department: 'Wouri',
  };

  it('CENTRAL approves a company registration nationally', async () => {
    const { service, prisma } = makeService(pendingCompanyUser);
    await expect(service.approveUser('u-co', 'actor-central', 'ADMIN_ONEFOP', {}, VERIFIED)).resolves.toMatchObject({
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
      service.approveUser('u-co', 'actor-onefop', 'ADMIN_ONEFOP', {}, VERIFIED),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('AUDITOR cannot approve a field-staff registration, before any write', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(service.approveUser('u-staff', 'actor-auditor', 'AUDITOR', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('AUDITOR cannot reject a field-staff registration, before any write', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(
      service.rejectUser('u-staff', 'actor-auditor', 'AUDITOR', {}, 'motif'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('emails the company on approval, rejection and complements request', async () => {
    const approved = makeService(pendingCompanyUser);
    await approved.service.approveUser('u-co', 'actor-1', 'ADMIN_ONEFOP', {}, VERIFIED);
    expect(approved.notifications.sendRegistrationApprovedEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      expect.stringMatching(/^EN\d{6}12$/),
    );

    const rejected = makeService(pendingCompanyUser);
    await rejected.service.rejectUser('u-co', 'actor-1', 'ADMIN_ONEFOP', {}, 'Dossier incomplet');
    expect(rejected.notifications.sendRegistrationRejectedEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      'Dossier incomplet',
    );

    const complements = makeService(pendingCompanyUser);
    await complements.service.requestComplements('u-co', 'actor-1', 'ADMIN_ONEFOP', {}, 'Joindre le NIU');
    expect(complements.notifications.sendRegistrationComplementsEmail).toHaveBeenCalledWith(
      'co@example.cm',
      'Menuiserie',
      'Joindre le NIU',
    );
  });

  it('a failing mail server does not fail the decision', async () => {
    const { service, notifications } = makeService(pendingCompanyUser);
    notifications.sendRegistrationApprovedEmail.mockRejectedValue(new Error('SMTP unreachable'));
    await expect(service.approveUser('u-co', 'actor-1', 'ADMIN_ONEFOP', {}, VERIFIED)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('CENTRAL cannot request complements on a STAFF account', async () => {
    const { service, prisma } = makeService(pendingStaffUser);
    await expect(
      service.requestComplements('u-staff', 'actor-central', 'ADMIN_ONEFOP', {}, 'message'),
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
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
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
      service.listCompanyRegistrations({ role: 'REGIONAL_ADMIN', region: 'Littoral' }, { region: 'Centre' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('lets a DIVISIONAL reviewer narrow to its own region', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
      { region: 'Littoral' },
    );
    expect(prisma.company.findMany).toHaveBeenCalled();
  });

  it('lets a national role narrow to any region', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { region: 'Centre' });
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ region: { equals: 'Centre', mode: 'insensitive' } }],
        }),
      }),
    );
  });
});

describe('AuthService.listCompanyRegistrations — createdBy and status=ALL', () => {
  function makeService() {
    const prisma: any = {
      company: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => []),
      },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any) };
  }

  function whereOf(prisma: any) {
    return prisma.company.findMany.mock.calls[0][0].where;
  }

  it('defaults to the review queue when no status is given', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});
    expect(whereOf(prisma).user).toEqual({
      role: 'COMPANY',
      status: { in: ['PENDING_APPROVAL', 'COMPLEMENTS_REQUESTED'] },
    });
  });

  it('lifts the status filter for status=ALL', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'ALL' });
    expect(whereOf(prisma).user).toEqual({ role: 'COMPANY' });
  });

  it('filters on the registering admin', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'ALL', createdBy: ' agent-1 ' });
    expect(whereOf(prisma).user).toEqual({ role: 'COMPANY', createdBy: 'agent-1' });
  });

  it('keeps the territory scope when filtering by createdBy', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { createdBy: 'agent-1' },
    );
    const where = whereOf(prisma);
    expect(where.region).toEqual({ equals: 'Littoral', mode: 'insensitive' });
    expect(where.user.createdBy).toBe('agent-1');
  });
});

describe('AuthService.listCompanyRegistrations — review fields', () => {
  // The review dialog reads the entity phone (a verified row) and the
  // declarant (context) from the queue row itself; it makes no per-file fetch.
  it('projects the entity phone and the declarant fields', async () => {
    const row = {
      id: 'c1',
      name: 'Menuiserie',
      taxNumber: 'M123',
      cnpsNumber: 'CNPS1',
      subdivisionId: 's-dla1',
      entityType: 'ENTREPRISE',
      region: 'Littoral',
      department: 'Wouri',
      createdAt: new Date('2026-01-01'),
      phone: '655000000',
      respondentFirstName: 'Awa',
      respondentLastName: 'Ngo',
      respondentFunction: 'DRH',
      respondentPhone: '677000000',
      respondentPhone2: null,
      user: {
        id: 'u-co',
        email: 'co@example.cm',
        status: 'PENDING_APPROVAL',
        createdAt: new Date('2026-01-01'),
        approvalComment: null,
        rejectionReason: null,
        registrationNumber: null,
        registrationMethod: 'SELF_SERVICE',
        createdBy: null,
        createdByUser: null,
      },
    };
    const prisma: any = {
      company: { count: jest.fn(async () => 1), findMany: jest.fn().mockResolvedValueOnce([row]).mockResolvedValue([]) },
      auditLog: { findMany: jest.fn(async () => []) },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});
    expect(result.items[0]).toMatchObject({
      organisation: 'Menuiserie',
      email: 'co@example.cm',
      cnpsNumber: 'CNPS1',
      phone: '655000000',
      respondentFirstName: 'Awa',
      respondentLastName: 'Ngo',
      respondentFunction: 'DRH',
      respondentPhone: '677000000',
      respondentPhone2: null,
    });
  });
});
