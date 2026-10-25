// Defect 5 of the 2026-10-15 VT run, export page (/admin/diffusion):
// - the summary counts what the export will hold (POST export/submissions/count);
// - a .sps opens the CSV under the name it was saved as (csvFilename).
import { UserRole } from '@prisma/client';
import { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import { CanonicalSchemaAdapterService } from '../canonical-schema-adapter.service';
import { DataManagementController } from '../data-management.controller';
import { DataManagementService } from '../data-management.service';
import { safeCsvFilename } from './export-filters';

const adapter = new CanonicalSchemaAdapterService(new OnefopSchemaLoaderService());

describe('safeCsvFilename', () => {
  it('takes a plain CSV file name', () => {
    expect(safeCsvFilename('onefop_export_QUARTERLY_2026_T4_001_2026-10-16.csv', 'd.csv')).toBe(
      'onefop_export_QUARTERLY_2026_T4_001_2026-10-16.csv',
    );
  });

  it('keeps the default for anything that is not one', () => {
    for (const bad of [undefined, '', 'x.sav', '../x.csv', 'a/b.csv', "x'.csv", 'x .csv', '.hidden.csv', 'x.csv\n', 42]) {
      expect(safeCsvFilename(bad, 'onefop_submissions.csv')).toBe('onefop_submissions.csv');
    }
  });
});

describe('the .sps opens the CSV as saved', () => {
  const service = new DataManagementService({} as any, undefined, adapter);

  it('main dataset: the given name, else the default', async () => {
    const named = await service.buildSpssManifest({ entityType: 'VOCATIONAL_TRAINING', csvFilename: 'onefop_export_X_2026-10-16.csv' });
    expect(named.sps).toContain("/FILE='onefop_export_X_2026-10-16.csv'");
    const plain = await service.buildSpssManifest({ entityType: 'VOCATIONAL_TRAINING' });
    expect(plain.sps).toContain("/FILE='onefop_submissions.csv'");
  });

  it('8.8 staff list: the given name, else the default', async () => {
    expect((await service.buildVtRosterManifest('onefop_8-8_liste_nominative_X_2026-10-16.csv')).sps).toContain(
      "/FILE='onefop_8-8_liste_nominative_X_2026-10-16.csv'",
    );
    expect((await service.buildVtRosterManifest()).sps).toContain("/FILE='onefop_8-8_liste_nominative.csv'");
  });
});

describe('countExport', () => {
  const setup = (groups: Array<{ formType: string; _count: number }>) => {
    const groupBy = jest.fn(async () => groups);
    const service = new DataManagementService({ onefopSubmission: { groupBy } } as any, undefined, adapter);
    return { service, groupBy };
  };

  it('counts the export rows, in total and per type, in one grouped query', async () => {
    const { service, groupBy } = setup([
      { formType: 'VOCATIONAL_TRAINING', _count: 3 },
    ]);
    const result = await service.countExport({ entityType: 'VOCATIONAL_TRAINING', statuses: ['APPROVED'] });
    expect(result).toEqual({ total: 3, byFormType: { VOCATIONAL_TRAINING: 3 } });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('uses the export selection: filters, statistical eligibility and territory', async () => {
    const { service, groupBy } = setup([]);
    await service.countExport(
      { partition: 'DEMAND', region: 'Littoral', campaignId: 'c-1', statuses: ['APPROVED', 'PENDING_REVIEW'] },
      { role: UserRole.REGIONAL_ADMIN, region: 'Littoral', regionId: 'r-littoral' },
    );
    const arg = (groupBy.mock.calls[0] as any[])[0];
    expect(arg.by).toEqual(['formType']);
    const where = JSON.stringify(arg.where);
    expect(where).toContain('"campaignId":"c-1"');
    expect(where).toContain('"regionId":"r-littoral"');
    expect(where).toContain('PENDING_REVIEW');
    expect(where).toContain('"isBlocking":true'); // open blocking anomalies stay out
    expect(where).not.toContain('VOCATIONAL_TRAINING'); // employers only
  });

  // ADMIN_ONEFOP_SUBMISSIONS joined the list with the 2026-10-25 role split:
  // the declaration domain is exactly what this count summarises. The
  // registrations specialist is deliberately absent.
  it('is open to the roles that may download the export', () => {
    const roles = Reflect.getMetadata('roles', (DataManagementController.prototype as any).postExportSubmissionsCount);
    expect(roles).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN_ONEFOP,
      UserRole.ADMIN_ONEFOP_SUBMISSIONS,
      UserRole.REGIONAL_ADMIN,
    ]);
    expect(roles).not.toContain(UserRole.ADMIN_ONEFOP_REGISTRATIONS);
  });
});
