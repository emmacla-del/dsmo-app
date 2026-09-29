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
      'cooperativeType', 'ctdType', 'mainMission', 'socialCapital', 'fax', 'sectorId', 'trainingDomains'
    ];
    for (const field of additionalFields) {
      expect(call.select[field]).toBe(true);
    }
    expect(call.select.user).toBeDefined();
  });
});
