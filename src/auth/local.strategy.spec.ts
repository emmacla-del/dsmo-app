import { UnauthorizedException } from '@nestjs/common';
import { INVALID_CREDENTIALS_MESSAGE, LocalStrategy } from './local.strategy';
import { translateErrorMessage } from '../common/i18n/error-messages';

describe('LocalStrategy.validate', () => {
  let authService: { validateUser: jest.Mock };
  let strategy: LocalStrategy;

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as any);
  });

  it('returns the user when the credentials are valid', async () => {
    const user = { id: 'u1', email: 'a@b.cm' };
    authService.validateUser.mockResolvedValue(user);
    await expect(strategy.validate('a@b.cm', 'secret')).resolves.toBe(user);
  });

  // validateUser returns null both for an unknown identifier and for a wrong
  // password; the answer must not tell the two apart.
  it('refuses with the one generic message, whatever was wrong', async () => {
    authService.validateUser.mockResolvedValue(null);
    const unknown = strategy.validate('nobody@b.cm', 'secret');
    await expect(unknown).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(unknown).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    await expect(strategy.validate('EN26000112', 'wrong')).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
  });

  it('lets errors thrown by validateUser through (lockout, rejection)', async () => {
    const locked = new UnauthorizedException('Trop de tentatives échouées. Réessayez dans 5 minute(s).');
    authService.validateUser.mockRejectedValue(locked);
    await expect(strategy.validate('a@b.cm', 'secret')).rejects.toBe(locked);
  });

  it('has an English translation', () => {
    expect(translateErrorMessage(INVALID_CREDENTIALS_MESSAGE, 'en')).toBe(
      'Incorrect identifier or password.',
    );
  });
});
