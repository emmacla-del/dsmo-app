import { Controller, Get, UseGuards } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { AppModule } from '../app.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ActiveCompanyGuard } from './active-company.guard';
import { AllowInactiveCompany, ALLOW_INACTIVE_COMPANY_KEY } from './allow-inactive-company.decorator';
import type { UserStatus } from '../types/prisma.types';

function getControllersFromModule(module: any, seen = new Set<any>()): any[] {
  if (!module || seen.has(module)) return [];
  seen.add(module);
  const target = module.forwardRef ? module.forwardRef() : module.module || module;
  const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target) || [];
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, target) || [];
  const result = [...controllers];
  for (const imp of imports) {
    result.push(...getControllersFromModule(imp, seen));
  }
  return result;
}

interface AuditResult {
  jwtRoutesCount: number;
  offendingRoutes: string[];
  auditedRoutes: { route: string; guarded: boolean; exempt: boolean }[];
}

export function auditControllerGuards(
  controllers: any[],
  scanner = new MetadataScanner(),
): AuditResult {
  const offendingRoutes: string[] = [];
  const auditedRoutes: { route: string; guarded: boolean; exempt: boolean }[] = [];
  let jwtRoutesCount = 0;

  for (const ctrl of controllers) {
    const ctrlPrefix = Reflect.getMetadata('path', ctrl) || '';
    const ctrlGuards: any[] = Reflect.getMetadata('__guards__', ctrl) || [];
    const ctrlAllowInactive = Reflect.getMetadata(ALLOW_INACTIVE_COMPANY_KEY, ctrl);

    const methodNames = scanner.getAllMethodNames(ctrl.prototype);
    for (const method of methodNames) {
      const fn = ctrl.prototype[method];
      const path = Reflect.getMetadata('path', fn);
      if (path === undefined) continue;

      const methodGuards: any[] = Reflect.getMetadata('__guards__', fn) || [];
      const allGuards = [...ctrlGuards, ...methodGuards];

      const hasJwtAuth = allGuards.some(
        (g) => g === JwtAuthGuard || g?.name === 'JwtAuthGuard',
      );
      const hasActiveCompany = allGuards.some(
        (g) => g === ActiveCompanyGuard || g?.name === 'ActiveCompanyGuard',
      );
      const hasAllowInactive =
        Reflect.getMetadata(ALLOW_INACTIVE_COMPANY_KEY, fn) !== undefined ||
        ctrlAllowInactive !== undefined;

      const routeDesc = `${ctrl.name}.${method} (path: /${ctrlPrefix}/${path})`;

      if (hasJwtAuth) {
        jwtRoutesCount++;
        if (!hasActiveCompany && !hasAllowInactive) {
          offendingRoutes.push(routeDesc);
        } else {
          auditedRoutes.push({
            route: routeDesc,
            guarded: hasActiveCompany,
            exempt: hasAllowInactive,
          });
        }
      }
    }
  }

  return { jwtRoutesCount, offendingRoutes, auditedRoutes };
}

describe('ActiveCompanyGuard completeness', () => {
  const scanner = new MetadataScanner();
  const allControllers = getControllersFromModule(AppModule);

  it('discovers all controllers in AppModule', () => {
    expect(allControllers.length).toBeGreaterThanOrEqual(18);
  });

  it('verifies that every handler protected by JwtAuthGuard has ActiveCompanyGuard or @AllowInactiveCompany', () => {
    const result = auditControllerGuards(allControllers, scanner);

    // Assert that the scan visited > 0 JWT routes
    expect(result.jwtRoutesCount).toBeGreaterThan(0);

    if (result.offendingRoutes.length > 0) {
      console.error(
        'Offending routes protected by JwtAuthGuard but missing ActiveCompanyGuard and @AllowInactiveCompany:\n' +
          result.offendingRoutes.map((r) => `  - ${r}`).join('\n'),
      );
    }

    expect(result.offendingRoutes).toEqual([]);
  });

  // Every exemption widens the guard, so this pins the exact set AND the
  // statuses each one admits. Adding a route here, or widening an existing
  // one to another status, has to be a deliberate edit to this list.
  // 'ANY_STATUS' is the bare decorator: any status, provided isActive is true.
  it('verifies the exact set of @AllowInactiveCompany exemptions and the statuses each admits', () => {
    const exemptions: Record<string, UserStatus[] | 'ANY_STATUS'> = {};

    for (const ctrl of allControllers) {
      const ctrlAllowInactive = Reflect.getMetadata(ALLOW_INACTIVE_COMPANY_KEY, ctrl);

      const methodNames = scanner.getAllMethodNames(ctrl.prototype);
      for (const method of methodNames) {
        const fn = ctrl.prototype[method];
        const path = Reflect.getMetadata('path', fn);
        if (path === undefined) continue;

        // A method-level {} (the bare decorator) must win over a class-level
        // value, so this tests for undefined rather than falsiness.
        const options =
          Reflect.getMetadata(ALLOW_INACTIVE_COMPANY_KEY, fn) ?? ctrlAllowInactive;
        if (options === undefined) continue;

        exemptions[`${ctrl.name}.${method}`] =
          options.statuses && options.statuses.length > 0 ? options.statuses : 'ANY_STATUS';
      }
    }

    const UNDER_REVIEW: UserStatus[] = ['PENDING_APPROVAL', 'COMPLEMENTS_REQUESTED'];

    expect(exemptions).toEqual({
      // The account's own row, readable at any status so a blocked company can
      // find out why. isActive=false is still denied by the guard.
      'AuthController.getMe': 'ANY_STATUS',
      // The correction flow itself — reachable only from COMPLEMENTS_REQUESTED.
      'AuthController.resubmitRegistration': ['COMPLEMENTS_REQUESTED'],
      // Account self-service, so a company under review is not locked out of
      // its own account while it waits.
      'AuthController.changePassword': UNDER_REVIEW,
      'AuthController.deleteOwnAccount': UNDER_REVIEW,
      'AuthController.updatePreferences': UNDER_REVIEW,
      'AuthController.setTwoFactor': UNDER_REVIEW,
      'AuthController.resendVerification': UNDER_REVIEW,
      // Prefill for the correction form. POST dsmo/company stays fully guarded.
      'DsmoController.getMyCompany': UNDER_REVIEW,
      // The caller's own in-app inbox (Phase 3). ANY_STATUS for the same
      // reason as getMe above: the inbox is where a blocked company is told
      // what is wrong with its file, so withholding it at exactly the statuses
      // that generate those messages would defeat the feature. REJECTED is
      // deliberately included — Phase 3-full notifies on rejection.
      //
      // The exemption is narrower than it looks: isActive=false is still
      // denied by the guard whatever this list says, and every route is
      // scoped to req.user.id server-side, so a company reads its own inbox
      // and nothing else. Class-level decorator, hence all three handlers.
      'NotificationsController.list': 'ANY_STATUS',
      'NotificationsController.unreadCount': 'ANY_STATUS',
      'NotificationsController.markRead': 'ANY_STATUS',
    });
  });

  describe('negative case & fixture verification', () => {
    @Controller('fixture-unguarded')
    class UnguardedFixtureController {
      @Get('secret')
      @UseGuards(JwtAuthGuard)
      secretHandler() {
        return { ok: true };
      }
    }

    @Controller('fixture-guarded')
    @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
    class GuardedFixtureController {
      @Get('profile')
      profileHandler() {
        return { ok: true };
      }
    }

    @Controller('fixture-exempt')
    class ExemptFixtureController {
      @Get('public-profile')
      @UseGuards(JwtAuthGuard)
      @AllowInactiveCompany()
      publicProfileHandler() {
        return { ok: true };
      }
    }

    it('reports a fixture controller that has JwtAuthGuard and lacks ActiveCompanyGuard/marker', () => {
      const result = auditControllerGuards([UnguardedFixtureController], scanner);

      expect(result.jwtRoutesCount).toBe(1);
      expect(result.offendingRoutes).toEqual([
        'UnguardedFixtureController.secretHandler (path: /fixture-unguarded/secret)',
      ]);
    });

    it('accepts fixture controller when ActiveCompanyGuard is applied', () => {
      const result = auditControllerGuards([GuardedFixtureController], scanner);

      expect(result.jwtRoutesCount).toBe(1);
      expect(result.offendingRoutes).toEqual([]);
      expect(result.auditedRoutes[0].guarded).toBe(true);
    });

    it('accepts fixture controller when @AllowInactiveCompany marker is applied', () => {
      const result = auditControllerGuards([ExemptFixtureController], scanner);

      expect(result.jwtRoutesCount).toBe(1);
      expect(result.offendingRoutes).toEqual([]);
      expect(result.auditedRoutes[0].exempt).toBe(true);
    });
  });
});
