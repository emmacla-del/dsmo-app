import { DsmoService } from './dsmo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { PdfService } from './pdf.service';

// VT-ONBOARDING regression coverage (2026-08-31).
//
// getMyCompany() backs GET /dsmo/company, which the Flutter app calls
// (ApiClient.getMyCompany()) every time it opens the ONEFOP questionnaire
// for a company, then feeds the result into
// home_screen.dart's companyToInitialData(). Its Prisma `select` is an
// explicit whitelist — before this fix it omitted every VOCATIONAL_TRAINING
// registration-time field (sigle, cfpType, educationSystem,
// functionalStatus, nonFunctionalReason(+Other), promoterName/Sex/Phone1/
// Phone2, yearOfCreation), so even with the Flutter-side mapping bug fixed,
// those fields would still have arrived as `undefined` and rendered blank.
// This test protects the select clause itself, independent of the Flutter
// fix — see test/home_screen_vt_prefill_test.dart for the Flutter side.
describe('DsmoService.getMyCompany', () => {
  it('select clause includes every VT registration-time field', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'company-1' });
    const prisma = { company: { findUnique } } as unknown as PrismaService;
    const service = new DsmoService(
      prisma,
      {} as ValidationService,
      {} as AuditService,
      {} as PdfService,
    );

    await service.getMyCompany('user-1');

    expect(findUnique).toHaveBeenCalledTimes(1);
    const call = findUnique.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'user-1' });

    const vtFields = [
      'sigle',
      'cfpType',
      'educationSystem',
      'functionalStatus',
      'nonFunctionalReason',
      'nonFunctionalReasonOther',
      'promoterName',
      'promoterSex',
      'promoterPhone1',
      'promoterPhone2',
      'yearOfCreation',
    ];
    for (const field of vtFields) {
      expect(call.select[field]).toBe(true);
    }
  });

  it('does not drop any pre-existing selected field (regression guard for '
    + 'the six established entity types)', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'company-1' });
    const prisma = { company: { findUnique } } as unknown as PrismaService;
    const service = new DsmoService(
      prisma,
      {} as ValidationService,
      {} as AuditService,
      {} as PdfService,
    );

    await service.getMyCompany('user-1');

    const call = findUnique.mock.calls[0][0];
    const preExistingFields = [
      'id', 'name', 'taxNumber', 'cnpsNumber', 'registrationNumber',
      'establishmentId', 'establishmentIdGeneratedAt', 'entityType',
      'region', 'department', 'subdivision', 'address', 'phone', 'phone2',
      'poBox', 'mainActivity', 'secondaryActivity', 'parentCompany',
      'legalStatus', 'enterpriseSize', 'area', 'branch',
      'respondentFirstName', 'respondentLastName', 'respondentFunction',
      'respondentPhone', 'respondentPhone2', 'totalEmployees', 'menCount',
      'womenCount',
    ];
    for (const field of preExistingFields) {
      expect(call.select[field]).toBe(true);
    }

    const additionalFields = [
      'cooperativeType', 'ctdType', 'projectNature', 'mainMission', 'socialCapital', 'fax', 'sectorId', 'trainingDomains'
    ];
    for (const field of additionalFields) {
      expect(call.select[field]).toBe(true);
    }
    expect(call.select.user).toBeDefined();
  });
});

describe('DsmoService.listCompanies ordering', () => {
  function makeService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      company: {
        count: jest.fn().mockResolvedValue(0),
        findMany,
      },
    } as unknown as PrismaService;
    const service = new DsmoService(
      prisma,
      {} as ValidationService,
      {} as AuditService,
      {} as PdfService,
    );
    return { findMany, service };
  }

  it('sorts oldest-first before pagination when requested', async () => {
    const { findMany, service } = makeService();
    await service.listCompanies({ sortOrder: 'oldest', page: 2 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        skip: 20,
      }),
    );
  });

  it('keeps companies newest-first by default', async () => {
    const { findMany, service } = makeService();
    await service.listCompanies({});
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('filters a selected year and semester by Douala calendar boundaries before pagination', async () => {
    const { findMany, service } = makeService();
    await service.listCompanies({ year: 2024, semester: 1 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2024-01-01T00:00:00+01:00'),
            lt: new Date('2024-07-01T00:00:00+01:00'),
          },
        }),
      }),
    );
  });

  it('filters a quarter across years when no year is selected', async () => {
    const { findMany, service } = makeService();
    await service.listCompanies({ quarter: 4 });
    const where = findMany.mock.calls[0][0].where;
    const periodCondition = where.AND.find((condition: any) => condition.OR);
    const currentDoualaYear = Number(
      new Intl.DateTimeFormat('en', { timeZone: 'Africa/Douala', year: 'numeric' }).format(new Date()),
    );
    expect(periodCondition.OR[0]).toEqual({
      createdAt: {
        gte: new Date('2000-10-01T00:00:00+01:00'),
        lt: new Date('2001-01-01T00:00:00+01:00'),
      },
    });
    expect(periodCondition.OR[periodCondition.OR.length - 1]).toEqual({
      createdAt: {
        gte: new Date(`${currentDoualaYear}-10-01T00:00:00+01:00`),
        lt: new Date(`${currentDoualaYear + 1}-01-01T00:00:00+01:00`),
      },
    });
  });
});
