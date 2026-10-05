import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OnefopEntityType, OnefopStatus, Prisma, SubmissionModule } from '@prisma/client';
import { PilotageService } from './pilotage.service';
import { PrismaService } from '../prisma/prisma.service';

interface TargetRow {
  id: string;
  regionId: string;
  departmentId: string | null;
  inscriptionTarget?: number;
  submissionTarget?: number;
  year?: number;
  campaignId?: string;
  createdBy?: string;
  updatedBy?: string;
}

function createHarness() {
  const regions = [
    { id: 'r-centre', name: 'Centre' },
    { id: 'r-littoral', name: 'Littoral' },
  ];
  const departments = [
    { id: 'd-mfoundi', name: 'Mfoundi', regionId: 'r-centre' },
    { id: 'd-lekie', name: 'Lékié', regionId: 'r-centre' },
    { id: 'd-wouri', name: 'Wouri', regionId: 'r-littoral' },
  ];
  const territoryTargets: TargetRow[] = [];
  const campaignQuotas: TargetRow[] = [];
  const centralInscriptions: Array<Record<string, unknown>> = [];
  const centralQuotas: Array<Record<string, unknown>> = [];
  const companies: Array<Record<string, unknown>> = [];
  const onefopSubmissions: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const campaigns: Array<Record<string, unknown>> = [];
  let seq = 1;

  function match(row: Record<string, unknown>, where?: Record<string, unknown>) {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => value === undefined || row[key] === value);
  }

  function collection(rows: Array<Record<string, unknown>>) {
    return {
      findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
        rows.filter((row) => match(row, where)),
      ),
      findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((row) => match(row, where)) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `id-${seq++}`, departmentId: null, ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row as object, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((item) => item.id === where.id);
        const [row] = rows.splice(index, 1);
        return row;
      }),
    };
  }

  const transactionOptions: unknown[] = [];
  const prisma: Record<string, unknown> = {
    region: {
      count: jest.fn(async () => regions.length),
      findMany: jest.fn(async (args?: { where?: { id?: string }; include?: { departments?: { where?: { id?: string } } } }) => {
        const list = regions
          .filter((region) => !args?.where?.id || region.id === args.where.id)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!args?.include?.departments) return list;
        const only = args.include.departments.where?.id;
        return list.map((region) => ({
          ...region,
          departments: departments
            .filter((department) => department.regionId === region.id && (!only || department.id === only))
            .map((department) => ({ id: department.id, name: department.name })),
        }));
      }),
      findUnique: jest.fn(async (args: { where: { id: string }; select?: { name?: boolean } }) => {
        const region = regions.find((item) => item.id === args.where.id);
        if (!region) return null;
        if (args.select && args.select.name !== true) return { id: region.id };
        return region;
      }),
    },
    department: {
      count: jest.fn(async () => departments.length),
      findMany: jest.fn(async (args?: { where?: { regionId?: string } }) =>
        departments.filter((department) => !args?.where?.regionId || department.regionId === args.where.regionId),
      ),
      findUnique: jest.fn(async (args: { where: { id: string } }) =>
        departments.find((department) => department.id === args.where.id) ?? null,
      ),
    },
    dataCampaign: {
      findUnique: jest.fn(async (args: { where: { id: string } }) =>
        campaigns.find((campaign) => campaign.id === args.where.id) ?? null,
      ),
    },
    territoryTarget: collection(territoryTargets as unknown as Array<Record<string, unknown>>),
    campaignQuota: collection(campaignQuotas as unknown as Array<Record<string, unknown>>),
    centralInscriptionTarget: collection(centralInscriptions),
    centralCampaignQuota: collection(centralQuotas),
    company: {
      findMany: jest.fn(async (args?: { where?: { regionId?: string; departmentId?: string } }) =>
        companies.filter((company) => {
          if (args?.where?.regionId && company.regionId !== args.where.regionId) return false;
          if (args?.where?.departmentId && company.departmentId !== args.where.departmentId) return false;
          return true;
        }),
      ),
    },
    onefopSubmission: {
      findMany: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        onefopSubmissions.filter((sub) => {
          if (args?.where?.campaignId && sub.campaignId !== args.where.campaignId) return false;
          if (args?.where?.regionId && sub.regionId !== args.where.regionId) return false;
          if (args?.where?.departmentId && sub.departmentId !== args.where.departmentId) return false;
          return true;
        }),
      ),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      }),
    },
    $transaction: jest.fn(),
  };
  (prisma.$transaction as jest.Mock).mockImplementation(async (work: (tx: unknown) => Promise<unknown>, options?: unknown) => {
    transactionOptions.push(options);
    return work(prisma);
  });

  return {
    service: new PilotageService(prisma as unknown as PrismaService),
    prisma,
    territoryTargets,
    campaignQuotas,
    centralInscriptions,
    centralQuotas,
    companies,
    onefopSubmissions,
    audits,
    campaigns,
    transactionOptions,
  };
}

function asRegions(regions: unknown): Array<Record<string, any>> {
  return regions as Array<Record<string, any>>;
}

const national = { role: 'ADMIN_ONEFOP', region: 'Littoral' };
const regional = { role: 'REGIONAL_ADMIN', region: 'Centre' };
const divisional = { role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' };

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db', { code, clientVersion: '5.22.0' });
}

describe('PilotageService writes', () => {
  it('replaces one region, keeps an unchanged value unaudited, and leaves other regions stored', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'keep', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10, createdBy: 'old', updatedBy: 'old' },
      { id: 'drop-dept', year: 2026, regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 20, createdBy: 'old', updatedBy: 'old' },
      { id: 'drop-region', year: 2026, regionId: 'r-centre', departmentId: null, inscriptionTarget: 100, createdBy: 'old', updatedBy: 'old' },
      { id: 'other', year: 2026, regionId: 'r-littoral', departmentId: 'd-wouri', inscriptionTarget: 7, createdBy: 'old', updatedBy: 'old' },
    );
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 40, createdBy: 'old', updatedBy: 'old' });

    const result = await harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10 }],
    });

    expect(harness.territoryTargets.map((row) => row.id).sort()).toEqual(['keep', 'other']);
    expect(harness.territoryTargets.find((row) => row.id === 'keep')).toMatchObject({ createdBy: 'old', updatedBy: 'old' });
    expect(harness.audits.map((row) => row.action).sort()).toEqual(['INSCRIPTION_TARGET_DELETE', 'INSCRIPTION_TARGET_DELETE']);
    expect(harness.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 'drop-dept', previousValue: '20', newValue: null, userId: 'actor-1', resourceType: 'TerritoryTarget' }),
      expect.objectContaining({ resourceId: 'drop-region', previousValue: '100', newValue: null }),
    ]));
    expect(harness.centralInscriptions).toHaveLength(1);
    expect(harness.transactionOptions).toEqual([{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
    const centre = asRegions(result.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'DEPARTMENT', inscriptionTarget: 10 });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ inscriptionTarget: 7 });
    expect(result.central).toEqual({ inscriptionTarget: 40 });
  });

  it('updates a changed target and stores zero as a real target', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'keep', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10, createdBy: 'old', updatedBy: 'old' },
    );
    await harness.service.putInscriptionTargets('actor-1', national, 2026, {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 0 }],
      central: { inscriptionTarget: 0 },
    });
    expect(harness.territoryTargets[0]).toMatchObject({ inscriptionTarget: 0, createdBy: 'old', updatedBy: 'actor-1' });
    expect(harness.centralInscriptions[0]).toMatchObject({ inscriptionTarget: 0, createdBy: 'actor-1' });
    expect(harness.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'INSCRIPTION_TARGET_UPSERT', previousValue: '10', newValue: '0' }),
      expect.objectContaining({ action: 'CENTRAL_INSCRIPTION_TARGET_UPSERT', previousValue: null, newValue: '0', resourceType: 'CentralInscriptionTarget' }),
    ]));
  });

  it('switches a region to a single regional target and can clear the central row', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'dept', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10, createdBy: 'old', updatedBy: 'old' },
    );
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 40 });
    const result = await harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', departmentId: null, inscriptionTarget: 80 }],
      central: null,
    });
    expect(harness.territoryTargets).toEqual([
      expect.objectContaining({ regionId: 'r-centre', departmentId: null, inscriptionTarget: 80 }),
    ]);
    expect(harness.centralInscriptions).toEqual([]);
    expect(harness.audits.map((row) => row.action).sort()).toEqual([
      'CENTRAL_INSCRIPTION_TARGET_DELETE',
      'INSCRIPTION_TARGET_DELETE',
      'INSCRIPTION_TARGET_UPSERT',
    ]);
    const centre = asRegions(result.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'REGION', inscriptionTarget: 80 });
    expect(result.central).toBeNull();
  });

  it('does not audit a central value that is already stored', async () => {
    const harness = createHarness();
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 40, createdBy: 'old', updatedBy: 'old' });
    await harness.service.putInscriptionTargets('actor-1', national, '2026', { entries: [], central: { inscriptionTarget: 40 } });
    expect(harness.audits).toEqual([]);
    expect(harness.centralInscriptions[0]).toMatchObject({ updatedBy: 'old' });
  });

  it('rejects a bad body, a department outside its region, an unknown region, and an oversized body before opening a transaction', async () => {
    const harness = createHarness();
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: -1 }],
    })).rejects.toThrow('entier positif ou nul');
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [
        { regionId: 'r-centre', departmentId: null, inscriptionTarget: 1 },
        { regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 1 },
      ],
    })).rejects.toThrow('mélange un objectif régional');
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-littoral', departmentId: 'd-mfoundi', inscriptionTarget: 1 }],
    })).rejects.toThrow("Le département 'Mfoundi' n'appartient pas à la région 'Littoral'.");
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'missing', departmentId: null, inscriptionTarget: 1 }],
    })).rejects.toThrow("Région introuvable (ID: 'missing').");
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'missing', clear: true }],
    })).rejects.toThrow("Région introuvable (ID: 'missing').");
    (harness.prisma.region as { count: jest.Mock }).count.mockResolvedValue(1);
    (harness.prisma.department as { count: jest.Mock }).count.mockResolvedValue(1);
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [
        { regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 1 },
        { regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 1 },
        { regionId: 'r-littoral', departmentId: 'd-wouri', inscriptionTarget: 1 },
      ],
    })).rejects.toThrow('au-delà des 2 territoires connus');
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries a serialization conflict once and turns a unique violation into a 409', async () => {
    const harness = createHarness();
    let attempts = 0;
    (harness.prisma.$transaction as jest.Mock).mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
      attempts += 1;
      if (attempts === 1) throw knownError('P2034');
      return work(harness.prisma);
    });
    await harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 4 }],
    });
    expect(attempts).toBe(2);
    expect(harness.territoryTargets).toEqual([expect.objectContaining({ inscriptionTarget: 4 })]);

    (harness.prisma.$transaction as jest.Mock).mockImplementation(async () => {
      throw knownError('P2002');
    });
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 5 }],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes a quota only for an ONEFOP campaign', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    const result = await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-littoral', departmentId: 'd-wouri', submissionTarget: 4 }],
      central: { submissionTarget: 9 },
    });
    expect(harness.campaignQuotas[0]).toMatchObject({ campaignId: 'camp-1', submissionTarget: 4, departmentId: 'd-wouri' });
    expect(harness.centralQuotas[0]).toMatchObject({ submissionTarget: 9 });
    expect(harness.audits.map((row) => row.action).sort()).toEqual(['CAMPAIGN_QUOTA_UPSERT', 'CENTRAL_CAMPAIGN_QUOTA_UPSERT']);
    expect(result.campaign).toMatchObject({ id: 'camp-1', collectionType: 'ONEFOP', status: 'DRAFT' });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ mode: 'DEPARTMENT', submissionTarget: 4 });

    harness.campaigns.push({ id: 'dsmo', name: 'DSMO', code: 'D', collectionType: 'DSMO', status: 'ACTIVE' });
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'dsmo', { entries: [] }))
      .rejects.toThrow('Les objectifs de campagne concernent uniquement les campagnes ONEFOP.');
    await expect(harness.service.getCampaignQuotas(national, 'dsmo'))
      .rejects.toThrow('Les objectifs de campagne concernent uniquement les campagnes ONEFOP.');
    await expect(harness.service.getCampaignQuotas(national, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.campaignQuotas).toHaveLength(1);
  });

  it("clears a region's inscription targets back to UNSET, auditing each deleted row", async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 't-mf', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10, createdBy: 'old', updatedBy: 'old' },
      { id: 't-lek', year: 2026, regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 20, createdBy: 'old', updatedBy: 'old' },
      { id: 't-wouri', year: 2026, regionId: 'r-littoral', departmentId: 'd-wouri', inscriptionTarget: 7, createdBy: 'old', updatedBy: 'old' },
    );
    const result = await harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', clear: true }],
    });
    expect(harness.territoryTargets.map((row) => row.id)).toEqual(['t-wouri']);
    expect(harness.audits.map((row) => row.action).sort()).toEqual([
      'INSCRIPTION_TARGET_DELETE',
      'INSCRIPTION_TARGET_DELETE',
    ]);
    expect(harness.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 't-mf', previousValue: '10', newValue: null, userId: 'actor-1' }),
      expect.objectContaining({ resourceId: 't-lek', previousValue: '20', newValue: null, userId: 'actor-1' }),
    ]));
    const centre = asRegions(result.regions).find((r) => r.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'UNSET', inscriptionTarget: null });
    const littoral = asRegions(result.regions).find((r) => r.name === 'Littoral');
    expect(littoral).toMatchObject({ inscriptionTarget: 7 });
  });

  it("clears a region's campaign quotas and is a safe no-op when already UNSET", async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    harness.campaignQuotas.push(
      { id: 'q-centre', campaignId: 'camp-1', regionId: 'r-centre', departmentId: null, submissionTarget: 50, createdBy: 'old', updatedBy: 'old' },
    );
    const result = await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-centre', clear: true }],
    });
    expect(harness.campaignQuotas).toHaveLength(0);
    expect(harness.audits).toEqual([
      expect.objectContaining({ action: 'CAMPAIGN_QUOTA_DELETE', resourceId: 'q-centre', previousValue: '50', newValue: null }),
    ]);
    const centre = asRegions(result.regions).find((r) => r.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'UNSET', submissionTarget: null });

    // Clearing an already UNSET region causes 0 audits
    await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-centre', clear: true }],
    });
    expect(harness.audits).toHaveLength(1);
  });

  it('rejects clear combined with a value for the same region before opening a transaction', async () => {
    const harness = createHarness();
    await expect(harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [
        { regionId: 'r-centre', clear: true },
        { regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 5 },
      ],
    })).rejects.toThrow('La région « Centre » ne peut pas combiner « clear » avec d\'autres lignes.');
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not write or audit when clearing an already UNSET region', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'other', year: 2026, regionId: 'r-littoral', departmentId: 'd-wouri', inscriptionTarget: 7 },
    );
    const result = await harness.service.putInscriptionTargets('actor-1', national, '2026', {
      entries: [{ regionId: 'r-centre', clear: true }],
    });
    expect(harness.territoryTargets.map((row) => row.id)).toEqual(['other']);
    expect(harness.audits).toEqual([]);
    const centre = asRegions(result.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'UNSET', inscriptionTarget: null });
  });
});

describe('PilotageService reads', () => {
  function seed(harness: ReturnType<typeof createHarness>) {
    harness.territoryTargets.push(
      { id: 'mf', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10 },
      { id: 'lek', year: 2026, regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 15 },
      { id: 'wouri', year: 2026, regionId: 'r-littoral', departmentId: 'd-wouri', inscriptionTarget: 7 },
    );
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 40 });
  }

  it('sums a region for a regional reader and hides the central target', async () => {
    const harness = createHarness();
    seed(harness);
    const result = await harness.service.getInscriptionTargets(regional, '2026');
    expect(result.central).toBeNull();
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]).toMatchObject({ name: 'Centre', mode: 'DEPARTMENT', inscriptionTarget: 25 });
    expect(result.regions[0].departments).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Mfoundi', inscriptionTarget: 10 }),
      expect.objectContaining({ name: 'Lékié', inscriptionTarget: 15 }),
    ]));
  });

  it('shows a divisional reader only their department, with no sibling targets and no region sum', async () => {
    const harness = createHarness();
    seed(harness);
    const result = await harness.service.getInscriptionTargets(divisional, '2026');
    expect(result.central).toBeNull();
    expect(result.regions).toEqual([
      expect.objectContaining({
        name: 'Centre',
        mode: 'DEPARTMENT',
        inscriptionTarget: null,
        departments: [{ departmentId: 'd-mfoundi', name: 'Mfoundi', inscriptionTarget: 10 }],
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('Lékié');
    expect(JSON.stringify(result)).not.toContain('Wouri');
    expect((harness.prisma.centralInscriptionTarget as { findUnique: jest.Mock }).findUnique).not.toHaveBeenCalled();
  });

  it('shows the regional target to a divisional reader when the region is in regional mode', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'region', year: 2026, regionId: 'r-centre', departmentId: null, inscriptionTarget: 80 },
    );
    const result = await harness.service.getInscriptionTargets(divisional, '2026');
    expect(result.regions[0]).toMatchObject({
      mode: 'REGION',
      inscriptionTarget: 80,
      departments: [expect.objectContaining({ name: 'Mfoundi', inscriptionTarget: null })],
    });
  });

  it('returns every region and the central target to a national reader, and an empty grid when scope fails closed', async () => {
    const harness = createHarness();
    seed(harness);
    harness.territoryTargets.push(
      { id: 'mixed-region', year: 2026, regionId: 'r-littoral', departmentId: null, inscriptionTarget: 3 },
    );
    const result = await harness.service.getInscriptionTargets(national, '2026');
    expect(result.central).toEqual({ inscriptionTarget: 40 });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ mode: 'MIXED', inscriptionTarget: null });

    await expect(harness.service.getInscriptionTargets(undefined, '2026')).resolves.toEqual({ year: 2026, central: null, regions: [] });
    await expect(harness.service.getInscriptionTargets({ role: 'AUDITOR', region: 'Centre' }, '2026'))
      .resolves.toEqual({ year: 2026, central: null, regions: [] });
    await expect(harness.service.getInscriptionTargets({ role: 'REGIONAL_ADMIN', region: 'Extreme-Nord' }, '2026'))
      .resolves.toEqual({ year: 2026, central: null, regions: [] });
  });

  it('reports an unset region when nothing has been stored', async () => {
    const harness = createHarness();
    const result = await harness.service.getInscriptionTargets(regional, '2026');
    expect(result.regions[0]).toMatchObject({ name: 'Centre', mode: 'UNSET', inscriptionTarget: null });
    expect(asRegions(result.regions)[0].departments.every((department: { inscriptionTarget: number | null }) => department.inscriptionTarget === null)).toBe(true);
  });
});

describe('PilotageService coverage', () => {
  function company(overrides: Record<string, unknown> = {}) {
    return {
      entityType: 'ENTREPRISE',
      regionId: 'r-centre',
      departmentId: 'd-mfoundi',
      establishmentId: 'EN26000100',
      establishmentIdGeneratedAt: new Date('2026-06-01T10:00:00.000Z'),
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
      departmentRef: { regionId: 'r-centre' },
      user: { status: 'ACTIVE', isActive: true },
      ...overrides,
    };
  }

  it('computes stock, in-year, pending, and rate for a national reader', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'mf', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10 },
      { id: 'lek', year: 2026, regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 0 },
    );
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 4 });
    harness.companies.push(
      company(),
      company({ establishmentId: 'EN25000100', establishmentIdGeneratedAt: new Date('2025-03-01T00:00:00.000Z') }),
      company({ user: { status: 'PENDING_APPROVAL', isActive: true }, establishmentId: null }),
      company({ user: { status: 'UNDER_REVIEW', isActive: true }, establishmentId: null }),
      company({ user: { status: 'COMPLEMENTS_REQUESTED', isActive: true }, establishmentId: null }),
      company({ entityType: 'ADMINISTRATION', regionId: 'r-centre', departmentId: 'd-mfoundi', establishmentId: 'AD26000100' }),
      company({ entityType: null, establishmentId: 'EN26000900' }),
      company({ regionId: null, departmentId: null, establishmentId: 'EN26000800' }),
      company({ departmentId: 'd-lekie', establishmentId: 'EN26000200', departmentRef: { regionId: 'r-centre' } }),
      company({ user: { status: 'ACTIVE', isActive: false } }),
      company({ user: { status: 'DRAFT', isActive: true } }),
    );
    const result = await harness.service.getCoverage(national, '2026');
    expect(result.central).toMatchObject({
      registered: 1,
      registeredInYear: 1,
      inscriptionTarget: 4,
      rate: 0.25,
    });
    expect(result.unassigned).toMatchObject({ registered: 1, pendingApproval: 0 });
    expect(result.nullEntityType).toMatchObject({ registered: 1 });
    const centre = asRegions(result.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({
      mode: 'DEPARTMENT',
      registered: 3,
      registeredInYear: 2,
      pendingApproval: 1,
      pendingReview: 1,
      complementsRequested: 1,
      inscriptionTarget: 10,
      rate: 0.3,
    });
    const mfoundi = centre!.departments.find((department: { name: string }) => department.name === 'Mfoundi');
    expect(mfoundi).toMatchObject({
      registered: 2,
      registeredInYear: 1,
      pendingApproval: 1,
      pendingReview: 1,
      complementsRequested: 1,
      inscriptionTarget: 10,
      rate: 0.2,
    });
    const lekie = centre!.departments.find((department: { name: string }) => department.name === 'Lékié');
    expect(lekie).toMatchObject({ registered: 1, inscriptionTarget: 0, rate: null });
  });

  it('hides central, unassigned, and other regions from a regional reader', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'mf', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10 },
    );
    harness.centralInscriptions.push({ id: 'central', year: 2026, inscriptionTarget: 4 });
    harness.companies.push(
      company(),
      company({ regionId: 'r-littoral', departmentId: 'd-wouri', departmentRef: { regionId: 'r-littoral' } }),
      company({ entityType: 'ADMINISTRATION' }),
    );
    const result = await harness.service.getCoverage(regional, '2026');
    expect(result.central).toBeNull();
    expect(result.unassigned).toBeNull();
    expect(result.nullEntityType).toBeNull();
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]).toMatchObject({ name: 'Centre', registered: 1, rate: 0.1 });
    expect((harness.prisma.centralInscriptionTarget as { findUnique: jest.Mock }).findUnique).not.toHaveBeenCalled();
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { regionId: 'r-centre' } }),
    );
  });

  it('shows a divisional reader only their department stock and hides the region stock and rate', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'mf', year: 2026, regionId: 'r-centre', departmentId: 'd-mfoundi', inscriptionTarget: 10 },
      { id: 'lek', year: 2026, regionId: 'r-centre', departmentId: 'd-lekie', inscriptionTarget: 15 },
    );
    harness.companies.push(
      company(),
      company({ departmentId: 'd-lekie', departmentRef: { regionId: 'r-centre' } }),
    );
    const result = await harness.service.getCoverage(divisional, '2026');
    expect(result.central).toBeNull();
    expect(result.regions).toEqual([
      expect.objectContaining({
        name: 'Centre',
        mode: 'DEPARTMENT',
        registered: null,
        registeredInYear: null,
        pendingApproval: null,
        pendingReview: null,
        complementsRequested: null,
        inscriptionTarget: null,
        rate: null,
        departments: [
          expect.objectContaining({
            name: 'Mfoundi',
            registered: 1,
            inscriptionTarget: 10,
            rate: 0.1,
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('Lékié');
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: 'd-mfoundi' } }),
    );
  });

  it('keeps the region target visible to a divisional reader in REGION mode and still hides region stock', async () => {
    const harness = createHarness();
    harness.territoryTargets.push(
      { id: 'region', year: 2026, regionId: 'r-centre', departmentId: null, inscriptionTarget: 80 },
    );
    harness.companies.push(company());
    const result = await harness.service.getCoverage(divisional, '2026');
    expect(result.regions[0]).toMatchObject({
      mode: 'REGION',
      inscriptionTarget: 80,
      registered: null,
      rate: null,
      departments: [expect.objectContaining({ name: 'Mfoundi', registered: 1, inscriptionTarget: null, rate: null })],
    });
  });

  it('returns an empty grid when scope fails closed', async () => {
    const harness = createHarness();
    await expect(harness.service.getCoverage(undefined, '2026')).resolves.toEqual({
      year: 2026,
      central: null,
      unassigned: null,
      nullEntityType: null,
      regions: [],
    });
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });
});

describe('PilotageService.getCampaignReturns', () => {
  function campaign(id = 'c1', overrides?: Record<string, unknown>) {
    return {
      id,
      name: 'Campagne Pilote ONEFOP 2026',
      code: 'ONEFOP-2026-T1',
      collectionType: SubmissionModule.ONEFOP,
      status: 'ACTIVE',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T23:59:59Z'),
      referenceYear: 2026,
      referenceQuarter: 1,
      ...overrides,
    };
  }

  function registeredCompany(
    id: string,
    regionId: string,
    departmentId: string,
    entityType: OnefopEntityType = OnefopEntityType.ENTREPRISE,
  ) {
    return {
      id,
      entityType,
      regionId,
      departmentId,
      establishmentId: `EST-${id}`,
      establishmentIdGeneratedAt: new Date('2026-01-15'),
      createdAt: new Date('2026-01-15'),
      departmentRef: { regionId },
      user: { status: 'ACTIVE', isActive: true },
    };
  }

  it('rejects an unknown campaign with 404', async () => {
    const harness = createHarness();
    await expect(harness.service.getCampaignReturns(national, 'unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a non-ONEFOP campaign with 400', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('dsmo-1', { collectionType: SubmissionModule.DSMO }));
    await expect(harness.service.getCampaignReturns(national, 'dsmo-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('aggregates returns: status filter, deduplication of resubmissions, lateness, and territory attribution', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    // Quotas: Mfoundi = 10, Lékié = 5 -> Centre quota = 15
    harness.campaignQuotas.push(
      { id: 'q1', campaignId: 'c1', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q2', campaignId: 'c1', regionId: 'r-centre', departmentId: 'd-lekie', submissionTarget: 5 },
    );
    // Active registered companies in Mfoundi (2) and Lékié (1)
    harness.companies.push(
      registeredCompany('comp-1', 'r-centre', 'd-mfoundi'),
      registeredCompany('comp-2', 'r-centre', 'd-mfoundi'),
      registeredCompany('comp-3', 'r-centre', 'd-lekie'),
    );

    // Submissions for c1:
    // Company 1: First submitted, REJECTED; then resubmitted, APPROVED on-time in Mfoundi. (counts as 1 received, 1 approved, 1 onTime)
    harness.onefopSubmissions.push(
      {
        id: 's1-old',
        campaignId: 'c1',
        companyId: 'comp-1',
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.REJECTED,
        isLate: false,
        regionId: 'r-centre',
        departmentId: 'd-mfoundi',
        createdAt: new Date('2026-02-01'),
      },
      {
        id: 's1-new',
        campaignId: 'c1',
        companyId: 'comp-1',
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.APPROVED,
        isLate: false,
        regionId: 'r-centre',
        departmentId: 'd-mfoundi',
        createdAt: new Date('2026-02-10'),
      },
    );

    // Company 2: PENDING_REVIEW and LATE in Mfoundi (counts as 1 received, 0 approved, 1 late)
    harness.onefopSubmissions.push({
      id: 's2',
      campaignId: 'c1',
      companyId: 'comp-2',
      formType: OnefopEntityType.ENTREPRISE,
      status: OnefopStatus.PENDING_REVIEW,
      isLate: true,
      regionId: 'r-centre',
      departmentId: 'd-mfoundi',
      createdAt: new Date('2026-04-05'),
    });

    // Company 3: Only DRAFT (does not count in received)
    harness.onefopSubmissions.push({
      id: 's3',
      campaignId: 'c1',
      companyId: 'comp-3',
      formType: OnefopEntityType.ENTREPRISE,
      status: OnefopStatus.DRAFT,
      isLate: false,
      regionId: 'r-centre',
      departmentId: 'd-lekie',
      createdAt: new Date('2026-02-05'),
    });

    // Company 4: R.1 relocation test!
    // Company is registered in Littoral / Wouri, but submission was filed with Centre / Lékié.
    // Must count in Centre / Lékié!
    harness.companies.push(registeredCompany('comp-4', 'r-littoral', 'd-wouri'));
    harness.onefopSubmissions.push({
      id: 's4',
      campaignId: 'c1',
      companyId: 'comp-4',
      formType: OnefopEntityType.ENTREPRISE,
      status: OnefopStatus.CORRECTION_REQUESTED,
      isLate: false,
      regionId: 'r-centre',
      departmentId: 'd-lekie',
      createdAt: new Date('2026-02-15'),
    });

    const res = await harness.service.getCampaignReturns(national, 'c1');
    expect(res.campaign.code).toBe('ONEFOP-2026-T1');

    const centre = res.regions.find((r) => r.regionId === 'r-centre')!;
    expect(centre).toBeDefined();

    // Mfoundi: 2 received (comp-1, comp-2), 1 approved (comp-1), 1 onTime, 1 late, quota 10, stock 2
    const mfoundi = centre.departments.find((d) => d.departmentId === 'd-mfoundi')!;
    expect(mfoundi.quota).toBe(10);
    expect(mfoundi.received).toBe(2);
    expect(mfoundi.approved).toBe(1);
    expect(mfoundi.onTime).toBe(1);
    expect(mfoundi.late).toBe(1);
    expect(mfoundi.gap).toBe(8); // 10 - 2
    expect(mfoundi.quotaRate).toBe(0.2); // 2 / 10
    expect(mfoundi.registeredStock).toBe(2);
    expect(mfoundi.responseRate).toBe(1); // 2 / 2 = 1.0

    // Lékié: 1 received (comp-4 relocated return), 0 approved, 1 onTime, 0 late, quota 5, stock 1
    const lekie = centre.departments.find((d) => d.departmentId === 'd-lekie')!;
    expect(lekie.quota).toBe(5);
    expect(lekie.received).toBe(1);
    expect(lekie.approved).toBe(0);
    expect(lekie.onTime).toBe(1);
    expect(lekie.late).toBe(0);
    expect(lekie.gap).toBe(4);
    expect(lekie.registeredStock).toBe(1);
    expect(lekie.responseRate).toBe(1); // 1 / 1

    // Centre Region Rollup: sum of departments
    expect(centre.quota).toBe(15); // 10 + 5
    expect(centre.received).toBe(3); // 2 + 1
    expect(centre.approved).toBe(1); // 1 + 0
    expect(centre.onTime).toBe(2); // 1 + 1
    expect(centre.late).toBe(1); // 1 + 0
    expect(centre.gap).toBe(12); // 15 - 3
    expect(centre.registeredStock).toBe(3); // 2 + 1
    expect(centre.responseRate).toBe(1); // 3 / 3
  });

  it('routes formType === ADMINISTRATION to central bucket and excludes from territorial quotas', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    harness.centralQuotas.push({ id: 'cq1', campaignId: 'c1', submissionTarget: 50 });
    // Registered central administration in stock
    harness.companies.push(
      registeredCompany('admin-comp-1', 'r-centre', 'd-mfoundi', OnefopEntityType.ADMINISTRATION),
    );
    // Administration submission located geographically in Mfoundi
    harness.onefopSubmissions.push({
      id: 'sub-admin-1',
      campaignId: 'c1',
      companyId: 'admin-comp-1',
      formType: OnefopEntityType.ADMINISTRATION,
      status: OnefopStatus.APPROVED,
      isLate: false,
      regionId: 'r-centre',
      departmentId: 'd-mfoundi',
      createdAt: new Date('2026-02-20'),
    });

    const res = await harness.service.getCampaignReturns(national, 'c1');
    expect(res.central).toMatchObject({
      quota: 50,
      received: 1,
      approved: 1,
      onTime: 1,
      late: 0,
      gap: 49,
      registeredStock: 1,
      responseRate: 1,
    });

    // Mfoundi must NOT contain this administration return
    const centre = res.regions.find((r) => r.regionId === 'r-centre')!;
    const mfoundi = centre.departments.find((d) => d.departmentId === 'd-mfoundi')!;
    expect(mfoundi.received).toBe(0);
    expect(centre.received).toBe(0);
  });

  it('scopes properly for REGIONAL and DIVISIONAL accounts', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    harness.campaignQuotas.push(
      { id: 'q1', campaignId: 'c1', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q3', campaignId: 'c1', regionId: 'r-littoral', departmentId: 'd-wouri', submissionTarget: 20 },
    );
    harness.onefopSubmissions.push(
      {
        id: 's1',
        campaignId: 'c1',
        companyId: 'comp-1',
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.APPROVED,
        isLate: false,
        regionId: 'r-centre',
        departmentId: 'd-mfoundi',
        createdAt: new Date('2026-02-10'),
      },
      {
        id: 's2',
        campaignId: 'c1',
        companyId: 'comp-2',
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.APPROVED,
        isLate: false,
        regionId: 'r-littoral',
        departmentId: 'd-wouri',
        createdAt: new Date('2026-02-10'),
      },
    );

    // Regional (Centre) sees only Centre, central is null, totals = Centre
    const regRes = await harness.service.getCampaignReturns(regional, 'c1');
    expect(regRes.central).toBeNull();
    expect(regRes.unassigned).toBeNull();
    expect(regRes.regions).toHaveLength(1);
    expect(regRes.regions[0].regionId).toBe('r-centre');
    expect(regRes.totals.received).toBe(1);

    // Divisional (Mfoundi) sees only Mfoundi
    const divRes = await harness.service.getCampaignReturns(divisional, 'c1');
    expect(divRes.central).toBeNull();
    expect(divRes.regions).toHaveLength(1);
    expect(divRes.regions[0].departments).toHaveLength(1);
    expect(divRes.regions[0].departments[0].departmentId).toBe('d-mfoundi');
    expect(divRes.totals.received).toBe(1);
  });

  // ── Quota scope (2026-10-04 audit, finding #4) ────────────────────────────
  //
  // A territory with no quota set still contributes its returns to the
  // actuals, but must contribute to neither side of quotaRate / onTimeRate /
  // gap: its quota is unknown, not zero, so counting its returns in the
  // numerator measured them against other territories' quotas — overstating
  // the rate and hiding part of the gap.
  //
  // Exercised through getCampaignReturns rather than against the private
  // helper, so these assert the payload the endpoint actually serves.
  //
  // Fixture:
  //              quota   received  onTime   quota-backed
  //   Mfoundi        10          2       1   yes
  //   Lékié        none          1       1   no
  //   Wouri        none          2       2   no
  //   ---------------------------------------------------
  //   national       10          5       4   received 2, onTime 1
  //
  // Before the fix the national rollup read gap 5, quotaRate 0.5 and
  // onTimeRate 0.3 — all three computed over returns the quota never covered.
  function mixedQuotaHarness() {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    // Mfoundi alone carries a quota; Lékié and all of Littoral carry none.
    harness.campaignQuotas.push({
      id: 'q1',
      campaignId: 'c1',
      regionId: 'r-centre',
      departmentId: 'd-mfoundi',
      submissionTarget: 10,
    });

    // companyId, regionId, departmentId, isLate
    const placements: Array<[string, string, string, boolean]> = [
      ['comp-mf-1', 'r-centre', 'd-mfoundi', false],
      ['comp-mf-2', 'r-centre', 'd-mfoundi', true],
      ['comp-lk-1', 'r-centre', 'd-lekie', false],
      ['comp-wo-1', 'r-littoral', 'd-wouri', false],
      ['comp-wo-2', 'r-littoral', 'd-wouri', false],
    ];
    for (const [companyId, regionId, departmentId, isLate] of placements) {
      harness.companies.push(registeredCompany(companyId, regionId, departmentId));
      harness.onefopSubmissions.push({
        id: `sub-${companyId}`,
        campaignId: 'c1',
        companyId,
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.PENDING_REVIEW,
        isLate,
        regionId,
        departmentId,
        createdAt: new Date('2026-02-10'),
      });
    }
    return harness;
  }

  it('excludes a department with no quota from its region quotaRate and gap', async () => {
    const res = await mixedQuotaHarness().service.getCampaignReturns(national, 'c1');
    const centre = res.regions.find((r) => r.regionId === 'r-centre')!;

    // Lékié's return is in the actuals.
    expect(centre.received).toBe(3);
    expect(centre.onTime).toBe(2);

    // ...but only Mfoundi's 2 are measured against the quota of 10.
    expect(centre.quota).toBe(10);
    expect(centre.quotaRate).toBe(0.2); // 2/10, not 3/10
    expect(centre.gap).toBe(8); // 10-2, not 10-3
    expect(centre.onTimeRate).toBe(0.1); // 1/10, not 2/10
  });

  it('excludes a whole region with no quota from the national quotaRate numerator and denominator', async () => {
    const res = await mixedQuotaHarness().service.getCampaignReturns(national, 'c1');
    const littoral = res.regions.find((r) => r.regionId === 'r-littoral')!;

    // Littoral has no quota at all: the three quota-relative fields are null
    // rather than a rate measured against nothing.
    expect(littoral.quota).toBeNull();
    expect(littoral.quotaRate).toBeNull();
    expect(littoral.onTimeRate).toBeNull();
    expect(littoral.gap).toBeNull();
    expect(littoral.received).toBe(2);

    // It adds nothing to either side of the national rate: the denominator is
    // Mfoundi's 10, and the numerator is Mfoundi's 2.
    expect(res.totals.quota).toBe(10);
    expect(res.totals.quotaRate).toBe(0.2);
  });

  it('computes the national gap over quota-backed returns only', async () => {
    const res = await mixedQuotaHarness().service.getCampaignReturns(national, 'c1');
    expect(res.totals.gap).toBe(8); // 10-2, not 10-5
  });

  it('uses the same quota-backed denominator for onTimeRate', async () => {
    const res = await mixedQuotaHarness().service.getCampaignReturns(national, 'c1');
    // 4 of the 5 returns were on time, but only 1 of them is quota-backed.
    expect(res.totals.onTime).toBe(4);
    expect(res.totals.onTimeRate).toBe(0.1); // 1/10, not 4/10
  });

  it('keeps the quota-less returns in the national actuals', async () => {
    const res = await mixedQuotaHarness().service.getCampaignReturns(national, 'c1');
    // Narrowing the rates must not narrow the counts: every return is here.
    expect(res.totals.received).toBe(5);
    expect(res.totals.onTime).toBe(4);
    expect(res.totals.late).toBe(1);
    expect(res.totals.approved).toBe(0);
  });

  it('reports null, not zero, for every quota-relative field when no quota is set anywhere', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    // Returns but no quota rows at all, and no central quota.
    harness.companies.push(registeredCompany('comp-1', 'r-centre', 'd-mfoundi'));
    harness.onefopSubmissions.push({
      id: 's1',
      campaignId: 'c1',
      companyId: 'comp-1',
      formType: OnefopEntityType.ENTREPRISE,
      status: OnefopStatus.PENDING_REVIEW,
      isLate: false,
      regionId: 'r-centre',
      departmentId: 'd-mfoundi',
      createdAt: new Date('2026-02-10'),
    });

    const res = await harness.service.getCampaignReturns(national, 'c1');
    expect(res.totals.quota).toBeNull();
    expect(res.totals.quotaRate).toBeNull();
    expect(res.totals.onTimeRate).toBeNull();
    expect(res.totals.gap).toBeNull();
    // The return itself is still counted.
    expect(res.totals.received).toBe(1);
  });

  it('treats an explicit region-level quota as covering the whole region', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    // departmentId null = a region-level row (summarizeRegion -> mode REGION),
    // so every return in the region is quota-backed, including returns from
    // departments that have no row of their own.
    harness.campaignQuotas.push({
      id: 'q-region',
      campaignId: 'c1',
      regionId: 'r-centre',
      departmentId: null,
      submissionTarget: 20,
    });
    const placements: Array<[string, string]> = [
      ['comp-mf-1', 'd-mfoundi'],
      ['comp-lk-1', 'd-lekie'],
    ];
    for (const [companyId, departmentId] of placements) {
      harness.companies.push(registeredCompany(companyId, 'r-centre', departmentId));
      harness.onefopSubmissions.push({
        id: `sub-${companyId}`,
        campaignId: 'c1',
        companyId,
        formType: OnefopEntityType.ENTREPRISE,
        status: OnefopStatus.PENDING_REVIEW,
        isLate: false,
        regionId: 'r-centre',
        departmentId,
        createdAt: new Date('2026-02-10'),
      });
    }

    const res = await harness.service.getCampaignReturns(national, 'c1');
    const centre = res.regions.find((r) => r.regionId === 'r-centre')!;
    expect(centre.quota).toBe(20);
    expect(centre.received).toBe(2);
    // Both returns count toward the rate: the region target covers them even
    // though neither department carries a quota of its own.
    expect(centre.quotaRate).toBe(0.1); // 2/20
    expect(centre.gap).toBe(18); // 20-2
    expect(centre.onTimeRate).toBe(0.1); // 2/20
  });
});
