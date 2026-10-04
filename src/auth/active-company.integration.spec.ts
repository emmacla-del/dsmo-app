import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveCompanyGuard } from './active-company.guard';
import { AuthController } from './auth.controller';
import { OnefopController } from '../onefop/onefop.controller';
import { LocationsController } from '../locations/locations.controller';
import { QuestionnairesController } from '../questionnaires/questionnaires.controller';
import { QuestionnairesService } from '../questionnaires/questionnaires.service';
import { DsmoController } from '../dsmo/dsmo.controller';
import { DsmoService } from '../dsmo/dsmo.service';
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
        UserRole.ADMIN_ONEFOP,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_ONEFOP,
        UserRole.REGIONAL_ADMIN,
        UserRole.DIVISIONAL_ADMIN,
        UserRole.ADMIN_ONEFOP,
        UserRole.ADMIN_ONEFOP,
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

  describe('Runtime integration: QuestionnairesController.submit & DsmoController.submitDeclaration', () => {
    async function invokeRoute(
      controller: any,
      methodName: string,
      user: any,
      dto: any = {},
    ): Promise<{ status: number; body: any }> {
      const handler = controller[methodName];
      const ctx = {
        getClass: () => controller.constructor,
        getHandler: () => handler,
        switchToHttp: () => ({
          getRequest: () => ({ user, body: dto }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;

      try {
        const allowed = guard.canActivate(ctx);
        if (!allowed) {
          return { status: 403, body: { message: 'Forbidden' } };
        }
        let result;
        if (controller instanceof QuestionnairesController) {
          result = await controller.submit(dto, { user, body: dto });
        } else if (controller instanceof DsmoController) {
          result = await controller.submitDeclaration({ user, body: dto }, dto);
        } else {
          result = await handler.call(controller, { user, body: dto }, dto);
        }
        return { status: 200, body: result };
      } catch (err: any) {
        if (err instanceof ForbiddenException) {
          return { status: 403, body: err.getResponse() };
        }
        throw err;
      }
    }

    describe('QuestionnairesController.submit', () => {
      let questionnairesController: QuestionnairesController;
      let mockQuestionnairesService: Partial<QuestionnairesService>;

      beforeEach(() => {
        mockQuestionnairesService = {
          submitQuestionnaire: jest.fn().mockResolvedValue({ id: 'sub-onefop-1', status: 'SUBMITTED' }),
        };
        questionnairesController = new QuestionnairesController(
          mockQuestionnairesService as QuestionnairesService,
          {} as any,
        );
      });

      it('1. allows ACTIVE company user (ACTIVE, isActive: true) → 200', async () => {
        const res = await invokeRoute(
          questionnairesController,
          'submit',
          { id: 'c-active', role: UserRole.COMPANY, status: UserStatus.ACTIVE, isActive: true },
          { entityType: 'enterprise', data: {} },
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: 'sub-onefop-1', status: 'SUBMITTED' });
      });

      it('2. rejects PENDING company with 403 { code: COMPANY_NOT_ACTIVE, status: PENDING_APPROVAL }', async () => {
        const res = await invokeRoute(
          questionnairesController,
          'submit',
          { id: 'c-pending', role: UserRole.COMPANY, status: UserStatus.PENDING_APPROVAL, isActive: true },
          { entityType: 'enterprise', data: {} },
        );
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      });

      it('3. rejects REJECTED company with 403 { code: COMPANY_NOT_ACTIVE, status: REJECTED }', async () => {
        const res = await invokeRoute(
          questionnairesController,
          'submit',
          { id: 'c-rejected', role: UserRole.COMPANY, status: UserStatus.REJECTED, isActive: true },
          { entityType: 'enterprise', data: {} },
        );
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.REJECTED,
        });
      });

      it('4. allows ACTIVE company with NO establishmentId (29-company case) → 200', async () => {
        const res = await invokeRoute(
          questionnairesController,
          'submit',
          { id: 'c-no-est', role: UserRole.COMPANY, status: UserStatus.ACTIVE, isActive: true, establishmentId: null },
          { entityType: 'enterprise', data: {} },
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: 'sub-onefop-1', status: 'SUBMITTED' });
      });

      it('5. allows Staff roles (REGIONAL and CENTRAL) regardless of user status → 200', async () => {
        for (const role of [UserRole.REGIONAL_ADMIN, UserRole.ADMIN_ONEFOP]) {
          const res = await invokeRoute(
            questionnairesController,
            'submit',
            { id: 'staff-1', role, status: UserStatus.PENDING_APPROVAL, isActive: false },
            { entityType: 'enterprise', data: {} },
          );
          expect(res.status).toBe(200);
        }
      });
    });

    describe('DsmoController.submitDeclaration', () => {
      let dsmoController: DsmoController;
      let mockDsmoService: Partial<DsmoService>;

      beforeEach(() => {
        mockDsmoService = {
          submitDeclaration: jest.fn().mockResolvedValue({ id: 'dec-dsmo-1', status: 'SUBMITTED' }),
        };
        dsmoController = new DsmoController(
          mockDsmoService as DsmoService,
          {} as any,
        );
      });

      it('1. allows ACTIVE company user (ACTIVE, isActive: true) → 200', async () => {
        const res = await invokeRoute(
          dsmoController,
          'submitDeclaration',
          { id: 'c-active', role: UserRole.COMPANY, status: UserStatus.ACTIVE, isActive: true },
          { year: 2026 },
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: 'dec-dsmo-1', status: 'SUBMITTED' });
      });

      it('2. rejects PENDING company with 403 { code: COMPANY_NOT_ACTIVE, status: PENDING_APPROVAL }', async () => {
        const res = await invokeRoute(
          dsmoController,
          'submitDeclaration',
          { id: 'c-pending', role: UserRole.COMPANY, status: UserStatus.PENDING_APPROVAL, isActive: true },
          { year: 2026 },
        );
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.PENDING_APPROVAL,
        });
      });

      it('3. rejects REJECTED company with 403 { code: COMPANY_NOT_ACTIVE, status: REJECTED }', async () => {
        const res = await invokeRoute(
          dsmoController,
          'submitDeclaration',
          { id: 'c-rejected', role: UserRole.COMPANY, status: UserStatus.REJECTED, isActive: true },
          { year: 2026 },
        );
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          code: 'COMPANY_NOT_ACTIVE',
          status: UserStatus.REJECTED,
        });
      });

      it('4. allows ACTIVE company with NO establishmentId (29-company case) → 200', async () => {
        const res = await invokeRoute(
          dsmoController,
          'submitDeclaration',
          { id: 'c-no-est', role: UserRole.COMPANY, status: UserStatus.ACTIVE, isActive: true, establishmentId: null },
          { year: 2026 },
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: 'dec-dsmo-1', status: 'SUBMITTED' });
      });

      it('5. allows Staff roles (REGIONAL and CENTRAL) regardless of user status → 200', async () => {
        for (const role of [UserRole.REGIONAL_ADMIN, UserRole.ADMIN_ONEFOP]) {
          const res = await invokeRoute(
            dsmoController,
            'submitDeclaration',
            { id: 'staff-1', role, status: UserStatus.PENDING_APPROVAL, isActive: false },
            { year: 2026 },
          );
          expect(res.status).toBe(200);
        }
      });
    });
  });
});
