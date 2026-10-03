import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';
import { ActiveCompanyGuard } from './active-company.guard';
import { ALLOW_INACTIVE_COMPANY_KEY } from './allow-inactive-company.decorator';

describe('ActiveCompanyGuard', () => {
  let guard: ActiveCompanyGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ActiveCompanyGuard(reflector);
  });

  function createMockContext(user?: any, handlerMeta?: any, classMeta?: any): ExecutionContext {
    const handler = () => {};
    const targetClass = class {};

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ALLOW_INACTIVE_COMPANY_KEY) {
        return handlerMeta !== undefined ? handlerMeta : classMeta;
      }
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => targetClass,
    } as unknown as ExecutionContext;
  }

  describe('Unauthenticated / Staff bypass', () => {
    it('allows request if user is not present', () => {
      const context = createMockContext(undefined);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows staff role CENTRAL regardless of status or isActive', () => {
      const context = createMockContext({
        id: 'u-staff',
        role: UserRole.ADMIN_ONEFOP,
        status: UserStatus.PENDING_APPROVAL,
        isActive: false,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows SUPER_ADMIN untouched', () => {
      const context = createMockContext({
        id: 'u-admin',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        isActive: true,
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Active Company', () => {
    it('allows COMPANY user when status is ACTIVE and isActive is true', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: true,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('does not check establishmentId (passes even if establishmentId is null/missing)', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: true,
        establishmentId: null,
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Inactive Company Denial (403 { code: COMPANY_NOT_ACTIVE, status })', () => {
    it('throws 403 when company status is PENDING_APPROVAL', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
      });

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      }
    });

    it('throws 403 when company status is REJECTED', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: UserStatus.REJECTED,
        isActive: true,
      });

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.REJECTED,
        });
      }
    });

    it('throws 403 when company status is ACTIVE but isActive is false', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: UserStatus.ACTIVE,
        isActive: false,
      });

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.ACTIVE,
        });
      }
    });

    it('denies unknown or review status by default (allow-list logic)', () => {
      const context = createMockContext({
        id: 'c-1',
        role: UserRole.COMPANY,
        status: 'UNDER_REVIEW',
        isActive: true,
      });

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: 'UNDER_REVIEW',
        });
      }
    });
  });

  describe('@AllowInactiveCompany decorator', () => {
    it('allows inactive company when @AllowInactiveCompany has no args and isActive is true', () => {
      const context = createMockContext(
        {
          id: 'c-1',
          role: UserRole.COMPANY,
          status: UserStatus.PENDING_APPROVAL,
          isActive: true,
        },
        {}, // empty options = any status allowed
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows inactive company when its status is in { statuses } list and isActive is true', () => {
      const context = createMockContext(
        {
          id: 'c-1',
          role: UserRole.COMPANY,
          status: UserStatus.PENDING_APPROVAL,
          isActive: true,
        },
        { statuses: [UserStatus.PENDING_APPROVAL] },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('denies inactive company when its status is NOT in { statuses } list', () => {
      const context = createMockContext(
        {
          id: 'c-1',
          role: UserRole.COMPANY,
          status: UserStatus.REJECTED,
          isActive: true,
        },
        { statuses: [UserStatus.PENDING_APPROVAL] },
      );

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.REJECTED,
        });
      }
    });

    it('always denies company when isActive is false, even with @AllowInactiveCompany', () => {
      const context = createMockContext(
        {
          id: 'c-1',
          role: UserRole.COMPANY,
          status: UserStatus.PENDING_APPROVAL,
          isActive: false,
        },
        {}, // no arg
      );

      try {
        guard.canActivate(context);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      }
    });
  });
});
