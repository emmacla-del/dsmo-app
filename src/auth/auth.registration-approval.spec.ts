import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthService } from './auth.service';
import { registrationDuplicateIds, type RegistrationDuplicateRow } from './registration-duplicates';
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
    phone: '655000000',
    region: 'Littoral',
    department: 'Wouri',
    subdivision: 'Douala I',
    regionId: 'r-lt',
    departmentId: 'd-wouri',
    subdivisionId: 's-dla1',
    establishmentId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
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
          if (where && 'assigneeId' in where && (userRow.assigneeId ?? null) !== where.assigneeId) {
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
        updateMany: jest.fn(async () => ({ count: 1 })),
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
    // Deciding requires holding the claim (owner, 2026-11-08). Most tests are
    // about what a decision does, not who may make it, so the file is held by
    // the officer deciding it unless the test set a holder itself (the claim
    // block below does, null included).
    for (const method of ['approveUser', 'rejectUser', 'requestComplements'] as const) {
      const decide = (service[method] as (...args: any[]) => Promise<unknown>).bind(service);
      (service as any)[method] = (id: string, actor: string, ...rest: unknown[]) => {
        if (!('assigneeId' in userRow) && actor) userRow.assigneeId = actor;
        return decide(id, actor, ...rest);
      };
    }
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
    // Who approved is stored beside approvedAt, so the approval stays
    // attributable after the fact.
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-co', status: 'PENDING_APPROVAL', assigneeId: 'actor-1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        approvedAt: expect.any(Date),
        approvedBy: 'actor-1',
      }),
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
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-co', status: 'PENDING_APPROVAL', assigneeId: 'actor-1' },
      data: expect.objectContaining({
        status: 'REJECTED',
        rejectedAt: expect.any(Date),
        rejectedBy: 'actor-1',
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'actor-1',
        action: 'COMPANY_REGISTRATION_REJECTED',
        details: expect.objectContaining({ reason: 'Dossier incomplet' }),
      }),
    });
  });

  it('records the rejecting actor for a staff registration in the same update', async () => {
    userRow.role = 'DIVISIONAL_ADMIN';
    await service.rejectUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, 'Dossier incomplet');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-co' },
      data: expect.objectContaining({
        status: 'REJECTED',
        rejectedAt: expect.any(Date),
        rejectedBy: 'actor-1',
      }),
    }));
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

  // The attestation is generated after COMMIT and a failure is only logged, so
  // the download is what recovers one.
  describe('attestation recovery', () => {
    const approved = { ...company, establishmentId: 'EN26000712', attestationUrl: null, user: { status: 'ACTIVE', email: 'co@example.cm' } };

    beforeEach(() => {
      pdf.getSignedUrlForPath = jest.fn(async (path: string) => `signed:${path}`);
      prisma.auditLog.findFirst = jest.fn(async () => ({ id: 'audit-1' }));
      prisma.company.findUnique.mockResolvedValue(approved);
    });

    it('issues the attestation a reviewer-approved file is missing, then serves it', async () => {
      await expect(service.getAttestation('u-co')).resolves.toEqual({ url: 'signed:p' });
      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { action: 'COMPANY_REGISTRATION_APPROVED', resourceType: 'User', resourceId: 'u-co' },
      }));
      expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ attestationUrl: 'p' }),
      }));
    });

    it('serves a stored attestation without generating anything', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...approved, attestationUrl: 'stored' });
      await expect(service.getAttestation('u-co')).resolves.toEqual({ url: 'signed:stored' });
      expect(pdf.generateRegistrationAttestation).not.toHaveBeenCalled();
    });

    it('issues nothing for a file no reviewer approved', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);
      await expect(service.getAttestation('u-co')).rejects.toThrow("Aucune attestation n'est disponible");
      expect(pdf.generateRegistrationAttestation).not.toHaveBeenCalled();
    });

    it('issues nothing for an account that is not active', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...approved, user: { status: 'REJECTED', email: 'co@example.cm' } });
      await expect(service.getAttestation('u-co')).rejects.toThrow("Aucune attestation n'est disponible");
      expect(pdf.generateRegistrationAttestation).not.toHaveBeenCalled();
    });

    it('answers the usual refusal when the recovery itself fails', async () => {
      pdf.generateRegistrationAttestation.mockRejectedValue(new Error('storage down'));
      await expect(service.getAttestation('u-co')).rejects.toThrow("Aucune attestation n'est disponible");
    });
  });

  // Company.updatedAt is the file's revision. These walk the real sequences a
  // second reviewer can be caught in, on a row whose revision moves when the
  // service moves it, and pin that a lost race leaves nothing behind.
  describe('a decision lands only on the file as it was read', () => {
    let revision: Date;
    const opened = company.updatedAt.toISOString();

    beforeEach(() => {
      revision = company.updatedAt;
      prisma.company.findUnique.mockImplementation(async () => ({ ...company, updatedAt: revision }));
      prisma.company.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.updatedAt.getTime() !== revision.getTime()) return { count: 0 };
        revision = data.updatedAt;
        return { count: 1 };
      });
      prisma.company.update.mockImplementation(async ({ data }: any) => {
        revision = data.updatedAt ?? new Date(revision.getTime() + 1);
        return { ...company, ...data };
      });
      prisma.user.findFirst = jest.fn(async () => null);
    });

    function expectNothingIssued() {
      expect(prisma.establishment.create).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationApprovedEmail).not.toHaveBeenCalled();
    }

    it('refuses an approval from a page opened before a colleague requested complements', async () => {
      await service.requestComplements('u-co', 'actor-a', 'SUPER_ADMIN', undefined, 'Joindre le NIU');

      await expect(
        service.approveUser('u-co', 'actor-b', 'SUPER_ADMIN', {}, { ...VERIFIED, expectedRevision: opened } as any),
      ).rejects.toThrow(ConflictException);
      expect(userRow.status).toBe('COMPLEMENTS_REQUESTED');
      expectNothingIssued();
    });

    it.each([
      ['an email-only correction', { email: 'nouveau@example.cm' }],
      ['a resubmission with no correction', undefined],
    ])('refuses an approval from a page opened before %s', async (_label, body) => {
      userRow.status = 'COMPLEMENTS_REQUESTED';
      await service.resubmitRegistration('u-co', body as any);

      await expect(
        service.approveUser('u-co', 'actor-b', 'SUPER_ADMIN', {}, { ...VERIFIED, expectedRevision: opened } as any),
      ).rejects.toThrow(ConflictException);
      expect(userRow.status).toBe('PENDING_APPROVAL');
      expectNothingIssued();
    });

    it('accepts the decision once the reviewer has reloaded the new revision', async () => {
      await service.requestComplements('u-co', 'actor-a', 'SUPER_ADMIN', undefined, 'Joindre le NIU');
      // The complements request left the file held by actor-a; actor-b took it
      // over before deciding (the claim rule, 2026-11-08).
      userRow.assigneeId = 'actor-b';

      await expect(
        service.rejectUser('u-co', 'actor-b', 'SUPER_ADMIN', undefined, 'Dossier faux', revision.toISOString()),
      ).resolves.toMatchObject({ status: 'REJECTED' });
    });

    it('answers 409, not 400, to a page still open on a file already decided', async () => {
      userRow.status = 'REJECTED';
      const stale = { ...VERIFIED, expectedRevision: opened } as any;

      await expect(service.approveUser('u-co', 'b', 'SUPER_ADMIN', {}, stale)).rejects.toThrow(ConflictException);
      await expect(service.rejectUser('u-co', 'b', 'SUPER_ADMIN', undefined, 'motif', opened)).rejects.toThrow(ConflictException);
      await expect(service.requestComplements('u-co', 'b', 'SUPER_ADMIN', undefined, 'message', opened)).rejects.toThrow(ConflictException);
    });

    it('keeps the 400 for a caller that names no revision', async () => {
      userRow.status = 'REJECTED';
      await expect(service.rejectUser('u-co', 'b', 'SUPER_ADMIN', undefined, 'motif')).rejects.toThrow(BadRequestException);
    });

    // Both reviewers passed the read; the other one committed first.
    it('leaves no ID, establishment or audit row when an approval loses the race on the status', async () => {
      prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.approveUser('u-co', 'b', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(ConflictException);
      expectNothingIssued();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('sends no email when a rejection loses the race on the status', async () => {
      prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.rejectUser('u-co', 'b', 'SUPER_ADMIN', undefined, 'motif')).rejects.toThrow(ConflictException);
      expect(notifications.sendRegistrationRejectedEmail).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    // Two complements requests leave the status where it was, so only the
    // revision can tell them apart.
    it('refuses a decision when the status still matches but the revision has moved', async () => {
      prisma.company.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.requestComplements('u-co', 'b', 'SUPER_ADMIN', undefined, 'message'),
      ).rejects.toThrow(ConflictException);
      expect(notifications.sendRegistrationComplementsEmail).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it.each([
      ['rejection', () => service.rejectUser('u-co', 'b', 'SUPER_ADMIN', undefined, 'motif'), 'sendRegistrationRejectedEmail'],
      ['complements request', () => service.requestComplements('u-co', 'b', 'SUPER_ADMIN', undefined, 'message'), 'sendRegistrationComplementsEmail'],
    ])('runs a %s and its audit row in one transaction', async (_label, decide, email) => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('audit down'));

      await expect(decide()).rejects.toThrow('audit down');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(notifications[email]).not.toHaveBeenCalled();
    });
  });

  // Owner's decisions, 2026-11-08 (CLAUDE.md §21): only the officer holding
  // the file decides it, as for declarations; a free file is claimed first.
  describe('the claim', () => {
    const decisions: [string, (actor: string) => Promise<unknown>][] = [
      ['approval', (actor) => service.approveUser('u-co', actor, 'SUPER_ADMIN', {}, VERIFIED)],
      ['rejection', (actor) => service.rejectUser('u-co', actor, 'SUPER_ADMIN', undefined, 'Dossier faux')],
      ['complements request', (actor) => service.requestComplements('u-co', actor, 'SUPER_ADMIN', undefined, 'Joindre le NIU')],
    ];

    it.each(decisions)('refuses a %s on a file another officer holds, and writes nothing', async (_label, decide) => {
      userRow.assigneeId = 'officer-a';

      await expect(decide('officer-b')).rejects.toThrow(
        new ConflictException('Un autre agent a réclamé cette inscription. Reprenez-la pour décider.'),
      );
      expect(userRow.status).toBe('PENDING_APPROVAL');
      expect(userRow.assigneeId).toBe('officer-a');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(prisma.establishment.create).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationApprovedEmail).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationRejectedEmail).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationComplementsEmail).not.toHaveBeenCalled();
    });

    it.each(decisions)('lets the holder make a %s', async (_label, decide) => {
      userRow.assigneeId = 'officer-a';

      await expect(decide('officer-a')).resolves.toBeDefined();
      expect(userRow.assigneeId).toBe('officer-a');
    });

    it.each(decisions)('refuses a %s on a free file, and writes nothing', async (_label, decide) => {
      userRow.assigneeId = null;

      await expect(decide('officer-b')).rejects.toThrow(
        new ConflictException('Réclamez cette inscription avant de décider.'),
      );
      expect(userRow.status).toBe('PENDING_APPROVAL');
      expect(userRow.assigneeId).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationApprovedEmail).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationRejectedEmail).not.toHaveBeenCalled();
      expect(notifications.sendRegistrationComplementsEmail).not.toHaveBeenCalled();
    });

    it('answers 409 when a colleague took the file over after it was read', async () => {
      userRow.assigneeId = 'officer-b';
      // Read as held by the decider; taken over by a colleague before the write.
      prisma.user.findUnique.mockImplementationOnce(async () => {
        const read = { ...userRow };
        userRow.assigneeId = 'officer-a';
        return read;
      });

      await expect(
        service.rejectUser('u-co', 'officer-b', 'SUPER_ADMIN', undefined, 'Dossier faux'),
      ).rejects.toThrow(ConflictException);
      expect(userRow.status).toBe('PENDING_APPROVAL');
      expect(userRow.assigneeId).toBe('officer-a');
      expect(notifications.sendRegistrationRejectedEmail).not.toHaveBeenCalled();
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

    // A required row with no value cannot be attested: refused whatever the
    // flags say, with a message that points at a correction, not at a tick.
    it.each([
      ['cnpsNumber', null, "Impossible d'approuver : le N° CNPS est vide. Demandez une correction."],
      ['cnpsNumber', '  ', "Impossible d'approuver : le N° CNPS est vide. Demandez une correction."],
      ['phone', null, "Impossible d'approuver : le téléphone / WhatsApp de l'entité est vide. Demandez une correction."],
      ['name', '', "Impossible d'approuver : le nom de l'entité est vide. Demandez une correction."],
    ])('refuses an empty %s (%p) even with every flag true', async (field, value, message) => {
      prisma.company.findUnique.mockResolvedValue({ ...company, [field]: value });
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(message);
      expectNothingWritten();
    });

    it('refuses an empty contact email', async () => {
      userRow.email = '';
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, VERIFIED)).rejects.toThrow(
        "Impossible d'approuver : l'email de contact est vide. Demandez une correction.",
      );
    });

    it('names every empty row, and checks values before flags', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...company, phone: null, cnpsNumber: null });
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN')).rejects.toThrow(
        "Impossible d'approuver : le téléphone / WhatsApp de l'entité et le N° CNPS sont vides. Demandez une correction.",
      );
      expectNothingWritten();
    });

    it('does not require a CNPS value for PROJECT_PROGRAM', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...company, entityType: 'PROJECT_PROGRAM', cnpsNumber: null });
      const { cnpsVerified, ...threeRows } = VERIFIED;
      await expect(service.approveUser('u-co', 'actor-1', 'SUPER_ADMIN', {}, threeRows)).resolves.toMatchObject({
        status: 'ACTIVE',
      });
    });

    it('records the flags and the values they attest in the approval audit entry', async () => {
      prisma.company.findUnique.mockResolvedValue({ ...company, establishmentId: 'EN26000712' });
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

describe('Phase 2 registration mutation territory checks', () => {
  const user = { id: 'company-user', email: 'target@example.cm', role: 'COMPANY', status: 'PENDING_APPROVAL' };
  const targetCompany = {
    id: 'company-1', userId: user.id, name: 'Target Company', entityType: 'ENTREPRISE',
    taxNumber: 'TAX-1', phone: '699000000', cnpsNumber: 'CNPS1', subdivisionId: 'sub-1',
    region: 'Territory B', department: 'Division B', regionId: 'region-b', departmentId: 'department-b',
    subdivision: 'Sub B', establishmentId: null, createdAt: new Date('2026-01-01'),
  };
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(async () => ({ ...user })),
        update: jest.fn(async ({ data }: any) => ({ ...user, ...data })),
      },
      company: { findUnique: jest.fn(async () => ({ ...targetCompany })) },
      auditLog: { create: jest.fn(async () => ({})) },
      subdivision: { findUnique: jest.fn(async () => ({ id: 'sub-1', code: '01' })) },
      establishment: { create: jest.fn(async () => ({ id: 'est-1' })) },
      $queryRaw: jest.fn(async () => [{ serial: 1n }]),
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    service = new AuthService(
      prisma,
      {} as any,
      {
        sendRegistrationApprovedEmail: jest.fn(async () => undefined),
        sendRegistrationRejectedEmail: jest.fn(async () => undefined),
        sendRegistrationComplementsEmail: jest.fn(async () => undefined),
      } as any,
      { generateRegistrationAttestation: jest.fn(async () => ({ storagePath: 'p', signedUrl: 'u' })) } as any,
      {} as any,
    );
  });

  it('P2-17 refuses REGIONAL_ADMIN approval of an out-of-region company by id', async () => {
    await expect(service.approveUser('company-user', 'actor', 'REGIONAL_ADMIN', { region: 'Territory A' }, VERIFIED))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('P2-18 refuses REGIONAL_ADMIN rejection and complements for an out-of-region company by id', async () => {
    await expect(service.rejectUser('company-user', 'actor', 'REGIONAL_ADMIN', { region: 'Territory A' }, 'Reason long enough'))
      .rejects.toThrow(ForbiddenException);
    await expect(service.requestComplements('company-user', 'actor', 'REGIONAL_ADMIN', { region: 'Territory A' }, 'Please complete this file'))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('P2-19 refuses all three DIVISIONAL_ADMIN registration decisions outside region and department', async () => {
    const territory = { region: 'Territory A', department: 'Division A' };
    await expect(service.approveUser('company-user', 'actor', 'DIVISIONAL_ADMIN', territory, VERIFIED))
      .rejects.toThrow(ForbiddenException);
    await expect(service.rejectUser('company-user', 'actor', 'DIVISIONAL_ADMIN', territory, 'Reason long enough'))
      .rejects.toThrow(ForbiddenException);
    await expect(service.requestComplements('company-user', 'actor', 'DIVISIONAL_ADMIN', territory, 'Please complete this file'))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
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
    // An ENTREPRISE file must hold both to be approvable (empty-value gate).
    cnpsNumber: 'CNPS1',
    phone: '655000000',
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
    const row = { ...target };
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({ ...row })),
        update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
        updateMany: jest.fn(async ({ data }: any) => {
          Object.assign(row, data);
          return { count: 1 };
        }),
      },
      company: {
        findUnique: jest.fn(async () => ({ ...company })),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: any) => ({ ...company, ...data })),
        updateMany: jest.fn(async () => ({ count: 1 })),
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
    const service = new AuthService(prisma, {} as any, notifications as any, pdf as any, {} as any);
    // These tests are about roles, not the claim: the officer deciding holds the file.
    for (const method of ['approveUser', 'rejectUser', 'requestComplements'] as const) {
      const decide = (service[method] as (...args: any[]) => Promise<unknown>).bind(service);
      (service as any)[method] = (id: string, actor: string, ...rest: unknown[]) => {
        if (!('assigneeId' in row) && actor) row.assigneeId = actor;
        return decide(id, actor, ...rest);
      };
    }
    return { prisma, notifications, service };
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
      // The overdue count looks up recent resubmissions (registration-overdue.ts).
      auditLog: { findMany: jest.fn(async () => []) },
      // The status tab counts are one groupBy over COMPANY users.
      user: { groupBy: jest.fn(async () => []) },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any) };
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

  it('sorts registration records oldest-first before pagination when requested', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      { sortOrder: 'oldest', page: 2 },
    );
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        skip: 20,
      }),
    );
  });

  it('keeps registration records newest-first by default', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
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

  it('rejects a DIVISIONAL reviewer requesting another region on both list and CSV before querying', async () => {
    const actor = {
      role: 'DIVISIONAL_ADMIN',
      region: 'Littoral',
      department: 'Wouri',
      departmentId: 'dep-wouri',
    };

    for (const endpoint of ['list', 'export'] as const) {
      const { service, prisma } = makeService();
      const request = endpoint === 'list'
        ? service.listCompanyRegistrations(actor, { region: 'Centre' })
        : service.exportCompanyRegistrations(actor, false, { region: 'Centre' });

      await expect(request).rejects.toThrow(
        'Vous ne pouvez consulter que votre région d\'affectation (Littoral). La région « Centre » est hors de votre ressort. / You can only view your assigned region (Littoral). The region "Centre" is outside your jurisdiction.',
      );
      expect(prisma.company.count).not.toHaveBeenCalled();
      expect(prisma.company.findMany).not.toHaveBeenCalled();
      expect(prisma.user.groupBy).not.toHaveBeenCalled();
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    }
  });

  it('keeps a DIVISIONAL reviewer scoped to its assigned department on list and CSV', async () => {
    const actor = {
      role: 'DIVISIONAL_ADMIN',
      region: 'Littoral',
      department: 'Wouri',
      departmentId: 'dep-wouri',
    };

    for (const endpoint of ['list', 'export'] as const) {
      const { service, prisma } = makeService();
      const request = endpoint === 'list'
        ? service.listCompanyRegistrations(actor, { region: 'Littoral', department: 'Wouri' })
        : service.exportCompanyRegistrations(actor, false, { region: 'Littoral', department: 'Wouri' });
      await request;

      const query = prisma.company.findMany.mock.calls.find((call: any[]) => call[0]?.where)?.[0].where;
      expect(query.departmentId).toBe('dep-wouri');
      expect(query.AND).toEqual([
        { region: { equals: 'Littoral', mode: 'insensitive' } },
        { department: { equals: 'Wouri', mode: 'insensitive' } },
      ]);
    }
  });

  it('preserves valid region filtering for an ID-assigned DIVISIONAL reviewer without department names', async () => {
    const actor = { role: 'DIVISIONAL_ADMIN', region: 'Littoral', departmentId: 'dep-wouri' };

    for (const endpoint of ['list', 'export'] as const) {
      const { service, prisma } = makeService();
      if (endpoint === 'list') {
        await service.listCompanyRegistrations(actor, { region: 'Littoral' });
      } else {
        await service.exportCompanyRegistrations(actor, false, { region: 'Littoral' });
      }

      const query = prisma.company.findMany.mock.calls.find((call: any[]) => call[0]?.where)?.[0].where;
      expect(query.departmentId).toBe('dep-wouri');
      expect(query.AND).toEqual([{ region: { equals: 'Littoral', mode: 'insensitive' } }]);
    }
  });

  it('rejects a DIVISIONAL reviewer filtering by another department on both list and CSV', async () => {
    const actor = {
      role: 'DIVISIONAL_ADMIN',
      region: 'Littoral',
      department: 'Wouri',
      departmentId: 'dep-wouri',
    };

    for (const endpoint of ['list', 'export'] as const) {
      const { service, prisma } = makeService();
      const request = endpoint === 'list'
        ? service.listCompanyRegistrations(actor, { department: 'Mfoundi' })
        : service.exportCompanyRegistrations(actor, false, { department: 'Mfoundi' });

      await expect(request).rejects.toThrow(ForbiddenException);
      expect(prisma.company.count).not.toHaveBeenCalled();
      expect(prisma.company.findMany).not.toHaveBeenCalled();
    }
  });

  it('preserves an unfiltered DIVISIONAL list and CSV inside the assigned department', async () => {
    const actor = {
      role: 'DIVISIONAL_ADMIN',
      region: 'Littoral',
      department: 'Wouri',
      departmentId: 'dep-wouri',
    };

    for (const endpoint of ['list', 'export'] as const) {
      const { service, prisma } = makeService();
      if (endpoint === 'list') await service.listCompanyRegistrations(actor, {});
      else await service.exportCompanyRegistrations(actor, false, {});

      const query = prisma.company.findMany.mock.calls.find((call: any[]) => call[0]?.where)?.[0].where;
      expect(query.departmentId).toBe('dep-wouri');
      expect(query.AND).toBeUndefined();
    }
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

describe('AuthService.listCompanyRegistrations — duplicate selection', () => {
  const identities: RegistrationDuplicateRow[] = [
    { id: 'niu-a', taxNumber: 'M123', cnpsNumber: null, name: 'Alpha', subdivisionId: null },
    { id: 'niu-b', taxNumber: 'M123', cnpsNumber: null, name: 'Beta', subdivisionId: 'sub-b' },
    { id: 'na-a', taxNumber: 'NA-111', cnpsNumber: null, name: 'Gamma', subdivisionId: 'sub-c' },
    { id: 'na-b', taxNumber: 'NA-111', cnpsNumber: null, name: 'Delta', subdivisionId: 'sub-d' },
    { id: 'only', taxNumber: 'M999', cnpsNumber: null, name: 'Seule', subdivisionId: 'sub-e' },
  ];
  const sharedNiu = ['niu-a', 'niu-b'];

  function makeService(rows: RegistrationDuplicateRow[] = identities) {
    const prisma: any = {
      company: {
        count: jest.fn(async () => 0),
        // The duplicate scan selects identity columns and has no where.
        // The page and the CSV query both carry a where.
        findMany: jest.fn(async (args: { where?: unknown }) => (args?.where ? [] : rows)),
      },
      auditLog: { findMany: jest.fn(async () => []) },
      user: { groupBy: jest.fn(async () => []) },
    };
    return {
      prisma,
      service: new AuthService(prisma, {} as any, {} as any, {} as any, { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any),
    };
  }

  function pageWhere(prisma: any) {
    const call = prisma.company.findMany.mock.calls.find((entry: any[]) => entry[0]?.where);
    return call[0].where;
  }

  it('includes a shared NIU for with and excludes it for without, and an NA- placeholder does not count', async () => {
    expect(registrationDuplicateIds(identities)).toEqual(sharedNiu);

    const withDuplicates = makeService();
    await withDuplicates.service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { duplicates: 'with' });
    expect(pageWhere(withDuplicates.prisma).AND).toContainEqual({ id: { in: sharedNiu } });

    const withoutDuplicates = makeService();
    await withoutDuplicates.service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { duplicates: 'without' });
    expect(pageWhere(withoutDuplicates.prisma).AND).toContainEqual({ id: { notIn: sharedNiu } });
  });

  it('leaves the query unchanged when duplicates is absent', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {});
    expect(prisma.company.findMany).toHaveBeenCalledTimes(1);
    expect(pageWhere(prisma).AND).toBeUndefined();
    expect(pageWhere(prisma).id).toBeUndefined();
  });

  it('does not count an NA- placeholder as a duplicate on either side of the filter', async () => {
    const rows: RegistrationDuplicateRow[] = [
      { id: 'na-a', taxNumber: 'NA-111', cnpsNumber: null, name: 'Gamma', subdivisionId: null },
      { id: 'na-b', taxNumber: 'NA-111', cnpsNumber: null, name: 'Delta', subdivisionId: null },
    ];
    const withDuplicates = makeService(rows);
    await withDuplicates.service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { duplicates: 'with' });
    expect(pageWhere(withDuplicates.prisma).AND).toContainEqual({ id: { in: [] } });

    const withoutDuplicates = makeService(rows);
    await withoutDuplicates.service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { duplicates: 'without' });
    expect(pageWhere(withoutDuplicates.prisma).AND).toBeUndefined();
  });

  it('does not replace a fail-closed territory with the duplicate ids', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'REGIONAL_ADMIN' }, { duplicates: 'with' });
    const where = pageWhere(prisma);
    expect(where.id).toEqual({ in: [] });
    expect(where.AND).toContainEqual({ id: { in: sharedNiu } });
  });

  it('rejects an unknown duplicates value before querying', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { duplicates: 'maybe' }),
    ).rejects.toThrow(new BadRequestException('Valeur de doublons inconnue.'));
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('keeps a regional officer inside their region when a duplicate sits in another region', async () => {
    const rows: RegistrationDuplicateRow[] = [
      { id: 'littoral-co', taxNumber: 'M500', cnpsNumber: null, name: 'Littoral SA', subdivisionId: null },
      { id: 'centre-co', taxNumber: 'M500', cnpsNumber: null, name: 'Centre SA', subdivisionId: null },
    ];
    const { service, prisma } = makeService(rows);
    await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { duplicates: 'with' },
    );
    const where = pageWhere(prisma);
    expect(where.region).toEqual({ equals: 'Littoral', mode: 'insensitive' });
    expect(where.AND).toContainEqual({ id: { in: ['littoral-co', 'centre-co'] } });

    const refused = makeService(rows);
    await expect(
      refused.service.listCompanyRegistrations(
        { role: 'REGIONAL_ADMIN', region: 'Littoral' },
        { region: 'Centre', duplicates: 'with' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(refused.prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('applies the same duplicate selection to the registration CSV', async () => {
    const listed = makeService();
    await listed.service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { duplicates: 'with' },
    );
    const exported = makeService();
    await exported.service.exportCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      false,
      { duplicates: 'with' },
    );
    expect(pageWhere(exported.prisma).AND).toEqual(pageWhere(listed.prisma).AND);
    expect(pageWhere(exported.prisma).region).toEqual({ equals: 'Littoral', mode: 'insensitive' });

    const without = makeService();
    await without.service.exportCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, false, { duplicates: 'without' });
    expect(pageWhere(without.prisma).AND).toContainEqual({ id: { notIn: sharedNiu } });

    const assisted = makeService();
    await assisted.service.exportCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      false,
      { view: 'organisations', registrationMethod: 'ASSISTED' },
    );
    expect(pageWhere(assisted.prisma).user.registrationMethod).toBe('ASSISTED');
  });

  it('refuses an out-of-region CSV the same way as the list', async () => {
    const listed = makeService();
    await expect(
      listed.service.listCompanyRegistrations(
        { role: 'REGIONAL_ADMIN', region: 'Littoral' },
        { region: 'Centre' },
      ),
    ).rejects.toThrow(ForbiddenException);
    const exported = makeService();
    await expect(
      exported.service.exportCompanyRegistrations(
        { role: 'REGIONAL_ADMIN', region: 'Littoral' },
        false,
        { region: 'Centre' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(exported.prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('ANDs a requested region onto the actor scope instead of replacing it', async () => {
    const { service, prisma } = makeService();
    await service.exportCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      false,
      { region: 'Littoral' },
    );
    const where = pageWhere(prisma);
    expect(where.region).toEqual({ equals: 'Littoral', mode: 'insensitive' });
    expect(where.AND).toEqual(
      expect.arrayContaining([{ region: { equals: 'Littoral', mode: 'insensitive' } }]),
    );
  });

  it('lifts status=ALL on the queue CSV the same way as the list', async () => {
    const listed = makeService();
    await listed.service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      { view: 'queue', status: 'ALL' },
    );
    const exported = makeService();
    await exported.service.exportCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      false,
      { view: 'queue', status: 'ALL' },
    );
    expect(pageWhere(exported.prisma).user.status).toBeUndefined();
    expect(pageWhere(exported.prisma).user).toEqual(pageWhere(listed.prisma).user);
  });

  it('applies overdue and assignment on the CSV the same way as the list', async () => {
    // Both read the 2-hour claim cutoff from the clock: freeze Date only, so
    // the two calls see the same instant.
    jest.useFakeTimers({ now: new Date('2026-11-09T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask'] });
    try {
    const listed = makeService();
    await listed.service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      { view: 'queue', overdue: true, assigneeId: 'officer-1' },
    );
    const exported = makeService();
    await exported.service.exportCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      false,
      { view: 'queue', overdue: true, assigneeId: 'officer-1' },
    );
    expect(pageWhere(exported.prisma).user).toEqual(pageWhere(listed.prisma).user);
    expect(pageWhere(exported.prisma).user.status).toBe('PENDING_APPROVAL');
    expect(pageWhere(exported.prisma).user.assigneeId).toBe('officer-1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('lists only unclaimed files for unassigned=true, inside the actor scope', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { view: 'queue', status: 'PENDING_APPROVAL', unassigned: true },
    );
    const where = pageWhere(prisma);
    // Free = nobody holds it, or the holder's 2-hour claim has lapsed.
    const free = where.user.AND[0].OR;
    expect(free[0]).toEqual({ assigneeId: null });
    expect(free[1].status).toBe('PENDING_APPROVAL');
    expect(free[1].registrationClaimedAt.lte).toBeInstanceOf(Date);
    expect(where.user.status).toBe('PENDING_APPROVAL');
    expect(JSON.stringify(where)).toContain('Littoral');
  });

  it('lists a lapsed claim with the free files, never under its former holder', async () => {
    const { service, prisma } = makeService();
    const before = Date.now();
    await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { view: 'queue', status: 'PENDING_APPROVAL', assigneeId: 'officer-1' },
    );
    const where = pageWhere(prisma);
    expect(where.user.assigneeId).toBe('officer-1');
    const live = where.user.AND[0].OR;
    expect(live).toEqual(expect.arrayContaining([{ registrationClaimedAt: null }]));
    const cutoff = live.find((clause: any) => clause.registrationClaimedAt?.gt).registrationClaimedAt.gt as Date;
    // Two hours before the request, give or take the test's own run time.
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 5_000);
    expect(before - cutoff.getTime()).toBeLessThanOrEqual(2 * 60 * 60 * 1000 + 5_000);
  });

  it('refuses unassigned together with an assignee', async () => {
    const { service } = makeService();
    await expect(service.listCompanyRegistrations(
      { role: 'ADMIN_ONEFOP' },
      { view: 'queue', unassigned: true, assigneeId: 'officer-1' },
    )).rejects.toThrow('unassigned and assignedToMe are mutually exclusive.');
  });

  it('narrows to a subdivision by ANDing it onto the territory scope', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(
      { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
      { view: 'queue', subdivision: 'Douala 1er' },
    );
    const where = pageWhere(prisma);
    expect(where.AND).toContainEqual({ subdivision: { equals: 'Douala 1er', mode: 'insensitive' } });
    expect(JSON.stringify(where)).toContain('Wouri');
  });

  it('searches the establishment reference as well as name, NIU and CNPS', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { view: 'queue', search: 'EN26' });
    expect(pageWhere(prisma).OR).toContainEqual({ establishmentId: { contains: 'EN26', mode: 'insensitive' } });
  });
});

describe('AuthService.listCompanyRegistrations — duplicate hints', () => {
  function companyRow(partial: Record<string, unknown>) {
    return {
      establishmentId: null,
      entityType: 'ENTREPRISE',
      department: 'Wouri',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      phone: null,
      respondentFirstName: null,
      respondentLastName: null,
      respondentFunction: null,
      respondentPhone: null,
      respondentPhone2: null,
      user: {
        id: `u-${partial.id}`,
        email: `${partial.id}@example.cm`,
        status: 'PENDING_APPROVAL',
        isActive: false,
        createdAt: new Date('2026-01-01'),
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        archivedByUser: null,
        approvalComment: null,
        rejectionReason: null,
        registrationNumber: null,
        registrationMethod: 'SELF_REGISTRATION',
        createdBy: null,
        assigneeId: null,
        assignee: null,
        createdByUser: null,
      },
      ...partial,
    };
  }

  it('flags a cross-territory CNPS match without naming the outside company', async () => {
    const local = companyRow({
      id: 'littoral-co',
      name: 'Littoral SA',
      taxNumber: 'M-L',
      cnpsNumber: 'CNPS-9',
      subdivisionId: 'sub-wouri',
      region: 'Littoral',
      regionId: 'reg-lt',
      departmentId: 'dep-wouri',
    });
    const outside = {
      id: 'centre-co',
      name: 'Centre SA',
      taxNumber: 'M-C',
      cnpsNumber: 'CNPS-9',
      subdivisionId: 'sub-mfoundi',
      region: 'Centre',
      department: 'Mfoundi',
      regionId: 'reg-ce',
      departmentId: 'dep-mfoundi',
    };
    const prisma: any = {
      company: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async (args: { where?: any; include?: unknown; select?: unknown }) => {
          if (!args?.where) return [];
          if (args.where.OR) return [outside];
          return [local];
        }),
      },
      auditLog: { findMany: jest.fn(async () => []) },
      user: { groupBy: jest.fn(async () => []) },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {
      getSettings: async () => ({ registrationOverdueDays: 7 }),
    } as any);
    const result = await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      {},
    );
    expect(result.items[0].duplicateHints).toEqual(['Même numéro CNPS']);
    expect(result.items[0].duplicateHints.join(' ')).not.toContain('Centre SA');
    expect(result.items[0].duplicateFiles).toEqual([]);
  });

  it('names an in-territory match', async () => {
    const local = companyRow({
      id: 'littoral-a',
      name: 'Alpha SA',
      taxNumber: 'M-A',
      cnpsNumber: 'CNPS-1',
      subdivisionId: 'sub-wouri',
      region: 'Littoral',
      regionId: 'reg-lt',
      departmentId: 'dep-wouri',
    });
    const peer = {
      id: 'littoral-b',
      userId: 'u-beta',
      user: { archivedAt: null },
      name: 'Beta SA',
      taxNumber: 'M-B',
      cnpsNumber: 'CNPS-1',
      subdivisionId: 'sub-wouri-2',
      region: 'Littoral',
      department: 'Wouri',
      regionId: 'reg-lt',
      departmentId: 'dep-wouri',
    };
    const prisma: any = {
      company: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async (args: { where?: any }) => {
          if (!args?.where) return [];
          if (args.where.OR) return [peer];
          return [local];
        }),
      },
      auditLog: { findMany: jest.fn(async () => []) },
      user: { groupBy: jest.fn(async () => []) },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {
      getSettings: async () => ({ registrationOverdueDays: 7 }),
    } as any);
    const result = await service.listCompanyRegistrations(
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      {},
    );
    expect(result.items[0].duplicateHints).toEqual(['Même numéro CNPS que « Beta SA »']);
    expect(result.items[0].duplicateFiles).toEqual([{ id: 'u-beta', organisation: 'Beta SA' }]);
    expect(result.items[0].duplicateMatches).toEqual([
      { field: 'cnpsNumber', fileId: 'u-beta', organisation: 'Beta SA' },
    ]);
  });

  describe('files that match', () => {
    const base = {
      id: 'c-a', userId: 'u-a', name: 'Alpha', taxNumber: 'NA-1', cnpsNumber: 'CNPS-9', subdivisionId: null,
      entityType: 'ENTREPRISE', region: 'Littoral', department: 'Wouri', regionId: 'reg-lt', departmentId: 'dep-wouri',
      createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'),
      user: { id: 'u-a', archivedAt: null, status: 'PENDING_APPROVAL', email: 'a@x.cm', createdAt: new Date('2026-10-01') },
    };
    const twin = { ...base, id: 'c-b', userId: 'u-b', name: 'Bravo', user: { ...base.user, id: 'u-b', email: 'b@x.cm' } };

    function list(rows: any[], matches: any[]) {
      const prisma: any = {
        company: {
          count: jest.fn(async () => rows.length),
          findMany: jest.fn(async (args: { where?: any }) => {
            if (!args?.where) return [];
            return args.where.OR ? matches : rows;
          }),
        },
        auditLog: { findMany: jest.fn(async () => []) },
        user: { groupBy: jest.fn(async () => []) },
      };
      const service = new AuthService(prisma, {} as any, {} as any, {} as any, {
        getSettings: async () => ({ registrationOverdueDays: 7 }),
      } as any);
      return service.listCompanyRegistrations({ role: 'SUPER_ADMIN' }, {});
    }

    it('flags two duplicates that sit on the same page, and not a row against itself', async () => {
      const { items } = await list([base, twin], [base, twin]);
      expect(items[0].duplicateHints).toEqual(['Même numéro CNPS que « Bravo »']);
      expect(items[1].duplicateHints).toEqual(['Même numéro CNPS que « Alpha »']);
      expect(items[0].duplicateFiles).toEqual([{ id: 'u-b', organisation: 'Bravo' }]);
    });

    it('offers no link to an archived match, which the review page cannot open', async () => {
      const archived = { ...twin, user: { ...twin.user, archivedAt: new Date('2026-10-02') } };
      const { items } = await list([base], [base, archived]);
      expect(items[0].duplicateHints).toEqual(['Même numéro CNPS que « Bravo »']);
      expect(items[0].duplicateFiles).toEqual([]);
    });
  });
});

describe('AuthService.listCompanyRegistrations — createdBy and status=ALL', () => {
  function makeService() {
    const prisma: any = {
      company: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => []),
      },
      // The overdue count looks up recent resubmissions (registration-overdue.ts).
      auditLog: { findMany: jest.fn(async () => []) },
      // The status tab counts are one groupBy over COMPANY users.
      user: { groupBy: jest.fn(async () => []) },
    };
    return { prisma, service: new AuthService(prisma, {} as any, {} as any, {} as any, { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any) };
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
      archivedAt: null,
    });
  });

  it('lifts the status filter for status=ALL', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'ALL' });
    expect(whereOf(prisma).user).toEqual({ role: 'COMPANY', archivedAt: null });
  });

  it('filters on the registering admin', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'ALL', createdBy: ' agent-1 ' });
    expect(whereOf(prisma).user).toEqual({ role: 'COMPANY', createdBy: 'agent-1', archivedAt: null });
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
      // The status tab counts are one groupBy over COMPANY users.
      user: { groupBy: jest.fn(async () => []) },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any);
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
