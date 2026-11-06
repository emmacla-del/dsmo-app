import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { UserStatus } from '../types/prisma.types';
import { AuthService } from './auth.service';

// GET /auth/company-registrations/:id: the registration review page reads one
// file in the list's own shape, with the list's territory and archive rules.

function companyRow() {
  return {
    id: 'company-1',
    name: 'Example Company',
    taxNumber: 'TAX-1',
    cnpsNumber: null,
    subdivisionId: null,
    entityType: 'ENTREPRISE',
    region: 'Territory A',
    department: 'Department A',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    phone: null,
    respondentFirstName: null,
    respondentLastName: null,
    respondentFunction: null,
    respondentPhone: null,
    respondentPhone2: null,
    user: {
      id: 'user-1',
      email: 'user@example.cm',
      status: UserStatus.PENDING_APPROVAL,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      approvalComment: null,
      rejectionReason: null,
      registrationNumber: null,
      registrationMethod: 'SELF_REGISTRATION',
      createdBy: null,
      createdByUser: null,
    },
  };
}

function makeService(rows: any[]) {
  const prisma: any = {
    company: {
      count: jest.fn(async () => rows.length),
      findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]),
      findFirst: jest.fn(async () => rows[0] ?? null),
    },
    user: { groupBy: jest.fn(async () => []) },
    auditLog: { findMany: jest.fn(async () => []) },
  };
  const service = new AuthService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any,
  );
  return { service, prisma };
}

const regionalActor = { role: 'REGIONAL_ADMIN', region: 'Territory A' };

describe('AuthService.getCompanyRegistration', () => {
  it('reads one registration of any status, inside the actor territory', async () => {
    const { service, prisma } = makeService([companyRow()]);
    const item: any = await service.getCompanyRegistration(regionalActor, 'user-1');

    expect(item.id).toBe('user-1');
    expect(item.overdueDays).toBe(7);
    const where = prisma.company.findMany.mock.calls[0][0].where;
    expect(where.user.id).toBe('user-1');
    expect(where.user.status).toBeUndefined();
    expect(JSON.stringify(where)).toContain('Territory A');
    expect(prisma.company.findMany.mock.calls[0][0].take).toBe(1);
    // The status tabs' territory-wide counts are the list's, not one file's.
    expect(prisma.user.groupBy).not.toHaveBeenCalled();
  });

  it('answers not found when the registration is outside the territory or unknown', async () => {
    const { service } = makeService([]);
    await expect(service.getCompanyRegistration(regionalActor, 'user-9')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getCompanyRegistration(regionalActor, ' ')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AuthService.getCompanyRegistrationHistory', () => {
  it('lists the file audit entries newest first, with reasons and changed field names only', async () => {
    const { service, prisma } = makeService([companyRow()]);
    const historyRows = [
      { id: 'a2', action: 'COMPANY_REGISTRATION_RESUBMITTED', userId: 'user-1', createdAt: new Date('2026-01-05'), details: { changes: { phone: { before: '1', after: '2' } } }, user: { firstName: 'Ada', lastName: null, email: 'user@example.cm' } },
      { id: 'a1', action: 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED', userId: 'agent-1', createdAt: new Date('2026-01-03'), details: { message: 'Le NIU manque.' }, user: { firstName: 'Nadège', lastName: 'Kamga', email: 'n@example.cm' } },
    ];
    prisma.auditLog.findMany = jest.fn(async (args: any) =>
      args?.where?.action?.in?.includes?.('COMPANY_REGISTRATION_APPROVED') ? historyRows : []);

    const history: any[] = await service.getCompanyRegistrationHistory(regionalActor, 'user-1');

    const call = (prisma.auditLog.findMany as jest.Mock).mock.calls.find((c: any[]) => c[0]?.where?.action?.in?.includes?.('COMPANY_REGISTRATION_APPROVED'))[0];
    expect(call.where).toMatchObject({ resourceType: 'User', resourceId: 'user-1' });
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
    expect(history[0]).toMatchObject({ action: 'COMPANY_REGISTRATION_RESUBMITTED', byDeclarant: true, actorName: null, changedFields: ['phone'] });
    expect(JSON.stringify(history[0])).not.toContain('"before"');
    expect(history[1]).toMatchObject({ byDeclarant: false, actorName: 'Nadège Kamga', text: 'Le NIU manque.' });
    // Authorised with the list's filter alone: no rows, hints or counts are built.
    const scope = prisma.company.findFirst.mock.calls[0][0].where;
    expect(scope.user.id).toBe('user-1');
    expect(JSON.stringify(scope)).toContain('Territory A');
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('answers not found outside the territory, before reading any history', async () => {
    const { service, prisma } = makeService([]);
    await expect(service.getCompanyRegistrationHistory(regionalActor, 'user-9')).rejects.toBeInstanceOf(NotFoundException);
    const calls = (prisma.auditLog.findMany as jest.Mock).mock.calls;
    expect(calls.some((c: any[]) => c[0].where?.action?.in?.includes('COMPANY_REGISTRATION_APPROVED'))).toBe(false);
  });
});
