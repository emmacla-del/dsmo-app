import { DsmoService } from './dsmo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { PdfService } from './pdf.service';
import { isTerritoryLocked, lockCompanyIdentity, StoredCompanyIdentity } from './company-territory-lock';
import { resolveAndValidateTerritory } from '../territory/territory-resolver';

// Phase 0 of docs/plans/company-location-change-requests.md: a company may
// not move itself between reviewer scopes (CLAUDE.md §14), nor change the
// ONEFOP instrument it answers, through POST /dsmo/company or a DSMO
// declaration. Changes are ignored (2xx) and audited.

jest.mock('../territory/territory-resolver', () => ({
  resolveAndValidateTerritory: jest.fn(),
}));
const resolveMock = resolveAndValidateTerritory as jest.MockedFunction<typeof resolveAndValidateTerritory>;

const LITTORAL: StoredCompanyIdentity = {
  region: 'LITTORAL',
  department: 'WOURI',
  subdivision: 'DOUALA 1',
  regionId: 'r-lit',
  departmentId: 'd-wou',
  subdivisionId: 's-dla1',
  entityType: 'ENTERPRISE',
};

const CENTRE_TERRITORY = {
  region: 'CENTRE',
  department: 'MFOUNDI',
  subdivision: 'YAOUNDE 1',
  regionId: 'r-cen',
  departmentId: 'd-mfo',
  subdivisionId: 's-yde1',
};

describe('lockCompanyIdentity', () => {
  it('locks the territory once all three levels are stored', () => {
    expect(isTerritoryLocked(LITTORAL)).toBe(true);
    expect(isTerritoryLocked({ ...LITTORAL, subdivision: '' })).toBe(false);
    expect(isTerritoryLocked({ ...LITTORAL, department: null })).toBe(false);
  });

  it('drops a differing territory from the update and reports it', () => {
    const { data, ignored } = lockCompanyIdentity(LITTORAL, { name: 'ACME', ...CENTRE_TERRITORY });
    expect(data).toEqual({ name: 'ACME' });
    expect(ignored).toHaveLength(1);
    expect(ignored[0].field).toBe('territory');
    expect(ignored[0].sent.region).toBe('CENTRE');
    expect(ignored[0].kept.region).toBe('LITTORAL');
  });

  it('does not report a resend of the same territory (case-insensitive)', () => {
    const { data, ignored } = lockCompanyIdentity(LITTORAL, {
      name: 'ACME',
      region: 'Littoral',
      department: 'Wouri',
      subdivision: 'Douala 1',
      regionId: 'r-lit',
      departmentId: 'd-wou',
      subdivisionId: 's-dla1',
    });
    expect(data).toEqual({ name: 'ACME' });
    expect(ignored).toEqual([]);
  });

  it('lets a company with an incomplete territory complete it', () => {
    const partial = { ...LITTORAL, subdivision: null, subdivisionId: null };
    const { data, ignored } = lockCompanyIdentity(partial, { ...CENTRE_TERRITORY });
    expect(data).toEqual(CENTRE_TERRITORY);
    expect(ignored).toEqual([]);
  });

  it('keeps a stored entityType and reports a different one', () => {
    const { data, ignored } = lockCompanyIdentity(LITTORAL, { entityType: 'VOCATIONAL_TRAINING' });
    expect(data).toEqual({});
    expect(ignored).toEqual([
      { field: 'entityType', sent: { entityType: 'VOCATIONAL_TRAINING' }, kept: { entityType: 'ENTERPRISE' } },
    ]);
  });

  it('lets an entityType be chosen the first time', () => {
    const { data, ignored } = lockCompanyIdentity({ ...LITTORAL, entityType: null }, { entityType: 'COOPERATIVE' });
    expect(data).toEqual({ entityType: 'COOPERATIVE' });
    expect(ignored).toEqual([]);
  });

  it('changes nothing for a company that does not exist yet', () => {
    const update = { name: 'NEW', ...CENTRE_TERRITORY, entityType: 'ONG' };
    expect(lockCompanyIdentity(null, update)).toEqual({ data: update, ignored: [] });
  });
});

describe('DsmoService company write paths keep a locked territory', () => {
  function build(stored: StoredCompanyIdentity | null) {
    const upsert = jest.fn().mockImplementation(async (args: any) => ({ id: 'company-1', ...args.update }));
    const findUnique = jest.fn().mockResolvedValue(stored);
    const log = jest.fn().mockResolvedValue(undefined);
    const prisma = { company: { upsert, findUnique } } as unknown as PrismaService;
    const service = new DsmoService(prisma, {} as ValidationService, { log } as unknown as AuditService, {} as PdfService);
    return { service, upsert, log };
  }

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(CENTRE_TERRITORY as any);
  });

  it('POST /dsmo/company: a differing territory and entityType are kept and audited', async () => {
    const { service, upsert, log } = build(LITTORAL);
    await service.saveCompanyProfile('user-1', {
      name: 'ACME',
      ...CENTRE_TERRITORY,
      entityType: 'VOCATIONAL_TRAINING',
    });

    const { update, create } = upsert.mock.calls[0][0];
    for (const key of ['region', 'department', 'subdivision', 'regionId', 'departmentId', 'subdivisionId', 'entityType']) {
      expect(update).not.toHaveProperty(key);
    }
    expect(update.name).toBe('ACME');
    // The create branch (no stored company) is unchanged.
    expect(create.region).toBe('CENTRE');

    const actions = log.mock.calls.map((c) => c[1]);
    expect(actions).toEqual(
      expect.arrayContaining(['COMPANY_TERRITORY_CHANGE_IGNORED', 'COMPANY_ENTITY_TYPE_CHANGE_IGNORED']),
    );
    const territoryAudit = log.mock.calls.find((c) => c[1] === 'COMPANY_TERRITORY_CHANGE_IGNORED')!;
    expect(territoryAudit[5]).toMatchObject({ region: 'LITTORAL' }); // previousValue = kept
    expect(territoryAudit[6]).toMatchObject({ region: 'CENTRE' }); // newValue = attempted
  });

  it('POST /dsmo/company: resending the stored territory writes no ignore audit', async () => {
    resolveMock.mockResolvedValue({
      region: 'LITTORAL', department: 'WOURI', subdivision: 'DOUALA 1',
      regionId: 'r-lit', departmentId: 'd-wou', subdivisionId: 's-dla1',
    } as any);
    const { service, log } = build(LITTORAL);
    await service.saveCompanyProfile('user-1', { name: 'ACME', entityType: 'ENTERPRISE' });
    expect(log.mock.calls.map((c) => c[1])).toEqual(['CREATE_COMPANY_PROFILE']);
  });

  it('POST /dsmo/company: a company with no stored territory gets the sent one', async () => {
    const { service, upsert } = build({ ...LITTORAL, region: '', department: '', subdivision: '' });
    await service.saveCompanyProfile('user-1', { name: 'ACME' });
    expect(upsert.mock.calls[0][0].update.region).toBe('CENTRE');
  });

  it('DSMO declaration path (createOrUpdateCompany): a differing territory is kept and audited', async () => {
    const { service, upsert, log } = build(LITTORAL);
    await service.createOrUpdateCompany('user-1', { name: 'ACME', ...CENTRE_TERRITORY } as any);
    const { update } = upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty('region');
    expect(update).not.toHaveProperty('subdivisionId');
    expect(log.mock.calls.map((c) => c[1])).toContain('COMPANY_TERRITORY_CHANGE_IGNORED');
  });
});
