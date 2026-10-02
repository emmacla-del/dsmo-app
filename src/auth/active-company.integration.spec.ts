import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveCompanyGuard } from './active-company.guard';
import { AuthController } from './auth.controller';
import { OnefopController } from '../onefop/onefop.controller';
import { LocationsController } from '../locations/locations.controller';
import { UserRole, UserStatus } from '@prisma/client';

describe('ActiveCompanyGuard Integration / End-to-End Route Behavior', () => {
  let reflector: Reflector;
  let guard: ActiveCompanyGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ActiveCompanyGuard(reflector);
  });

  function createMockExecutionContext(
    controllerClass: any,
    handler: Function,
    user?: any,
  ): ExecutionContext {
    return {
      getClass: () => controllerClass,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Exempt route: GET /auth/me with @AllowInactiveCompany', () => {
    const handler = AuthController.prototype.getMe;

    it('allows inactive status company user (PENDING_APPROVAL) when isActive is true', () => {
      const ctx = createMockExecutionContext(AuthController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('denies company user if isActive is false, even on @AllowInactiveCompany route', () => {
      const ctx = createMockExecutionContext(AuthController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.PENDING_APPROVAL,
        isActive: false,
      });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        guard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      }
    });

    it('allows active company user (ACTIVE, isActive: true)', () => {
      const ctx = createMockExecutionContext(AuthController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Guarded routes: e.g. OnefopController', () => {
    // Pick any handler on OnefopController, e.g. saveDraft
    const handler = OnefopController.prototype.saveDraft;

    it('rejects company with status PENDING_APPROVAL with 403 { code: COMPANY_NOT_ACTIVE, status }', () => {
      const ctx = createMockExecutionContext(OnefopController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
      });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        guard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      }
    });

    it('rejects company with status REJECTED with 403', () => {
      const ctx = createMockExecutionContext(OnefopController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.REJECTED,
        isActive: true,
      });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        guard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.REJECTED,
        });
      }
    });

    it('rejects company with isActive: false even if status is ACTIVE', () => {
      const ctx = createMockExecutionContext(OnefopController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: false,
      });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        guard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.ACTIVE,
        });
      }
    });

    it('allows active company user (ACTIVE, isActive: true)', () => {
      const ctx = createMockExecutionContext(OnefopController, handler, {
        id: 'user-uuid',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: true,
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('passes staff roles through untouched without checking status or isActive', () => {
      for (const role of [
        UserRole.SUPER_ADMIN,
        UserRole.SUPER_ADMIN_ONEFOP,
        UserRole.SUPER_ADMIN_DSMO,
        UserRole.CENTRAL,
        UserRole.REGIONAL,
        UserRole.DIVISIONAL,
        UserRole.DATA_MANAGER,
        UserRole.ANALYST,
        UserRole.AUDITOR,
      ]) {
        const ctx = createMockExecutionContext(OnefopController, handler, {
          id: 'staff-uuid',
          role,
          status: UserStatus.PENDING_APPROVAL,
          isActive: false,
        });
        expect(guard.canActivate(ctx)).toBe(true);
      }
    });
  });

  describe('Public routes: e.g. LocationsController or unauthenticated', () => {
    const handler = LocationsController.prototype.getAllRegions;

    it('allows access when no user is attached to the request (unauthenticated public lookup)', () => {
      const ctx = createMockExecutionContext(LocationsController, handler, undefined);
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
