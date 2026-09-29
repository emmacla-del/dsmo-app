import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
  });

  beforeEach(() => {
    strategy = new JwtStrategy();
  });

  const accessPayload = { sub: 'u1', email: 'agent@minefop.cm', role: 'REGIONAL', region: 'Littoral', department: null };

  it('accepts an access token and returns the request user shape', async () => {
    await expect(strategy.validate(accessPayload)).resolves.toEqual({
      id: 'u1',
      email: 'agent@minefop.cm',
      role: 'REGIONAL',
      region: 'Littoral',
      department: null,
    });
  });

  it('rejects the 2FA challenge token as a Bearer token', async () => {
    await expect(strategy.validate({ sub: 'u1', purpose: '2fa_pending' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a purpose claim of any value, including falsy ones', async () => {
    for (const purpose of ['2fa_pending', 'password_reset', 'anything', '', 0, false, null]) {
      await expect(strategy.validate({ ...accessPayload, purpose })).rejects.toThrow(UnauthorizedException);
    }
  });
});
