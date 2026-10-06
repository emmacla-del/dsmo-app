import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { REGISTRATION_REJECTED_LOGIN_MESSAGE } from '../common/registration-messages';

/**
 * The login field takes either the account email or the company's
 * establishmentId. The ID is trimmed and upper-cased before its lookup, so a
 * respondent who types "en26000112" on a phone keyboard still gets in.
 * Assertions read the Prisma call payloads: the only database this project
 * can reach is production.
 */

const PASSWORD = 'secret';

async function makePrisma(
  options: {
    emailUser?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
    companyUser?: Record<string, unknown> | null;
  } = {},
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const account = (overrides: Record<string, unknown> | null | undefined) =>
    overrides === null
      ? null
      : {
          id: 'u-co',
          email: 'co@example.cm',
          role: 'COMPANY',
          status: 'ACTIVE',
          isActive: true,
          rejectionReason: null,
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...overrides,
        };
  return {
    user: {
      findFirst: jest.fn(async () => (options.emailUser === undefined ? null : account(options.emailUser))),
      findUnique: jest.fn(async () => account(options.companyUser)),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    company: {
      findFirst: jest.fn(async () =>
        options.company === undefined ? { id: 'c-1', userId: 'u-co' } : options.company,
      ),
    },
  };
}

const makeService = (prisma: any) => new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

describe('AuthService.validateUser by establishment ID', () => {
  it('logs in with the exact ID', async () => {
    const prisma = await makePrisma();
    await expect(makeService(prisma).validateUser('EN26000112', PASSWORD)).resolves.toMatchObject({ id: 'u-co' });
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { establishmentId: 'EN26000112' } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-co' } });
  });

  it('upper-cases a lowercase ID before the lookup', async () => {
    const prisma = await makePrisma();
    await expect(makeService(prisma).validateUser('en26000112', PASSWORD)).resolves.toMatchObject({ id: 'u-co' });
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { establishmentId: 'EN26000112' } });
  });

  it('trims a padded ID before the lookup', async () => {
    const prisma = await makePrisma();
    await expect(makeService(prisma).validateUser('  EN26000112 ', PASSWORD)).resolves.toMatchObject({ id: 'u-co' });
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { establishmentId: 'EN26000112' } });
  });

  it('never looks up an ID when the email matches', async () => {
    const prisma = await makePrisma({ emailUser: {} });
    await expect(makeService(prisma).validateUser('co@example.cm', PASSWORD)).resolves.toMatchObject({ id: 'u-co' });
    expect(prisma.company.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for an unknown ID, with no lockout write', async () => {
    const prisma = await makePrisma({ company: null });
    await expect(makeService(prisma).validateUser('EN99999999', PASSWORD)).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('counts a wrong password against the account the ID resolves to', async () => {
    const prisma = await makePrisma();
    await expect(makeService(prisma).validateUser('en26000112', 'wrong')).resolves.toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-co' },
      data: { failedLoginAttempts: 1 },
    });
  });

  it('lets a pending COMPANY in by ID', async () => {
    const prisma = await makePrisma({ companyUser: { status: 'PENDING_APPROVAL' } });
    await expect(makeService(prisma).validateUser('EN26000112', PASSWORD)).resolves.toMatchObject({
      id: 'u-co',
      status: 'PENDING_APPROVAL',
    });
  });

  it('refuses a rejected company by ID with the fixed message', async () => {
    const prisma = await makePrisma({ companyUser: { status: 'REJECTED', isActive: false } });
    const error = await makeService(prisma)
      .validateUser('EN26000112', PASSWORD)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as Error).message).toBe(REGISTRATION_REJECTED_LOGIN_MESSAGE);
  });

  it('returns null when the company has no user row', async () => {
    const prisma = await makePrisma({ companyUser: null });
    await expect(makeService(prisma).validateUser('EN26000112', PASSWORD)).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
