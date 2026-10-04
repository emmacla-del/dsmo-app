import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
  });

  // What the database holds now. The token below was issued earlier, with a
  // territory that has since changed.
  const dbUser = {
    id: 'u1',
    email: 'agent@minefop.cm',
    role: 'REGIONAL_ADMIN',
    region: 'Centre',
    department: null,
    isActive: true,
    status: 'ACTIVE',
  };
  const accessPayload = { sub: 'u1', email: 'agent@minefop.cm', role: 'REGIONAL_ADMIN', region: 'Littoral', department: null };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(async () => ({ ...dbUser })) } };
    strategy = new JwtStrategy(prisma as any);
  });

  it('accepts an active staff account and returns user with status and isActive', async () => {
    await expect(strategy.validate(accessPayload)).resolves.toEqual({
      id: 'u1',
      email: 'agent@minefop.cm',
      role: 'REGIONAL_ADMIN',
      region: 'Centre', // DB value, not the token's stale 'Littoral'
      department: null,
      status: 'ACTIVE',
      isActive: true,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true, email: true, role: true, region: true, department: true, isActive: true, status: true },
    });
  });

  it('picks up a role change made after the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, role: 'DIVISIONAL_ADMIN', department: 'Mfoundi' });
    await expect(strategy.validate(accessPayload)).resolves.toMatchObject({ role: 'DIVISIONAL_ADMIN', department: 'Mfoundi' });
  });

  it('rejects a suspended staff account with 401', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, isActive: false });
    await expect(strategy.validate(accessPayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a deleted account with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(accessPayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a staff account pending approval with 401', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, status: 'PENDING_APPROVAL' });
    await expect(strategy.validate(accessPayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a rejected staff account with 401', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, status: 'REJECTED' });
    await expect(strategy.validate(accessPayload)).rejects.toThrow(UnauthorizedException);
  });

  describe('Company account authentication', () => {
    const companyPayload = { sub: 'c1', email: 'company@example.com', role: 'COMPANY' };
    const companyDbUser = {
      id: 'c1',
      email: 'company@example.com',
      role: 'COMPANY',
      region: 'Littoral',
      department: 'Wouri',
      isActive: true,
      status: 'ACTIVE',
    };

    it('authenticates active company account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...companyDbUser });
      await expect(strategy.validate(companyPayload)).resolves.toEqual({
        id: 'c1',
        email: 'company@example.com',
        role: 'COMPANY',
        region: 'Littoral',
        department: 'Wouri',
        status: 'ACTIVE',
        isActive: true,
      });
    });

    it('authenticates non-ACTIVE company (e.g. PENDING_APPROVAL) so guards can enforce 403', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...companyDbUser, status: 'PENDING_APPROVAL' });
      await expect(strategy.validate(companyPayload)).resolves.toEqual({
        id: 'c1',
        email: 'company@example.com',
        role: 'COMPANY',
        region: 'Littoral',
        department: 'Wouri',
        status: 'PENDING_APPROVAL',
        isActive: true,
      });
    });

    it('authenticates non-ACTIVE company (e.g. REJECTED)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...companyDbUser, status: 'REJECTED' });
      await expect(strategy.validate(companyPayload)).resolves.toMatchObject({
        role: 'COMPANY',
        status: 'REJECTED',
      });
    });

    it('authenticates inactive company (isActive: false) so ActiveCompanyGuard can deny with 403', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...companyDbUser, isActive: false });
      await expect(strategy.validate(companyPayload)).resolves.toMatchObject({
        role: 'COMPANY',
        isActive: false,
      });
    });

    it('rejects missing company account with 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(strategy.validate(companyPayload)).rejects.toThrow(UnauthorizedException);
    });
  });

  it('rejects a token without a subject, without querying', async () => {
    for (const sub of [undefined, '', 42]) {
      await expect(strategy.validate({ ...accessPayload, sub })).rejects.toThrow(UnauthorizedException);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects the 2FA challenge token as a Bearer token, without querying', async () => {
    await expect(strategy.validate({ sub: 'u1', purpose: '2fa_pending' })).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a purpose claim of any value, including falsy ones', async () => {
    for (const purpose of ['2fa_pending', 'password_reset', 'anything', '', 0, false, null]) {
      await expect(strategy.validate({ ...accessPayload, purpose })).rejects.toThrow(UnauthorizedException);
    }
  });

  it('lets a database failure propagate (500), not a stale-payload fallback or a 401', async () => {
    const outage = new Error('Can\'t reach database server');
    prisma.user.findUnique.mockRejectedValue(outage);
    await expect(strategy.validate(accessPayload)).rejects.toBe(outage);
  });
});
