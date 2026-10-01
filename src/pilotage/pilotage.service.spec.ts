import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    audits,
    campaigns,
    transactionOptions,
  };
}

function asRegions(regions: unknown): Array<Record<string, any>> {
  return regions as Array<Record<string, any>>;
}

const national = { role: 'CENTRAL', region: 'Littoral' };
const regional = { role: 'REGIONAL', region: 'Centre' };
const divisional = { role: 'DIVISIONAL', region: 'Centre', department: 'Mfoundi' };

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
    await expect(harness.service.getInscriptionTargets({ role: 'SUPER_ADMIN_DSMO', region: 'Centre' }, '2026'))
      .resolves.toEqual({ year: 2026, central: null, regions: [] });
    await expect(harness.service.getInscriptionTargets({ role: 'REGIONAL', region: 'Extreme-Nord' }, '2026'))
      .resolves.toEqual({ year: 2026, central: null, regions: [] });
  });

  it('reports an unset region when nothing has been stored', async () => {
    const harness = createHarness();
    const result = await harness.service.getInscriptionTargets(regional, '2026');
    expect(result.regions[0]).toMatchObject({ name: 'Centre', mode: 'UNSET', inscriptionTarget: null });
    expect(asRegions(result.regions)[0].departments.every((department: { inscriptionTarget: number | null }) => department.inscriptionTarget === null)).toBe(true);
  });
});
