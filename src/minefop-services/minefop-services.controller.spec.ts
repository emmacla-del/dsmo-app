import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';
import { MinefopServicesController } from './minefop-services.controller';
import { MinefopServicesService } from './minefop-services.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';

describe('MinefopServicesController security & guards', () => {
  let controller: MinefopServicesController;
  let svc: jest.Mocked<Partial<MinefopServicesService>>;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let activeCompanyGuard: ActiveCompanyGuard;
  let systemSettings: Partial<SystemSettingsService>;

  beforeEach(() => {
    svc = {
      createService: jest.fn().mockResolvedValue({ id: 'srv-1', code: 'DIR_TEST' } as any),
      createPosition: jest.fn().mockResolvedValue({ id: 'pos-1', title: 'Chef' } as any),
      updatePosition: jest.fn().mockResolvedValue({ id: 'pos-1', title: 'Chef Updated' } as any),
      deletePosition: jest.fn().mockResolvedValue(undefined as any),
      updateService: jest.fn().mockResolvedValue({ id: 'srv-1', code: 'DIR_TEST' } as any),
      hardDeleteService: jest.fn().mockResolvedValue(undefined as any),
      deleteService: jest.fn().mockResolvedValue(undefined as any),
      findAll: jest.fn().mockResolvedValue([{ id: 'srv-1', code: 'DIR_TEST' }] as any),
      getRoots: jest.fn().mockResolvedValue([{ id: 'srv-1', code: 'DIR_TEST' }] as any),
    };

    controller = new MinefopServicesController(svc as unknown as MinefopServicesService);
    reflector = new Reflector();
    systemSettings = {
      getSettings: jest.fn().mockResolvedValue({ maintenanceMode: false } as any),
    };
    rolesGuard = new RolesGuard(reflector, systemSettings as SystemSettingsService);
    activeCompanyGuard = new ActiveCompanyGuard(reflector);
  });

  function createMockExecutionContext(
    handler: Function,
    user?: { role?: string; status?: string; isActive?: boolean },
  ): ExecutionContext {
    return {
      getClass: () => MinefopServicesController,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  const mutatingHandlers = [
    { name: 'createService', fn: MinefopServicesController.prototype.createService },
    { name: 'createPosition', fn: MinefopServicesController.prototype.createPosition },
    { name: 'updatePosition', fn: MinefopServicesController.prototype.updatePosition },
    { name: 'deletePosition', fn: MinefopServicesController.prototype.deletePosition },
    { name: 'updateService', fn: MinefopServicesController.prototype.updateService },
    { name: 'hardDeleteService', fn: MinefopServicesController.prototype.hardDeleteService },
    { name: 'deleteService', fn: MinefopServicesController.prototype.deleteService },
  ];

  describe('Mutating routes guard and role metadata', () => {
    it.each(mutatingHandlers)('$name has JwtAuthGuard, RolesGuard, ActiveCompanyGuard, and @Roles', ({ fn }) => {
      const guards = Reflect.getMetadata('__guards__', fn) || [];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards).toContain(ActiveCompanyGuard);

      const roles = Reflect.getMetadata('roles', fn) || [];
      expect(roles).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP]);
    });
  });

  describe('Role-based access on mutating endpoints', () => {
    it('rejects COMPANY role with 403 on RolesGuard', async () => {
      const ctx = createMockExecutionContext(controller.createService, {
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      const allowed = await rolesGuard.canActivate(ctx);
      expect(allowed).toBe(false);
    });

    it('rejects non-active COMPANY role with 403 on ActiveCompanyGuard', () => {
      const ctx = createMockExecutionContext(controller.createService, {
        role: UserRole.COMPANY,
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
      });

      expect(() => activeCompanyGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects AUDITOR role with 403 on RolesGuard', async () => {
      const ctx = createMockExecutionContext(controller.createService, {
        role: UserRole.AUDITOR,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      const allowed = await rolesGuard.canActivate(ctx);
      expect(allowed).toBe(false);
    });

    it('allows SUPER_ADMIN_ONEFOP to pass both RolesGuard and ActiveCompanyGuard', async () => {
      const ctx = createMockExecutionContext(controller.createService, {
        role: UserRole.ADMIN_ONEFOP,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      const rolesAllowed = await rolesGuard.canActivate(ctx);
      expect(rolesAllowed).toBe(true);

      const activeCompanyAllowed = activeCompanyGuard.canActivate(ctx);
      expect(activeCompanyAllowed).toBe(true);
    });

    it('allows SUPER_ADMIN to pass both RolesGuard and ActiveCompanyGuard', async () => {
      const ctx = createMockExecutionContext(controller.createService, {
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      const rolesAllowed = await rolesGuard.canActivate(ctx);
      expect(rolesAllowed).toBe(true);

      const activeCompanyAllowed = activeCompanyGuard.canActivate(ctx);
      expect(activeCompanyAllowed).toBe(true);
    });
  });

  describe('Public GET endpoints remain open without token', () => {
    it('has no guards on GET findAll and returns data without token', async () => {
      const guards = Reflect.getMetadata('__guards__', controller.findAll) || [];
      expect(guards).toEqual([]);

      const result = await controller.findAll();
      expect(result).toEqual([{ id: 'srv-1', code: 'DIR_TEST' }]);
      expect(svc.findAll).toHaveBeenCalled();
    });

    it('has no guards on GET getRoots and returns data without token', async () => {
      const guards = Reflect.getMetadata('__guards__', controller.getRoots) || [];
      expect(guards).toEqual([]);

      const result = await controller.getRoots();
      expect(result).toEqual([{ id: 'srv-1', code: 'DIR_TEST' }]);
      expect(svc.getRoots).toHaveBeenCalled();
    });
  });
});
