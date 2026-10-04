import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { SystemSettingsController } from '../system-settings/system-settings.controller';
import { OnefopAnalyticsController } from '../analytics/onefop-analytics.controller';
import { AdminQuestionnairesController } from '../questionnaires/admin-questionnaires.controller';

class HandlerOnlyController {
  @Roles('ADMIN_ONEFOP')
  guarded() {}

  open() {}
}

@Roles('SUPER_ADMIN')
class ClassOnlyController {
  inherited() {}
}

@Roles('SUPER_ADMIN')
class MixedController {
  @Roles('REGIONAL_ADMIN')
  overridden() {}

  inherited() {}
}

function contextFor(controller: Function, handler: Function, role: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const settings = {
    getSettings: jest.fn().mockResolvedValue({ maintenanceMode: false }),
  } as unknown as SystemSettingsService;
  const guard = new RolesGuard(new Reflector(), settings);

  const allows = (controller: Function, handler: Function, role: string) =>
    guard.canActivate(contextFor(controller, handler, role));

  it('enforces handler-level @Roles', async () => {
    const handler = HandlerOnlyController.prototype.guarded;
    await expect(allows(HandlerOnlyController, handler, 'ADMIN_ONEFOP')).resolves.toBe(true);
    await expect(allows(HandlerOnlyController, handler, 'COMPANY')).resolves.toBe(false);
  });

  it('lets any authenticated role through when neither handler nor class declares @Roles', async () => {
    await expect(allows(HandlerOnlyController, HandlerOnlyController.prototype.open, 'COMPANY')).resolves.toBe(true);
  });

  it('enforces class-level @Roles when the handler declares none', async () => {
    const handler = ClassOnlyController.prototype.inherited;
    await expect(allows(ClassOnlyController, handler, 'SUPER_ADMIN')).resolves.toBe(true);
    await expect(allows(ClassOnlyController, handler, 'COMPANY')).resolves.toBe(false);
  });

  it('lets handler-level @Roles win over class-level @Roles', async () => {
    const overridden = MixedController.prototype.overridden;
    await expect(allows(MixedController, overridden, 'REGIONAL_ADMIN')).resolves.toBe(true);
    await expect(allows(MixedController, overridden, 'SUPER_ADMIN')).resolves.toBe(false);

    const inherited = MixedController.prototype.inherited;
    await expect(allows(MixedController, inherited, 'SUPER_ADMIN')).resolves.toBe(true);
    await expect(allows(MixedController, inherited, 'REGIONAL_ADMIN')).resolves.toBe(false);
  });

  it.each([
    [SystemSettingsController, 'getSettings'],
    [SystemSettingsController, 'updateSettings'],
    [OnefopAnalyticsController, 'getDashboard'],
    [OnefopAnalyticsController, 'getSubmissions'],
    [AdminQuestionnairesController, 'getQueues'],
    [AdminQuestionnairesController, 'bulkVisa'],
  ])('rejects a COMPANY account on %p.%s (class-level @Roles only)', async (controller, method) => {
    const handler = (controller as any).prototype[method];
    expect(handler).toBeInstanceOf(Function);
    await expect(allows(controller, handler, 'COMPANY')).resolves.toBe(false);
  });
});
