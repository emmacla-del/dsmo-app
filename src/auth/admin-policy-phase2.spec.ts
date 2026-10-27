import { BadRequestException, ForbiddenException, INestApplication, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
const passport = require('passport') as typeof import('passport');
import { RolesGuard } from './roles.guard';
import { AuthController } from './auth.controller';
import { AdminQuestionnairesController } from '../questionnaires/admin-questionnaires.controller';
import { AuthService } from './auth.service';
import { StaffInvitationService } from './staff-invitation.service';
import { StaffInvitationLinkService } from './staff-invitation-link.service';
import { ActiveCompanyGuard } from './active-company.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';

const actor = (role: string, region = 'Territory A', department = 'Division A') => ({
  id: 'actor-1', role, region, department,
});
const guard = new RolesGuard(new Reflector(), { getSettings: async () => ({ maintenanceMode: false }) } as any);

async function guardedResult(
  controller: Function,
  method: string,
  role: string,
  requestUser = actor(role),
): Promise<boolean> {
  const handler = (controller as any).prototype[method];
  const context: any = {
    switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }),
    getHandler: () => handler,
    getClass: () => controller,
  };
  return guard.canActivate(context);
}

async function expect403(controller: Function, method: string, role: string) {
  const authorize = async () => {
    if (!(await guardedResult(controller, method, role))) throw new ForbiddenException();
  };
  await expect(authorize()).rejects.toMatchObject({ status: 403 });
}

describe('Phase 2 authorization policy', () => {
  let app: INestApplication;
  let base: string;
  const target: Record<string, any> = {
    id: 'target-1', role: 'ADMIN_ONEFOP', region: 'Territory A', department: 'Division A', isActive: true,
  };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => where.id === target.id ? target : null),
      update: jest.fn(async ({ data }: any) => ({ ...target, ...data })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };

  beforeAll(async () => {
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
    passport.use('jwt', {
      name: 'jwt',
      authenticate(request: any) {
        this.success(JSON.parse(request.headers['x-test-user']));
      },
    } as any);
    @Module({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: StaffInvitationService, useValue: {} },
        { provide: StaffInvitationLinkService, useValue: {} },
        { provide: ActiveCompanyGuard, useValue: { canActivate: () => true } },
        RolesGuard,
        { provide: Reflector, useValue: new Reflector() },
        { provide: SystemSettingsService, useValue: { getSettings: async () => ({ maintenanceMode: false }) } },
      ],
    })
    class LifecycleHttpModule {}

    app = await NestFactory.create(LifecycleHttpModule, { logger: ['error'] });
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    passport.unuse('jwt');
  });

  beforeEach(() => {
    target.region = 'Territory A';
    target.department = 'Division A';
    target.isActive = true;
    prisma.user.update.mockClear();
    prisma.auditLog.create.mockClear();
  });

  const patchUser = async (path: string, requestUser: any) => {
    const response = await fetch(`${base}${path}`, {
      method: 'PATCH',
      headers: { 'x-test-user': JSON.stringify(requestUser) },
    });
    return { status: response.status, body: await response.json() };
  };

  it('P2-1 refuses registration-scoped actors on questionnaire approve', async () => {
    await expect403(AdminQuestionnairesController, 'approve', 'ADMIN_ONEFOP_REGISTRATIONS');
  });

  it('P2-2 refuses registration-scoped actors on questionnaire reject', async () => {
    await expect403(AdminQuestionnairesController, 'reject', 'ADMIN_ONEFOP_REGISTRATIONS');
  });

  it('P2-3 refuses registration-scoped actors on questionnaire request-correction', async () => {
    await expect403(AdminQuestionnairesController, 'requestCorrection', 'ADMIN_ONEFOP_REGISTRATIONS');
  });

  it('P2-4 refuses submission-scoped actors on registration approve', async () => {
    await expect403(AuthController, 'approveUser', 'ADMIN_ONEFOP_SUBMISSIONS');
  });

  it('P2-5 refuses submission-scoped actors on registration reject', async () => {
    await expect403(AuthController, 'rejectUser', 'ADMIN_ONEFOP_SUBMISSIONS');
  });

  it('P2-6 refuses submission-scoped actors on registration request-complements', async () => {
    await expect403(AuthController, 'requestComplements', 'ADMIN_ONEFOP_SUBMISSIONS');
  });

  it('P2-7 refuses CENTRAL_AGENT on registration approve', async () => {
    await expect403(AuthController, 'approveUser', 'CENTRAL_AGENT');
  });

  it('P2-8 refuses CENTRAL_AGENT on registration reject', async () => {
    await expect403(AuthController, 'rejectUser', 'CENTRAL_AGENT');
  });

  it('P2-9 refuses CENTRAL_AGENT on registration request-complements', async () => {
    await expect403(AuthController, 'requestComplements', 'CENTRAL_AGENT');
  });

  it('P2-10 refuses CENTRAL_AGENT on questionnaire decisions', async () => {
    for (const method of ['approve', 'reject', 'requestCorrection']) {
      await expect403(AdminQuestionnairesController, method, 'CENTRAL_AGENT');
    }
  });

  it('P2-11 refuses CENTRAL_AGENT on bulk visa and bulk reject', async () => {
    for (const method of ['bulkVisa', 'bulkReject']) {
      await expect403(AdminQuestionnairesController, method, 'CENTRAL_AGENT');
    }
  });

  it('P2-12 refuses CENTRAL_AGENT on reopen, anomaly resolve, and export', async () => {
    for (const method of ['reopenForCorrection', 'resolveAnomaly', 'exportDossiers']) {
      await expect403(AdminQuestionnairesController, method, 'CENTRAL_AGENT');
    }
  });

  it('P2-13 allows CENTRAL_AGENT to read company registrations', async () => {
    await expect(guardedResult(AuthController, 'listCompanyRegistrations', 'CENTRAL_AGENT')).resolves.toBe(true);
  });

  it('P2-14 allows CENTRAL_AGENT to read the questionnaire list', async () => {
    await expect(guardedResult(AdminQuestionnairesController, 'getAll', 'CENTRAL_AGENT')).resolves.toBe(true);
  });

  it('P2-15 allows CENTRAL_AGENT to read a questionnaire by id', async () => {
    await expect(guardedResult(AdminQuestionnairesController, 'getOne', 'CENTRAL_AGENT')).resolves.toBe(true);
  });

  it('P2-16 allows CENTRAL_AGENT to read pilotage queues', async () => {
    await expect(guardedResult(AdminQuestionnairesController, 'getQueues', 'CENTRAL_AGENT')).resolves.toBe(true);
  });

  it('P2-29 REGIONAL_ADMIN reaches the suspend handler for an in-territory user', async () => {
    const response = await patchUser('/auth/users/target-1/suspend', actor('REGIONAL_ADMIN'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'target-1', isActive: false });
  });

  it('P2-30 REGIONAL_ADMIN is refused out of territory by the service check', async () => {
    target.region = 'Territory B';
    target.department = 'Division B';
    const response = await patchUser('/auth/users/target-1/suspend', actor('REGIONAL_ADMIN'));
    expect(response.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('P2-31 DIVISIONAL_ADMIN reaches the suspend handler in its region and department', async () => {
    const response = await patchUser('/auth/users/target-1/suspend', actor('DIVISIONAL_ADMIN'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'target-1', isActive: false });
  });

  it('P2-32 DIVISIONAL_ADMIN is refused outside its region and department by the service check', async () => {
    target.region = 'Territory B';
    target.department = 'Division B';
    const response = await patchUser('/auth/users/target-1/suspend', actor('DIVISIONAL_ADMIN'));
    expect(response.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('P2-34 REGIONAL_ADMIN remains refused on the role-assignment route', async () => {
    const response = await patchUser('/auth/users/target-1/role', actor('REGIONAL_ADMIN'));
    expect(response.status).toBe(403);
  });

  it('P2-34b REGIONAL_ADMIN remains refused on the user-deletion route', async () => {
    const response = await fetch(`${base}/auth/users/target-1`, {
      method: 'DELETE', headers: { 'x-test-user': JSON.stringify(actor('REGIONAL_ADMIN')) },
    });
    expect(response.status).toBe(403);
  });

  it("P2-35 records a regional admin's role in the suspend audit entry", async () => {
    const response = await patchUser('/auth/users/target-1/suspend', actor('REGIONAL_ADMIN'));
    expect(response.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'actor-1', action: 'USER_SUSPENDED', resourceType: 'User', resourceId: 'target-1',
        details: { isActive: false, actorRole: 'REGIONAL_ADMIN' },
      }),
    });
  });

  it('P2-27 audits an admin reset-password request before preserving the unavailable response', async () => {
    const prisma: any = { auditLog: { create: jest.fn(async () => ({})) } };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
    const endpointCall = AuthController.prototype.adminResetPassword.call(
      { authService: service }, 'target@example.cm', { user: { id: 'admin-1' } },
    );
    await expect(endpointCall).rejects.toThrow(BadRequestException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'ADMIN_PASSWORD_RESET_UNAVAILABLE',
        resourceType: 'AdminPasswordReset',
        resourceId: 'admin-1',
        details: { outcome: 'unavailable' },
      },
    });
  });
});
