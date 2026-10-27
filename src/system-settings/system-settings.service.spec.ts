import { BadRequestException } from '@nestjs/common';
import { SystemSettingsService, validateIdentityFields } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';

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
    [{ registrationOverdueDays: 0 }],
    [{ registrationOverdueDays: 91 }],
    [{ registrationOverdueDays: 2.5 }],
    [{ registrationOverdueDays: '7' as unknown as number }],
  ])('rejects %j', (input) => {
    expect(() => validateIdentityFields(input)).toThrow(BadRequestException);
  });

  it('accepts an overdue threshold from 1 to 90 days', () => {
    expect(validateIdentityFields({ registrationOverdueDays: 1 })).toEqual({ registrationOverdueDays: 1 });
    expect(validateIdentityFields({ registrationOverdueDays: 90 })).toEqual({ registrationOverdueDays: 90 });
  });
});

describe('SystemSettingsService.updateSettings', () => {
  it('P2-28 writes an audit row for validated settings updates and refreshes the cache', async () => {
    const upsert = jest.fn().mockImplementation(({ update }) => Promise.resolve({ id: 'singleton', ...update }));
    const auditCreate = jest.fn(async () => ({}));
    const service = new SystemSettingsService({ systemSettings: { upsert }, auditLog: { create: auditCreate } } as any);
    const controller = new SystemSettingsController(service);

    const row = await controller.updateSettings(
      { observatoryName: ' ONEFOP ', defaultLanguage: 'fr' },
      { user: { id: 'admin-1' } },
    );

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { observatoryName: 'ONEFOP', defaultLanguage: 'fr', updatedBy: 'admin-1' },
    }));
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'SYSTEM_SETTINGS_UPDATED',
        resourceType: 'SystemSettings',
        resourceId: 'singleton',
        details: { updatedFields: ['observatoryName', 'defaultLanguage'] },
      },
    });
    expect(await service.getSettings()).toBe(row);
  });

  it('does not write when an identity field is invalid', async () => {
    const upsert = jest.fn();
    const service = new SystemSettingsService({ systemSettings: { upsert } } as any);
    await expect(service.updateSettings({ defaultLanguage: 'xx' }, 'admin-1')).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
