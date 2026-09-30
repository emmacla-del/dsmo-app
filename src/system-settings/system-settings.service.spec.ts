import { BadRequestException } from '@nestjs/common';
import { SystemSettingsService, validateIdentityFields } from './system-settings.service';

describe('validateIdentityFields', () => {
  it('passes the original fields through untouched', () => {
    const input = { passwordMinLength: 10, maintenanceMode: true, maintenanceMessage: 'x' };
    expect(validateIdentityFields(input)).toEqual(input);
  });

  it('trims identity text and turns blanks into null', () => {
    expect(
      validateIdentityFields({ observatoryName: '  Observatoire  ', timezone: '   ' }),
    ).toEqual({ observatoryName: 'Observatoire', timezone: null });
  });

  it('accepts supported values and explicit null', () => {
    expect(
      validateIdentityFields({ countryCode: 'CM', defaultLanguage: 'en', timezone: 'Africa/Douala', observatoryName: null }),
    ).toEqual({ countryCode: 'CM', defaultLanguage: 'en', timezone: 'Africa/Douala', observatoryName: null });
  });

  it.each([
    [{ countryCode: 'FR' }],
    [{ defaultLanguage: 'de' }],
    [{ timezone: 'Mars/Olympus' }],
    [{ observatoryName: 'x'.repeat(121) }],
    [{ observatoryName: 42 as unknown as string }],
  ])('rejects %j', (input) => {
    expect(() => validateIdentityFields(input)).toThrow(BadRequestException);
  });
});

describe('SystemSettingsService.updateSettings', () => {
  it('writes validated identity fields and refreshes the cache', async () => {
    const upsert = jest.fn().mockImplementation(({ update }) => Promise.resolve({ id: 'singleton', ...update }));
    const service = new SystemSettingsService({ systemSettings: { upsert } } as any);

    const row = await service.updateSettings({ observatoryName: ' ONEFOP ', defaultLanguage: 'fr' }, 'admin-1');

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { observatoryName: 'ONEFOP', defaultLanguage: 'fr', updatedBy: 'admin-1' },
    }));
    expect(await service.getSettings()).toBe(row);
  });

  it('does not write when an identity field is invalid', async () => {
    const upsert = jest.fn();
    const service = new SystemSettingsService({ systemSettings: { upsert } } as any);
    await expect(service.updateSettings({ defaultLanguage: 'xx' }, 'admin-1')).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
