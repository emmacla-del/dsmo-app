import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { UserRole } from '../types/prisma.types';
import { PILOTAGE_READ_ROLES, PILOTAGE_WRITE_ROLES, PilotageController } from './pilotage.controller';

const ENUM_ROLES = [
  'ANALYST',
  'AUDITOR',
  'CAMPAIGN_MANAGER',
  'CENTRAL',
  'COMPANY',
  'DATA_MANAGER',
  'DIVISIONAL',
  'REGIONAL',
  'SUPER_ADMIN',
  'SUPER_ADMIN_DSMO',
  'SUPER_ADMIN_ONEFOP',
];

function contextFor(handler: Function, role: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => PilotageController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;
}

describe('PilotageController roles', () => {
  const settings = { getSettings: jest.fn().mockResolvedValue({ maintenanceMode: false }) } as unknown as SystemSettingsService;
  const guard = new RolesGuard(new Reflector(), settings);
  const read = new Set<string>(PILOTAGE_READ_ROLES);
  const write = new Set<string>(PILOTAGE_WRITE_ROLES);

  it('is built from the UserRole enum actually stored in the schema', () => {
    expect(Object.values(UserRole).sort()).toEqual([...ENUM_ROLES].sort());
    for (const absent of ['INVESTIGATOR', 'INS_USER', 'MINESEC_USER', 'GUEST']) {
      expect(Object.values(UserRole)).not.toContain(absent);
    }
  });

  it('lets writers read and write, regional and divisional accounts read, and every other role through neither', async () => {
    const handlers = [
      ['getInscriptionTargets', read],
      ['getCoverage', read],
      ['getCampaignQuotas', read],
      ['putInscriptionTargets', write],
      ['putCampaignQuotas', write],
    ] as const;
    expect(write.has(UserRole.CENTRAL)).toBe(true);
    expect(write.has(UserRole.SUPER_ADMIN)).toBe(true);
    expect(write.has(UserRole.SUPER_ADMIN_ONEFOP)).toBe(true);
    expect(read.has(UserRole.REGIONAL)).toBe(true);
    expect(read.has(UserRole.DIVISIONAL)).toBe(true);

    for (const [name, allowed] of handlers) {
      const handler = PilotageController.prototype[name];
      for (const role of Object.values(UserRole)) {
        await expect(guard.canActivate(contextFor(handler, role))).resolves.toBe(allowed.has(role));
      }
    }
  });

  it('blocks REGIONAL and DIVISIONAL with 403 on a PUT with clear', async () => {
    for (const role of [UserRole.REGIONAL, UserRole.DIVISIONAL]) {
      await expect(
        guard.canActivate(contextFor(PilotageController.prototype.putInscriptionTargets, role)),
      ).resolves.toBe(false);
      await expect(
        guard.canActivate(contextFor(PilotageController.prototype.putCampaignQuotas, role)),
      ).resolves.toBe(false);
    }
  });
});
