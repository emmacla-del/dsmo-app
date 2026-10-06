import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OnefopEntityType, OnefopStatus, Prisma, SubmissionModule } from '@prisma/client';
import { PilotageService } from './pilotage.service';
import { PilotageController } from './pilotage.controller';
import { PrismaService } from '../prisma/prisma.service';

interface TargetRow {
  id: string;
  /**
   * The campaign-quota table also holds the ADMINISTRATION cohort row, which
   * belongs to no territory. match() is strict equality, so a TERRITORIAL
   * fixture that omits scopeKind is invisible to the service's filtered reads.
   */
  scopeKind?: 'TERRITORIAL' | 'ADMINISTRATION';
  regionId: string | null;
  departmentId: string | null;
  submissionTarget?: number;
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
  const campaignQuotas: TargetRow[] = [];
  const companies: Array<Record<string, unknown>> = [];
  const onefopSubmissions: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const campaigns: Array<Record<string, unknown>> = [];
  let seq = 1;

  /**
   * Strict equality, with one exception: `{ in: [...] }`. The coverage
   * roll-ups fold several campaigns at once and name their quarters
   * explicitly, so both `campaignId` and `referenceQuarter` arrive as `in`
   * filters. Everything else stays strict on purpose — a quota fixture that
   * omits `scopeKind` must stay invisible to the service's filtered reads.
   */
  function match(row: Record<string, unknown>, where?: Record<string, unknown>) {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (value !== null && typeof value === 'object' && Array.isArray((value as { in?: unknown }).in)) {
        return (value as { in: unknown[] }).in.includes(row[key]);
      }
      return row[key] === value;
    });
  }

  function collection(rows: Array<Record<string, unknown>>) {
    return {
      findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
        rows.filter((row) => match(row, where)),
      ),
      findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((row) => match(row, where)) ?? null,
      ),
      findFirst: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
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
      // orderBy is not honoured: the roll-ups report campaignIds in the order
      // the rows come back, so fixtures are seeded in quarter order.
      findMany: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        campaigns.filter((campaign) => match(campaign, args?.where)),
      ),
    },
    campaignQuota: collection(campaignQuotas as unknown as Array<Record<string, unknown>>),
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
    campaignQuotas,
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

function centreOf(result: { regions: unknown }): Record<string, any> {
  return asRegions(result.regions).find((region) => region.name === 'Centre')!;
}

const national = { role: 'ADMIN_ONEFOP', region: 'Littoral' };
const regional = { role: 'REGIONAL_ADMIN', region: 'Centre' };
const divisional = { role: 'DIVISIONAL_ADMIN', region: 'Centre', department: 'Mfoundi' };

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db', { code, clientVersion: '5.22.0' });
}

describe('PilotageService writes', () => {
  // prepare() is shared by every target write. It was covered through the
  // year-scoped inscription endpoint until Phase 6a retired it; the assertions
  // are unchanged, re-pointed at the surviving campaign-quota writer.
  it('rejects a bad body, a department outside its region, an unknown region, and an oversized body before opening a transaction', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: -1 }],
    })).rejects.toThrow('entier positif ou nul');
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [
        { regionId: 'r-centre', departmentId: null, submissionTarget: 1 },
        { regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 1 },
      ],
    })).rejects.toThrow('mélange un objectif régional');
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-littoral', departmentId: 'd-mfoundi', submissionTarget: 1 }],
    })).rejects.toThrow("Le département 'Mfoundi' n'appartient pas à la région 'Littoral'.");
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'missing', departmentId: null, submissionTarget: 1 }],
    })).rejects.toThrow("Région introuvable (ID: 'missing').");
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'missing', clear: true }],
    })).rejects.toThrow("Région introuvable (ID: 'missing').");
    (harness.prisma.region as { count: jest.Mock }).count.mockResolvedValue(1);
    (harness.prisma.department as { count: jest.Mock }).count.mockResolvedValue(1);
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [
        { regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 1 },
        { regionId: 'r-centre', departmentId: 'd-lekie', submissionTarget: 1 },
        { regionId: 'r-littoral', departmentId: 'd-wouri', submissionTarget: 1 },
      ],
    })).rejects.toThrow('au-delà des 2 territoires connus');
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  // transaction()'s retry and conflict mapping, likewise re-pointed off the
  // retired inscription writer onto the campaign-quota one.
  it('retries a serialization conflict once and turns a unique violation into a 409', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    let attempts = 0;
    (harness.prisma.$transaction as jest.Mock).mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
      attempts += 1;
      if (attempts === 1) throw knownError('P2034');
      return work(harness.prisma);
    });
    await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 4 }],
    });
    expect(attempts).toBe(2);
    expect(harness.campaignQuotas).toEqual([expect.objectContaining({ submissionTarget: 4 })]);

    (harness.prisma.$transaction as jest.Mock).mockImplementation(async () => {
      throw knownError('P2002');
    });
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 5 }],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes a quota only for an ONEFOP campaign', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    const result = await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [{ regionId: 'r-littoral', departmentId: 'd-wouri', submissionTarget: 4 }],
      central: { submissionTarget: 9 },
    });
    expect(harness.campaignQuotas[0]).toMatchObject({
      campaignId: 'camp-1', scopeKind: 'TERRITORIAL', submissionTarget: 4, departmentId: 'd-wouri',
    });
    // The central key lands in CampaignQuota as the ADMINISTRATION row.
    expect(harness.campaignQuotas[1]).toMatchObject({
      campaignId: 'camp-1', scopeKind: 'ADMINISTRATION', regionId: null, departmentId: null, submissionTarget: 9,
    });
    expect(harness.audits.map((row) => row.action).sort()).toEqual(['CAMPAIGN_QUOTA_UPSERT', 'CAMPAIGN_QUOTA_UPSERT']);
    expect(result.campaign).toMatchObject({ id: 'camp-1', collectionType: 'ONEFOP', status: 'DRAFT' });
    // The response keeps its shape: central is still { submissionTarget } | null.
    expect(result.central).toEqual({ submissionTarget: 9 });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ mode: 'DEPARTMENT', submissionTarget: 4 });

    harness.campaigns.push({ id: 'dsmo', name: 'DSMO', code: 'D', collectionType: 'DSMO', status: 'ACTIVE' });
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'dsmo', { entries: [] }))
      .rejects.toThrow('Les objectifs de campagne concernent uniquement les campagnes ONEFOP.');
    await expect(harness.service.getCampaignQuotas(national, 'dsmo'))
      .rejects.toThrow('Les objectifs de campagne concernent uniquement les campagnes ONEFOP.');
    await expect(harness.service.getCampaignQuotas(national, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.campaignQuotas).toHaveLength(2);
  });

  it('writes the central key as one ADMINISTRATION row', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });

    await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [],
      central: { submissionTarget: 12 },
    });

    const administration = harness.campaignQuotas.filter((row) => row.scopeKind === 'ADMINISTRATION');
    expect(administration).toHaveLength(1);
    expect(administration[0]).toMatchObject({
      campaignId: 'camp-1', regionId: null, departmentId: null, submissionTarget: 12,
      createdBy: 'actor-1', updatedBy: 'actor-1',
    });

    // The retired audit actions must not reappear under a new writer.
    const actions = harness.audits.map((row) => row.action);
    expect(actions).toEqual(['CAMPAIGN_QUOTA_UPSERT']);
    expect(actions.some((action) => String(action).startsWith('CENTRAL_CAMPAIGN_QUOTA'))).toBe(false);
    expect(harness.audits[0]).toMatchObject({
      resourceType: 'CampaignQuota',
      previousValue: null,
      newValue: '12',
    });
  });

  it('deletes the ADMINISTRATION row when central is null, and leaves territorial rows alone', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    harness.campaignQuotas.push(
      { id: 'q-terr', campaignId: 'camp-1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: null, submissionTarget: 30 },
      { id: 'q-adm', campaignId: 'camp-1', scopeKind: 'ADMINISTRATION', regionId: null, departmentId: null, submissionTarget: 7 },
    );

    const result = await harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [],
      central: null,
    });

    expect(harness.campaignQuotas.map((row) => row.id)).toEqual(['q-terr']);
    expect(result.central).toBeNull();
    const centre = asRegions(result.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'REGION', submissionTarget: 30 });
    expect(harness.audits).toEqual([
      expect.objectContaining({
        action: 'CAMPAIGN_QUOTA_DELETE',
        resourceType: 'CampaignQuota',
        resourceId: 'q-adm',
        previousValue: '7',
        newValue: null,
      }),
    ]);
  });

  it('reads the ADMINISTRATION row as central at national scope only', async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    harness.campaignQuotas.push({
      id: 'q-adm', campaignId: 'camp-1', scopeKind: 'ADMINISTRATION',
      regionId: null, departmentId: null, submissionTarget: 44,
    });

    await expect(harness.service.getCampaignQuotas(national, 'camp-1'))
      .resolves.toMatchObject({ central: { submissionTarget: 44 } });
    await expect(harness.service.getCampaignQuotas(regional, 'camp-1'))
      .resolves.toMatchObject({ central: null });
    await expect(harness.service.getCampaignQuotas(divisional, 'camp-1'))
      .resolves.toMatchObject({ central: null });
  });

  it('keeps the ADMINISTRATION row out of the territorial grid at national scope', async () => {
    // regionFilter() returns {} for national scope, so national is the only
    // scope where the cohort row is a candidate for the grid at all. Two
    // things exclude it — the scopeKind filter on the query and the hasRegion
    // predicate on the rows — and either alone suffices, so this test pins the
    // outcome rather than one mechanism. It fails only if both go.
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    harness.campaignQuotas.push(
      { id: 'q-terr', campaignId: 'camp-1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q-adm', campaignId: 'camp-1', scopeKind: 'ADMINISTRATION', regionId: null, departmentId: null, submissionTarget: 99 },
    );

    const quotas = await harness.service.getCampaignQuotas(national, 'camp-1');
    expect(asRegions(quotas.regions).map((region) => region.name)).toEqual(['Centre', 'Littoral']);
    const centre = asRegions(quotas.regions).find((region) => region.name === 'Centre');
    expect(centre).toMatchObject({ mode: 'DEPARTMENT', submissionTarget: 10 });
    expect(quotas.central).toEqual({ submissionTarget: 99 });
  });

  it("clears a region's campaign quotas and is a safe no-op when already UNSET", async () => {
    const harness = createHarness();
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    harness.campaignQuotas.push(
      { id: 'q-centre', campaignId: 'camp-1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: null, submissionTarget: 50, createdBy: 'old', updatedBy: 'old' },
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
    harness.campaigns.push({ id: 'camp-1', name: 'Collecte', code: 'C1', collectionType: 'ONEFOP', status: 'DRAFT' });
    await expect(harness.service.putCampaignQuotas('actor-1', national, 'camp-1', {
      entries: [
        { regionId: 'r-centre', clear: true },
        { regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 5 },
      ],
    })).rejects.toThrow('La région « Centre » ne peut pas combiner « clear » avec d\'autres lignes.');
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
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

  /**
   * An ONEFOP registration campaign for one quarter of 2026. Coverage folds
   * only purpose = REGISTRATION campaigns, so this is the fixture whose quotas
   * reach the roll-up; status is DRAFT, as every registration campaign is.
   */
  function campaign(quarter: number | null, overrides: Record<string, unknown> = {}) {
    return {
      id: quarter === null ? 'c-tnull' : `c-t${quarter}`,
      name: `Inscription 2026 T${quarter ?? 'x'}`,
      code: `ON-2026-T${quarter ?? 'X'}`,
      collectionType: SubmissionModule.ONEFOP,
      purpose: 'REGISTRATION',
      status: 'DRAFT',
      startDate: null,
      endDate: null,
      referenceYear: 2026,
      referenceQuarter: quarter,
      ...overrides,
    };
  }

  /** Seeds the year's quarters in order and returns their ids. */
  function seedQuarters(harness: ReturnType<typeof createHarness>, quarters = [1, 2, 3, 4]) {
    for (const quarter of quarters) harness.campaigns.push(campaign(quarter));
    return quarters.map((quarter) => `c-t${quarter}`);
  }

  /** A territorial quota row. scopeKind is explicit because match() is strict. */
  function quota(
    campaignId: string,
    regionId: string,
    departmentId: string | null,
    submissionTarget: number,
  ): TargetRow {
    return {
      id: `q-${campaignId}-${regionId}-${departmentId ?? 'region'}`,
      campaignId,
      scopeKind: 'TERRITORIAL',
      regionId,
      departmentId,
      submissionTarget,
    };
  }

  /** The ministry cohort row: one per campaign, no region, no department. */
  function cohort(campaignId: string, submissionTarget: number): TargetRow {
    return {
      id: `q-${campaignId}-adm`,
      campaignId,
      scopeKind: 'ADMINISTRATION',
      regionId: null,
      departmentId: null,
      submissionTarget,
    };
  }

  /**
   * getSemesterCoverage became public with its Phase 4a route, and is reached
   * this way only by the tests written before that route existed.
   */
  interface CoverageViews {
    getSemesterCoverage(territory: unknown, year: number, semester: number): Promise<any>;
  }
  function views(service: PilotageService): CoverageViews {
    return service as unknown as CoverageViews;
  }

  function campaignQueries(harness: ReturnType<typeof createHarness>) {
    return (harness.prisma.dataCampaign as { findMany: jest.Mock }).findMany.mock.calls.map(
      ([args]: [{ where: Record<string, unknown> }]) => args.where,
    );
  }

  function mfoundiOf(region: Record<string, any>): Record<string, any> {
    return region.departments.find((department: { name: string }) => department.name === 'Mfoundi');
  }

  it('computes stock, in-year, pending, and rate for a national reader', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness);
    // Mfoundi 6 + 4 = 10 across two quarters; T3 and T4 carry no quota at all.
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', 'd-mfoundi', 6),
      quota(t2, 'r-centre', 'd-mfoundi', 4),
      quota(t1, 'r-centre', 'd-lekie', 0),
      cohort(t1, 1),
      cohort(t2, 3),
    );
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
    // Every matched campaign is reported, the quota-less quarters included.
    expect(result.period).toEqual({
      year: 2026,
      quarter: null,
      semester: null,
      campaignIds: ['c-t1', 'c-t2', 'c-t3', 'c-t4'],
    });
    expect(result.year).toBe(2026);
    expect(result.central).toMatchObject({
      registered: 1,
      registeredInYear: 1,
      inscriptionTarget: 4,
      rate: 0.25,
    });
    expect(result.unassigned).toMatchObject({ registered: 1, pendingApproval: 0 });
    expect(result.nullEntityType).toMatchObject({ registered: 1 });
    const centre = centreOf(result);
    expect(centre).toMatchObject({
      mode: 'DEPARTMENT',
      companyCount: 8,
      registered: 3,
      registeredInYear: 2,
      pendingApproval: 1,
      pendingReview: 1,
      complementsRequested: 1,
      inscriptionTarget: 10,
      rate: 0.3,
    });
    expect(mfoundiOf(centre)).toMatchObject({
      companyCount: 7,
      registered: 2,
      registeredInYear: 1,
      pendingApproval: 1,
      pendingReview: 1,
      complementsRequested: 1,
      inscriptionTarget: 10,
      rate: 0.2,
    });
    const lekie = centre.departments.find((department: { name: string }) => department.name === 'Lékié');
    expect(lekie).toMatchObject({ companyCount: 1, registered: 1, inscriptionTarget: 0, rate: null });
  });

  it('sums the four quarters for the annual view and the right two for a semester', async () => {
    const harness = createHarness();
    const ids = seedQuarters(harness);
    harness.campaignQuotas.push(
      ...ids.map((id, index) => quota(id, 'r-centre', 'd-mfoundi', 2 ** index)),
    );
    const annual = await harness.service.getCoverage(national, '2026');
    // 1 + 2 + 4 + 8
    expect(mfoundiOf(centreOf(annual))).toMatchObject({ inscriptionTarget: 15 });
    expect(centreOf(annual)).toMatchObject({ mode: 'DEPARTMENT', inscriptionTarget: 15 });

    const first = await views(harness.service).getSemesterCoverage(national, 2026, 1);
    // Q1 + Q2 only.
    expect(mfoundiOf(centreOf(first))).toMatchObject({ inscriptionTarget: 3 });
    expect(first.period).toEqual({ year: 2026, quarter: null, semester: 1, campaignIds: ['c-t1', 'c-t2'] });

    const second = await views(harness.service).getSemesterCoverage(national, 2026, 2);
    // Q3 + Q4 only.
    expect(mfoundiOf(centreOf(second))).toMatchObject({ inscriptionTarget: 12 });
    expect(second.period).toEqual({ year: 2026, quarter: null, semester: 2, campaignIds: ['c-t3', 'c-t4'] });
  });

  it('lets a quarter with no quota contribute nothing instead of zero-padding the year', async () => {
    const harness = createHarness();
    const ids = seedQuarters(harness);
    // One quota, on Q2 alone. The annual target is 7: the three silent
    // quarters are absent, not targets of zero.
    harness.campaignQuotas.push(quota(ids[1], 'r-centre', 'd-mfoundi', 7));
    const result = await harness.service.getCoverage(national, '2026');
    const centre = centreOf(result);
    expect(centre).toMatchObject({ mode: 'DEPARTMENT', inscriptionTarget: 7 });
    expect(mfoundiOf(centre)).toMatchObject({ inscriptionTarget: 7 });
    // Nothing was ever stored for Lékié, which is not a target of zero.
    expect(centre.departments.find((d: { name: string }) => d.name === 'Lékié'))
      .toMatchObject({ inscriptionTarget: null, rate: null });
    // No cohort row anywhere in the year.
    expect(result.central).toMatchObject({ inscriptionTarget: null, rate: null });
  });

  it('keeps a folded quota of zero as a real target with no rate', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness, [1, 2]);
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', 'd-mfoundi', 0),
      quota(t2, 'r-centre', 'd-mfoundi', 0),
    );
    harness.companies.push(company());
    const result = await harness.service.getCoverage(national, '2026');
    expect(mfoundiOf(centreOf(result)))
      .toMatchObject({ registered: 1, inscriptionTarget: 0, rate: null });
  });

  it('sums the ADMINISTRATION quotas of the folded quarters into the central bucket', async () => {
    const harness = createHarness();
    const ids = seedQuarters(harness);
    harness.campaignQuotas.push(
      cohort(ids[0], 5),
      cohort(ids[1], 7),
      cohort(ids[2], 0),
      quota(ids[0], 'r-centre', 'd-mfoundi', 2),
    );
    harness.companies.push(
      company({ entityType: 'ADMINISTRATION', establishmentId: 'AD26000100' }),
      company({ entityType: 'ADMINISTRATION', establishmentId: 'AD26000200' }),
      company({ entityType: 'ADMINISTRATION', establishmentId: 'AD26000300' }),
    );
    const result = await harness.service.getCoverage(national, '2026');
    // 5 + 7 + 0; T4 has no cohort row and adds nothing.
    expect(result.central).toMatchObject({ registered: 3, inscriptionTarget: 12, rate: 0.25 });
  });

  it('keeps the ADMINISTRATION quota out of regions[] at national scope', async () => {
    const harness = createHarness();
    const [t1] = seedQuarters(harness, [1]);
    harness.campaignQuotas.push(
      cohort(t1, 4242),
      quota(t1, 'r-centre', 'd-mfoundi', 5),
    );
    const result = await harness.service.getCoverage(national, '2026');
    expect(JSON.stringify(result.regions)).not.toContain('4242');
    expect(centreOf(result)).toMatchObject({ mode: 'DEPARTMENT', inscriptionTarget: 5 });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ mode: 'UNSET', inscriptionTarget: null, rate: null });
    // It is read for the central bucket by design, from its own query.
    expect(result.central).toMatchObject({ inscriptionTarget: 4242 });
    expect((harness.prisma.campaignQuota as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ scopeKind: 'TERRITORIAL' }) }),
    );
  });

  it('folds a region-level quarter and a department-level quarter into MIXED', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness, [1, 2]);
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', null, 50),
      quota(t2, 'r-centre', 'd-mfoundi', 20),
    );
    harness.companies.push(company());
    const result = await harness.service.getCoverage(national, '2026');
    // Two incomparable rows survive the fold, so the region is reported as
    // MIXED with no target rather than added up.
    expect(centreOf(result)).toMatchObject({ mode: 'MIXED', inscriptionTarget: null, rate: null, registered: 1 });
    expect(mfoundiOf(centreOf(result))).toMatchObject({ inscriptionTarget: 20 });
  });

  it('never asks for a campaign whose reference quarter is null', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign(1), campaign(null), campaign(3));
    harness.campaignQuotas.push(
      quota('c-t1', 'r-centre', 'd-mfoundi', 1),
      quota('c-tnull', 'r-centre', 'd-mfoundi', 1000),
    );
    const result = await harness.service.getCoverage(national, '2026');
    expect(result.period.campaignIds).toEqual(['c-t1', 'c-t3']);
    // The malformed campaign's quota cannot reach the annual sum.
    expect(centreOf(result)).toMatchObject({ inscriptionTarget: 1 });
    const queries = campaignQueries(harness);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toEqual({
      collectionType: SubmissionModule.ONEFOP,
      purpose: 'REGISTRATION',
      referenceYear: 2026,
      referenceQuarter: { in: [1, 2, 3, 4] },
    });
    await views(harness.service).getSemesterCoverage(national, 2026, 1);
    expect(campaignQueries(harness)[1].referenceQuarter).toEqual({ in: [1, 2] });
    expect(campaignQueries(harness)[1].purpose).toBe('REGISTRATION');
  });

  // 8c: Couverture reads registration targets only; declaration quotas belong
  // to getCampaignReturns.
  describe('purpose partition', () => {
    const collectionCampaign = (quarter: number) =>
      campaign(quarter, { id: `col-t${quarter}`, code: `COL-2026-T${quarter}`, purpose: 'COLLECTION', status: 'ACTIVE' });

    it('returns no target for a year with only a collection campaign — same shape as a year with no quota rows', async () => {
      const harness = createHarness();
      harness.campaigns.push(collectionCampaign(3));
      harness.campaignQuotas.push(quota('col-t3', 'r-centre', 'd-mfoundi', 40));

      const withCollectionOnly = await harness.service.getCoverage(national, '2026');
      const empty = await createHarness().service.getCoverage(national, '2026');

      expect(withCollectionOnly.period.campaignIds).toEqual([]);
      expect(mfoundiOf(centreOf(withCollectionOnly))).toMatchObject({ inscriptionTarget: null, rate: null });
      expect(centreOf(withCollectionOnly)).toMatchObject({ mode: 'UNSET', inscriptionTarget: null });
      expect(withCollectionOnly.regions).toEqual(empty.regions);
    });

    it('uses a registration campaign\'s quotas as the annual target', async () => {
      const harness = createHarness();
      harness.campaigns.push(campaign(3));
      harness.campaignQuotas.push(quota('c-t3', 'r-centre', 'd-mfoundi', 25));

      const result = await harness.service.getCoverage(national, '2026');

      expect(result.period.campaignIds).toEqual(['c-t3']);
      expect(mfoundiOf(centreOf(result))).toMatchObject({ inscriptionTarget: 25 });
    });

    it('counts only the registration quotas when both kinds share a quarter', async () => {
      const harness = createHarness();
      harness.campaigns.push(campaign(3), collectionCampaign(3));
      harness.campaignQuotas.push(
        quota('c-t3', 'r-centre', 'd-mfoundi', 25),
        quota('col-t3', 'r-centre', 'd-mfoundi', 40),
      );

      const annual = await harness.service.getCoverage(national, '2026');
      const semester = await views(harness.service).getSemesterCoverage(national, 2026, 2);

      expect(annual.period.campaignIds).toEqual(['c-t3']);
      expect(mfoundiOf(centreOf(annual))).toMatchObject({ inscriptionTarget: 25 });
      // Annual and semester fold through the same filtered query, so they agree.
      expect(mfoundiOf(centreOf(semester))).toMatchObject({ inscriptionTarget: 25 });
    });
  });

  it('separates a department with no companies from one whose companies are all unregistered', async () => {
    const harness = createHarness();
    harness.companies.push(
      company({ user: { status: 'DRAFT', isActive: true }, establishmentId: null }),
      company({ user: { status: 'REJECTED', isActive: true }, establishmentId: null }),
    );
    const result = await harness.service.getCoverage(national, '2026');
    const centre = centreOf(result);
    // Mfoundi holds companies that have registered nothing: a measured zero.
    expect(mfoundiOf(centre)).toMatchObject({ companyCount: 2, registered: 0 });
    // Lékié holds no companies at all: there is nothing to measure.
    expect(centre.departments.find((department: { name: string }) => department.name === 'Lékié'))
      .toMatchObject({ companyCount: 0, registered: 0 });
    expect(centre).toMatchObject({ companyCount: 2, registered: 0 });
    const littoral = asRegions(result.regions).find((region) => region.name === 'Littoral');
    expect(littoral).toMatchObject({ companyCount: 0, registered: 0 });
  });

  it('reports real stock with null targets and null rates when no campaign exists', async () => {
    const harness = createHarness();
    harness.companies.push(company(), company({ establishmentId: 'EN26000200' }));
    const result = await harness.service.getCoverage(national, '2026');
    expect(result.period).toEqual({ year: 2026, quarter: null, semester: null, campaignIds: [] });
    expect(result.central).toMatchObject({ registered: 0, inscriptionTarget: null, rate: null });
    expect(centreOf(result)).toMatchObject({
      mode: 'UNSET',
      companyCount: 2,
      registered: 2,
      inscriptionTarget: null,
      rate: null,
    });
    expect(mfoundiOf(centreOf(result)))
      .toMatchObject({ registered: 2, inscriptionTarget: null, rate: null });
    // No campaign matched, so no quota query was worth issuing.
    expect((harness.prisma.campaignQuota as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it('hides central, unassigned, and other regions from a regional reader', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness, [1, 2]);
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', 'd-mfoundi', 4),
      quota(t2, 'r-centre', 'd-mfoundi', 6),
      quota(t1, 'r-littoral', 'd-wouri', 99),
      cohort(t1, 40),
    );
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
    expect(result.regions[0]).toMatchObject({ name: 'Centre', registered: 1, inscriptionTarget: 10, rate: 0.1 });
    // The cohort target is a national figure and is not even queried.
    expect((harness.prisma.campaignQuota as { findMany: jest.Mock }).findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ scopeKind: 'ADMINISTRATION' }) }),
    );
    expect((harness.prisma.campaignQuota as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ regionId: 'r-centre', scopeKind: 'TERRITORIAL' }) }),
    );
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { regionId: 'r-centre' } }),
    );
  });

  it('shows a divisional reader only their department stock and hides the region stock and rate', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness, [1, 2]);
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', 'd-mfoundi', 4),
      quota(t2, 'r-centre', 'd-mfoundi', 6),
      quota(t1, 'r-centre', 'd-lekie', 15),
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
    // The sibling department's quota is not in the payload either.
    expect(JSON.stringify(result.regions)).not.toContain('15');
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: 'd-mfoundi' } }),
    );
  });

  it('keeps the region target visible to a divisional reader in REGION mode and still hides region stock', async () => {
    const harness = createHarness();
    const [t1, t2] = seedQuarters(harness, [1, 2]);
    // Region-level rows fold exactly as department-level ones do.
    harness.campaignQuotas.push(
      quota(t1, 'r-centre', null, 50),
      quota(t2, 'r-centre', null, 30),
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
    seedQuarters(harness);
    harness.campaignQuotas.push(quota('c-t1', 'r-centre', 'd-mfoundi', 10));
    await expect(harness.service.getCoverage(undefined, '2026')).resolves.toEqual({
      year: 2026,
      period: { year: 2026, quarter: null, semester: null, campaignIds: [] },
      central: null,
      unassigned: null,
      nullEntityType: null,
      regions: [],
    });
    expect((harness.prisma.company as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
    // The campaign query is deferred into loadGrid's row loader, which a
    // fail-closed scope never reaches.
    expect((harness.prisma.dataCampaign as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
    expect((harness.prisma.campaignQuota as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it('rejects a semester outside 1 and 2', async () => {
    const harness = createHarness();
    await expect(views(harness.service).getSemesterCoverage(national, 2026, 3)).rejects.toThrow(
      BadRequestException,
    );
  });

  /**
   * The two Phase 4a roll-up routes, driven through the controller itself.
   *
   * The guards are asserted in pilotage.controller.spec.ts; what these cover
   * is the part the handler owns — parsing the query parameters and picking
   * the right service view. Wrapping each call in an async thunk keeps a
   * synchronous 400 from the handler and a rejected promise from the service
   * indistinguishable to the assertion.
   */
  function call<T>(work: () => T | Promise<T>): Promise<T> {
    return (async () => work())();
  }

  it('serves the semester roll-up from its route: Q1+Q2 for 1, Q3+Q4 for 2', async () => {
    const harness = createHarness();
    const ids = seedQuarters(harness);
    harness.campaignQuotas.push(
      ...ids.map((id, index) => quota(id, 'r-centre', 'd-mfoundi', 2 ** index)),
    );
    const controller = new PilotageController(harness.service);

    // 1 + 2
    const first = await controller.getSemesterCoverage('2026', '1', { user: national });
    expect(mfoundiOf(centreOf(first))).toMatchObject({ inscriptionTarget: 3 });
    expect(first.period).toEqual({ year: 2026, quarter: null, semester: 1, campaignIds: ['c-t1', 'c-t2'] });

    // 4 + 8
    const second = await controller.getSemesterCoverage('2026', '2', { user: national });
    expect(mfoundiOf(centreOf(second))).toMatchObject({ inscriptionTarget: 12 });
    expect(second.period).toEqual({ year: 2026, quarter: null, semester: 2, campaignIds: ['c-t3', 'c-t4'] });

    // A semester outside {1, 2}, or none at all, is a 400 at the boundary.
    for (const bad of ['0', '3', '1.5', 'un', '']) {
      await expect(call(() => controller.getSemesterCoverage('2026', bad, { user: national })))
        .rejects.toThrow(BadRequestException);
    }
    await expect(call(() => controller.getSemesterCoverage('nope', '1', { user: national })))
      .rejects.toThrow(BadRequestException);
  });

  it('annual coverage route delegates to the same fold as the service method', async () => {
    const harness = createHarness();
    const ids = seedQuarters(harness);
    harness.campaignQuotas.push(
      ...ids.map((id, index) => quota(id, 'r-centre', 'd-mfoundi', 2 ** index)),
      cohort(ids[0], 5),
    );
    harness.companies.push(
      company(),
      company({ entityType: 'ADMINISTRATION', establishmentId: 'AD26000100' }),
    );
    const controller = new PilotageController(harness.service);

    // The retired year-scoped route is no longer the reference (Phase 4c): the
    // route is compared against the service fold it delegates to, which is
    // what the old comparison was really asserting through that route.
    const annualRoute = await controller.getAnnualCoverage('2026', { user: national });
    expect(annualRoute).toEqual(await harness.service.getCoverage(national, '2026'));
    expect(annualRoute.period).toEqual({
      year: 2026,
      quarter: null,
      semester: null,
      campaignIds: ['c-t1', 'c-t2', 'c-t3', 'c-t4'],
    });
    // 1 + 2 + 4 + 8, and the cohort target read from the ADMINISTRATION row.
    expect(mfoundiOf(centreOf(annualRoute))).toMatchObject({ inscriptionTarget: 15 });
    expect(annualRoute.central).toMatchObject({ registered: 1, inscriptionTarget: 5 });
  });
});

describe('PilotageService.getCampaignReturns', () => {
  /** An ONEFOP collection campaign: returns are computed only for these. */
  function campaign(id = 'c1', overrides?: Record<string, unknown>) {
    return {
      id,
      name: 'Campagne Pilote ONEFOP 2026',
      code: 'ONEFOP-2026-T1',
      collectionType: SubmissionModule.ONEFOP,
      purpose: 'COLLECTION',
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

  // 8c: returns are computed only for collection campaigns.
  it('rejects a registration campaign with 400, the same pattern as a non-ONEFOP one', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('reg-1', { purpose: 'REGISTRATION', status: 'DRAFT' }));
    await expect(harness.service.getCampaignReturns(national, 'reg-1')).rejects.toThrow(
      new BadRequestException(
        "Le suivi des retours concerne uniquement les campagnes de collecte : une campagne d'inscription porte des cibles, pas une collecte.",
      ),
    );
  });

  it('keeps a registration campaign\'s quotas out of a collection campaign\'s returns', async () => {
    const harness = createHarness();
    harness.campaigns.push(
      campaign('c1'),
      campaign('reg-1', { purpose: 'REGISTRATION', status: 'DRAFT' }),
    );
    harness.campaignQuotas.push(
      { id: 'q1', campaignId: 'c1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q2', campaignId: 'reg-1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 99 },
    );

    const result = await harness.service.getCampaignReturns(national, 'c1');

    expect(result.totals.quota).toBe(10);
  });

  it('aggregates returns: status filter, deduplication of resubmissions, lateness, and territory attribution', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    // Quotas: Mfoundi = 10, Lékié = 5 -> Centre quota = 15
    harness.campaignQuotas.push(
      { id: 'q1', campaignId: 'c1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q2', campaignId: 'c1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-lekie', submissionTarget: 5 },
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

  it('keeps the ADMINISTRATION row out of the territorial grid', async () => {
    // As in the quotas-grid test: national scope is the only scope where the
    // cohort row could reach `regions`, and the scopeKind filter and the
    // hasRegion predicate each exclude it on their own. What matters here is
    // the consequence if both were ever dropped — a nameless region row that
    // also lands in the quota-backed subtotals behind gap, quotaRate and
    // onTimeRate.
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    harness.campaignQuotas.push({
      id: 'q-adm', campaignId: 'c1', scopeKind: 'ADMINISTRATION',
      regionId: null, departmentId: null, submissionTarget: 99,
    });

    const res = await harness.service.getCampaignReturns(national, 'c1');
    expect(res.regions.map((region) => region.name)).toEqual(['Centre', 'Littoral']);
    expect(res.regions.every((region) => region.quota === null)).toBe(true);
    expect(res.central).toMatchObject({ quota: 99, received: 0 });
    expect(res.totals.quota).toBe(99);
  });

  it('routes formType === ADMINISTRATION to central bucket and excludes from territorial quotas', async () => {
    const harness = createHarness();
    harness.campaigns.push(campaign('c1'));
    harness.campaignQuotas.push({
      id: 'cq1',
      campaignId: 'c1',
      scopeKind: 'ADMINISTRATION',
      regionId: null,
      departmentId: null,
      submissionTarget: 50,
    });
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
      { id: 'q1', campaignId: 'c1', scopeKind: 'TERRITORIAL', regionId: 'r-centre', departmentId: 'd-mfoundi', submissionTarget: 10 },
      { id: 'q3', campaignId: 'c1', scopeKind: 'TERRITORIAL', regionId: 'r-littoral', departmentId: 'd-wouri', submissionTarget: 20 },
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
      scopeKind: 'TERRITORIAL',
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
      scopeKind: 'TERRITORIAL',
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
