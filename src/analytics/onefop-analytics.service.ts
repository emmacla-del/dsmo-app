// src/analytics/onefop-analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsScope,
  buildPeriodWhere,
} from './helpers/analytics-period.helper';

// ─────────────────────────────────────────────────────────────
// FILTER INTERFACES
// ─────────────────────────────────────────────────────────────
export interface AnalyticsFilter extends AnalyticsScope {
  entityType?: string;   // 'ENTREPRISE' | 'COOPERATIVE' | 'CTD' | 'ONG'
  submissionId?: string; // internal UUID (onefop_submissions.id)
  _ids?: string[];
}

export interface SubmissionListFilter extends AnalyticsFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface RecruitmentTrendFilter extends AnalyticsFilter {
  startYear: number;
  endYear: number;
  granularity: 'year' | 'quarter' | 'semester' | 'month';
}

// Add this interface near the top with the other interfaces
interface SubmissionMeta {
  id: string;
  surveyYear: number;
  quarterCode: string | null;
  region: string | null;
  department: string | null;
  subdivision: string | null;  // ← NEW
  formType: string;
  createdAt: Date;
}

@Injectable()
export class OnefopAnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  // ─────────────────────────────────────────────────────────────
  // SHARED: build the base where clause for onefopSubmission
  // ─────────────────────────────────────────────────────────────
  private buildSubmissionWhere(filter: AnalyticsFilter, status = 'APPROVED'): Record<string, any> {
    const where: Record<string, any> = {
      status,
      // Merge period/location conditions from the helper
      ...buildPeriodWhere(filter),
    };

    if (filter.submissionId) where['id'] = filter.submissionId;
    if (filter.entityType) where['formType'] = filter.entityType.toUpperCase();
    if (filter.region) where['region'] = { contains: filter.region, mode: 'insensitive' };
    if (filter.department) where['department'] = { contains: filter.department, mode: 'insensitive' };
    if (filter.subdivision) where['subdivision'] = { contains: filter.subdivision, mode: 'insensitive' };

    return where;
  }

  // ─────────────────────────────────────────────────────────────
  // SHARED: resolve approved submission IDs matching filters
  // ─────────────────────────────────────────────────────────────
  private async resolveSubmissionIds(filter: AnalyticsFilter): Promise<string[]> {
    if (filter._ids) return filter._ids;  // ← this line is missing
    const submissions = await this.resolveSubmissions(filter);
    return submissions.map((s) => s.id);
  }

  private async resolveSubmissions(filter: AnalyticsFilter): Promise<SubmissionMeta[]> {
    return (this.prisma as any).onefopSubmission.findMany({
      where: this.buildSubmissionWhere(filter),
      select: {
        id: true,
        surveyYear: true,
        quarterCode: true,
        region: true,
        department: true,
        subdivision: true,  // ← NEW
        formType: true,
        createdAt: true,
      },
    });
  }
  // ─────────────────────────────────────────────────────────────
  // Helper: derive the period key for trend grouping
  // Respects granularity: year | quarter | semester | month
  // ─────────────────────────────────────────────────────────────
  private periodKey(
    s: SubmissionMeta,
    granularity: RecruitmentTrendFilter['granularity'] = 'year',
  ): string {
    switch (granularity) {
      case 'quarter':
        if (s.quarterCode) return s.quarterCode;
        return `${s.surveyYear}-T${Math.ceil((s.createdAt.getMonth() + 1) / 3)}`;

      case 'semester':
        return `${s.surveyYear}-S${s.createdAt.getMonth() < 6 ? 1 : 2}`;

      case 'month':
        return `${s.surveyYear}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;

      case 'year':
      default:
        return String(s.surveyYear);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 1. EMPLOYMENT SUMMARY
  // ─────────────────────────────────────────────────────────────
  async getEmploymentSummary(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return { totalEmployees: 0, byGender: [], byCsp: [] };

    const [totals, byGender, byCsp] = await Promise.all([
      (this.prisma as any).onefopCspGenderAge.aggregate({
        where: { submissionId: { in: ids }, tableName: 's21q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
        _sum: { value: true },
      }),
      (this.prisma as any).onefopCspGenderAge.groupBy({
        by: ['gender'],
        where: { submissionId: { in: ids }, tableName: 's21q01', cspCategory: 'TOTAL', ageBand: 'TOTAL', gender: { in: ['MALE', 'FEMALE'] } },
        _sum: { value: true },
      }),
      (this.prisma as any).onefopCspGenderAge.groupBy({
        by: ['cspCategory'],
        where: { submissionId: { in: ids }, tableName: 's21q01', gender: 'TOTAL', ageBand: 'TOTAL', cspCategory: { in: ['CADRES', 'FOREMEN', 'WORKERS'] } },
        _sum: { value: true },
      }),
    ]);

    return {
      totalEmployees: totals._sum.value ?? 0,
      byGender: byGender.map((r: any) => ({ gender: r.gender, count: r._sum.value ?? 0 })),
      byCsp: byCsp.map((r: any) => ({ cspCategory: r.cspCategory, count: r._sum.value ?? 0 })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. EMPLOYMENT — full CSP × Gender × AgeBand breakdown
  // ─────────────────────────────────────────────────────────────
  async getEmploymentByCsp(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopCspGenderAge.groupBy({
      by: ['tableName', 'cspCategory', 'gender', 'ageBand'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ tableName: 'asc' }, { cspCategory: 'asc' }, { gender: 'asc' }, { ageBand: 'asc' }],
    });

    return rows.map((r: any) => ({
      tableName: r.tableName,
      cspCategory: r.cspCategory,
      gender: r.gender,
      ageBand: r.ageBand,
      total: r._sum.value ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 3. EMPLOYMENT BY LOCATION
  // ─────────────────────────────────────────────────────────────
  async getEmploymentByLocation(filter: AnalyticsFilter & { groupBy: 'region' | 'department' | 'subdivision' }) {
    const submissions = await this.resolveSubmissions(filter);
    if (!submissions.length) return [];

    const ids = submissions.map((s) => s.id);

    const totals = await (this.prisma as any).onefopCspGenderAge.findMany({
      where: { submissionId: { in: ids }, tableName: 's21q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
      select: { submissionId: true, value: true },
    });

    const valueBySubmission = new Map<string, number>();
    for (const t of totals) valueBySubmission.set(t.submissionId, t.value ?? 0);

    const map = new Map<string, { totalEmployees: number; companyCount: number }>();
    for (const s of submissions) {
      const key = filter.groupBy === 'region'
        ? (s.region ?? 'Inconnu')
        : filter.groupBy === 'department'
          ? (s.department ?? 'Inconnu')
          : (s.subdivision ?? 'Inconnu');

      if (!map.has(key)) map.set(key, { totalEmployees: 0, companyCount: 0 });
      const stats = map.get(key)!;
      stats.totalEmployees += valueBySubmission.get(s.id) ?? 0;
      stats.companyCount += 1;
    }

    return Array.from(map.entries())
      .map(([name, stats]) => ({
        name,
        totalEmployees: stats.totalEmployees,
        companyCount: stats.companyCount,
        avgEmployeesPerCompany: stats.companyCount > 0
          ? Math.round(stats.totalEmployees / stats.companyCount) : 0,
      }))
      .sort((a, b) => b.totalEmployees - a.totalEmployees);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. GENDER PARITY
  // ─────────────────────────────────────────────────────────────
  async getGenderParity(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return { maleCount: 0, femaleCount: 0, malePercentage: 0, femalePercentage: 0, ratioFemaleToMale: null };

    // S21Q01 (job applicants) — onefopJobApplicationData only holds rows for
    // submissions recorded after 2026-06-05; onefopCspGenderAge (tableName
    // 's21q01') has been populated since 2026-05-14 and covers all of them.
    const rows = await (this.prisma as any).onefopCspGenderAge.groupBy({
      by: ['gender'],
      where: {
        submissionId: { in: ids },
        tableName: 's21q01',
        cspCategory: 'TOTAL',
        ageBand: 'TOTAL',
        gender: { in: ['MALE', 'FEMALE'] },
      },
      _sum: { value: true },
    });

    const male = (rows.find((r: any) => r.gender === 'MALE')?._sum?.value ?? 0) as number;
    const female = (rows.find((r: any) => r.gender === 'FEMALE')?._sum?.value ?? 0) as number;
    const total = male + female;

    return {
      maleCount: male,
      femaleCount: female,
      malePercentage: total > 0 ? +((male / total) * 100).toFixed(1) : 0,
      femalePercentage: total > 0 ? +((female / total) * 100).toFixed(1) : 0,
      ratioFemaleToMale: male > 0 ? +(female / male).toFixed(2) : null,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 5. RECRUITMENT TRENDS
  //    Now supports year | quarter | semester | month granularity
  //    and respects fromQuarter / toQuarter / startDate / endDate
  // ─────────────────────────────────────────────────────────────
  async getRecruitmentTrends(filter: RecruitmentTrendFilter) {
    // Guard: return empty if startYear > endYear
    if (filter.startYear > filter.endYear) return [];

    const submissions = await this.resolveSubmissions({
      ...filter,
      // year range applied here; period helper handles quarter/date range
    });

    const inRange = submissions.filter(
      (s) => s.surveyYear >= filter.startYear && s.surveyYear <= filter.endYear,
    );
    if (!inRange.length) return [];

    const ids = inRange.map((s) => s.id);

    const [permanent, temporary] = await Promise.all([
      (this.prisma as any).onefopCspGenderAge.findMany({
        where: { submissionId: { in: ids }, tableName: 's22q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
        select: { submissionId: true, value: true },
      }),
      (this.prisma as any).onefopCspGenderAge.findMany({
        where: { submissionId: { in: ids }, tableName: 's22q02', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
        select: { submissionId: true, value: true },
      }),
    ]);

    const permMap = new Map<string, number>(permanent.map((r: any) => [r.submissionId, r.value ?? 0]));
    const tempMap = new Map<string, number>(temporary.map((r: any) => [r.submissionId, r.value ?? 0]));

    const trendsMap = new Map<string, { permanent: number; temporary: number }>();

    for (const s of inRange) {
      const key = this.periodKey(s, filter.granularity);
      if (!trendsMap.has(key)) trendsMap.set(key, { permanent: 0, temporary: 0 });
      const stats = trendsMap.get(key)!;
      stats.permanent += permMap.get(s.id) ?? 0;
      stats.temporary += tempMap.get(s.id) ?? 0;
    }

    return Array.from(trendsMap.entries())
      .map(([period, stats]) => ({
        period,
        permanentRecruitments: stats.permanent,
        temporaryRecruitments: stats.temporary,
        totalRecruitments: stats.permanent + stats.temporary,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // ─────────────────────────────────────────────────────────────
  // 6. HIRES BY DEMOGRAPHICS
  // ─────────────────────────────────────────────────────────────
  async getHiresByDemographics(filter: AnalyticsFilter & {
    csp?: 'CADRES' | 'FOREMEN' | 'WORKERS';
    gender?: 'MALE' | 'FEMALE';
    ageBand?: 'AGE_15_24' | 'AGE_25_34' | 'AGE_35_PLUS';
  }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const where: Record<string, any> = {
      submissionId: { in: ids },
      tableName: 's22q01',
      cspCategory: { not: 'TOTAL' },
      gender: { not: 'TOTAL' },
      ageBand: { not: 'TOTAL' },
    };

    if (filter.csp) where['cspCategory'] = filter.csp;
    if (filter.gender) where['gender'] = filter.gender;
    if (filter.ageBand) where['ageBand'] = filter.ageBand;

    const rows = await (this.prisma as any).onefopCspGenderAge.groupBy({
      by: ['cspCategory', 'gender', 'ageBand'],
      where,
      _sum: { value: true },
      orderBy: [{ cspCategory: 'asc' }, { gender: 'asc' }, { ageBand: 'asc' }],
    });

    return rows.map((r: any) => ({
      cspCategory: r.cspCategory,
      gender: r.gender,
      ageBand: r.ageBand,
      count: r._sum.value ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 7. YOUTH EMPLOYMENT
  // ─────────────────────────────────────────────────────────────
  async getYouthEmployment(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return { youthHires: 0, totalHires: 0, youthPercentage: 0 };

    const [youth, total] = await Promise.all([
      (this.prisma as any).onefopCspGenderAge.aggregate({
        where: { submissionId: { in: ids }, tableName: 's22q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'AGE_15_24' },
        _sum: { value: true },
      }),
      (this.prisma as any).onefopCspGenderAge.aggregate({
        where: { submissionId: { in: ids }, tableName: 's22q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
        _sum: { value: true },
      }),
    ]);

    const youthCount = youth._sum.value ?? 0;
    const totalCount = total._sum.value ?? 0;

    return {
      youthHires: youthCount,
      totalHires: totalCount,
      youthPercentage: totalCount > 0 ? +((youthCount / totalCount) * 100).toFixed(1) : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. DIPLOMA DISTRIBUTION
  // ─────────────────────────────────────────────────────────────
  async getDiplomaDistribution(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDiplomaData.groupBy({
      by: ['diploma', 'gender', 'ageBand'],
      where: { submissionId: { in: ids }, diploma: { not: 'TOTAL' } },
      _sum: { value: true },
      orderBy: [{ diploma: 'asc' }, { gender: 'asc' }],
    });

    return rows.map((r: any) => ({
      diploma: r.diploma,
      gender: r.gender,
      ageBand: r.ageBand,
      count: r._sum.value ?? 0,
    }));
  }

  async getDiplomaSummary(filter: AnalyticsFilter & { limit?: number }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDiplomaData.groupBy({
      by: ['diploma'],
      where: { submissionId: { in: ids }, gender: 'TOTAL', ageBand: 'TOTAL', diploma: { not: 'TOTAL' } },
      _sum: { value: true },
      orderBy: { _sum: { value: 'desc' } },
    });

    const result = rows.map((r: any) => ({ diploma: r.diploma, total: r._sum.value ?? 0 }));
    return filter.limit ? result.slice(0, filter.limit) : result;
  }

  // ─────────────────────────────────────────────────────────────
  // 9. DISABILITY DATA
  // ─────────────────────────────────────────────────────────────
  async getDisabilityData(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDisabilityData.groupBy({
      by: ['cspCategory', 'status', 'gender'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ cspCategory: 'asc' }, { status: 'asc' }],
    });

    return rows.map((r: any) => ({
      cspCategory: r.cspCategory,
      status: r.status,
      gender: r.gender,
      count: r._sum.value ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 10. VULNERABLE WORKERS
  // ─────────────────────────────────────────────────────────────
  async getVulnerableWorkers(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopVulnerableData.groupBy({
      by: ['vulnerableType', 'status', 'gender'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ vulnerableType: 'asc' }, { status: 'asc' }],
    });

    return rows.map((r: any) => ({
      vulnerableType: r.vulnerableType,
      status: r.status,
      gender: r.gender,
      count: r._sum.value ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 11. INCLUSION METRICS
  // ─────────────────────────────────────────────────────────────
  async getInclusionMetrics(filter: AnalyticsFilter & { breakdownBy?: 'disability' | 'vulnerability' | 'both' }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return { disabled: 0, vulnerable: 0, totalHires: 0, disabledByCsp: [], vulnerableByType: [] };

    const [disabledTotal, vulnerableTotal, totalHires, disabledByCsp, vulnerableByType] = await Promise.all([
      (this.prisma as any).onefopDisabilityData.aggregate({
        where: { submissionId: { in: ids }, cspCategory: 'TOTAL', status: 'TOTAL', gender: 'TOTAL' },
        _sum: { value: true },
      }),
      (this.prisma as any).onefopVulnerableData.aggregate({
        where: { submissionId: { in: ids }, status: 'TOTAL', gender: 'TOTAL' },
        _sum: { value: true },
      }),
      (this.prisma as any).onefopCspGenderAge.aggregate({
        where: { submissionId: { in: ids }, tableName: 's22q01', cspCategory: 'TOTAL', gender: 'TOTAL', ageBand: 'TOTAL' },
        _sum: { value: true },
      }),
      (!filter.breakdownBy || filter.breakdownBy === 'disability' || filter.breakdownBy === 'both')
        ? (this.prisma as any).onefopDisabilityData.groupBy({
          by: ['cspCategory'],
          where: { submissionId: { in: ids }, status: 'TOTAL', gender: 'TOTAL', cspCategory: { not: 'TOTAL' } },
          _sum: { value: true },
        })
        : Promise.resolve([] as any[]),
      (!filter.breakdownBy || filter.breakdownBy === 'vulnerability' || filter.breakdownBy === 'both')
        ? (this.prisma as any).onefopVulnerableData.groupBy({
          by: ['vulnerableType'],
          where: { submissionId: { in: ids }, status: 'TOTAL', gender: 'TOTAL' },
          _sum: { value: true },
        })
        : Promise.resolve([] as any[]),
    ]);

    return {
      disabled: disabledTotal._sum.value ?? 0,
      vulnerable: vulnerableTotal._sum.value ?? 0,
      totalHires: totalHires._sum.value ?? 0,
      disabledByCsp: disabledByCsp.map((r: any) => ({ cspCategory: r.cspCategory, count: r._sum.value ?? 0 })),
      vulnerableByType: vulnerableByType.map((r: any) => ({ vulnerableType: r.vulnerableType, count: r._sum.value ?? 0 })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 12. FIRST-TIME WORKERS
  // ─────────────────────────────────────────────────────────────
  async getFirstTimeWorkers(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopFirstTimeWorker.groupBy({
      by: ['contractType', 'cspCategory', 'gender', 'ageBand'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ contractType: 'asc' }, { cspCategory: 'asc' }],
    });

    return rows.map((r: any) => ({
      contractType: r.contractType,
      cspCategory: r.cspCategory,
      gender: r.gender,
      ageBand: r.ageBand,
      count: r._sum.value ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 13. DEPARTURES
  // ─────────────────────────────────────────────────────────────
  async getDepartures(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDepartureData.groupBy({
      by: ['cspCategory', 'departureType', 'gender'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ departureType: 'asc' }, { cspCategory: 'asc' }],
    });

    return rows.map((r: any) => ({
      cspCategory: r.cspCategory,
      departureType: r.departureType,
      gender: r.gender,
      count: r._sum.value ?? 0,
    }));
  }

  async getDepartureSummary(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDepartureData.groupBy({
      by: ['departureType'],
      where: { submissionId: { in: ids }, cspCategory: 'TOTAL', gender: 'TOTAL', departureType: { not: 'ENSEMBLE' } },
      _sum: { value: true },
      orderBy: { _sum: { value: 'desc' } },
    });

    return rows.map((r: any) => ({ departureType: r.departureType, total: r._sum.value ?? 0 }));
  }

  // ─────────────────────────────────────────────────────────────
  // 14. DISMISSAL REASONS
  // ─────────────────────────────────────────────────────────────
  async getDismissalReasons(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDismissalReason.findMany({
      where: { submissionId: { in: ids } },
      select: { reasonIndex: true, reasonText: true, maleCount: true, femaleCount: true, totalCount: true },
      orderBy: { reasonIndex: 'asc' },
    });

    const grouped: Record<string, { male: number; female: number; total: number }> = {};
    for (const r of rows) {
      const key = r.reasonText?.trim() || `Raison ${r.reasonIndex}`;
      if (!grouped[key]) grouped[key] = { male: 0, female: 0, total: 0 };
      grouped[key].male += r.maleCount ?? 0;
      grouped[key].female += r.femaleCount ?? 0;
      grouped[key].total += r.totalCount ?? 0;
    }

    return Object.entries(grouped)
      .map(([reason, counts]) => ({ reason, maleCount: counts.male, femaleCount: counts.female, totalCount: counts.total }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  // ─────────────────────────────────────────────────────────────
  // 15. DISMISSAL & TECHNICAL UNEMPLOYMENT
  // ─────────────────────────────────────────────────────────────
  async getDismissalUnemployment(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopDismissalUnemployment.groupBy({
      by: ['cspCategory', 'type', 'gender'],
      where: { submissionId: { in: ids } },
      _sum: { value: true },
      orderBy: [{ type: 'asc' }, { cspCategory: 'asc' }],
    });

    return rows.map((r: any) => ({ cspCategory: r.cspCategory, type: r.type, gender: r.gender, count: r._sum.value ?? 0 }));
  }

  // ─────────────────────────────────────────────────────────────
  // 16. INTERNSHIPS
  // ─────────────────────────────────────────────────────────────
  async getInternships(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopInternshipData.groupBy({
      by: ['internshipType', 'gender'],
      where: { submissionId: { in: ids }, internshipType: { not: 'TOTAL' } },
      _sum: { value: true },
      orderBy: { internshipType: 'asc' },
    });

    return rows.map((r: any) => ({ internshipType: r.internshipType, gender: r.gender, count: r._sum.value ?? 0 }));
  }

  // ─────────────────────────────────────────────────────────────
  // 17. SKILL NEEDS
  // ─────────────────────────────────────────────────────────────
  async getSkillNeeds(filter: AnalyticsFilter & { limit?: number }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopSkillNeed.findMany({
      where: { submissionId: { in: ids }, skillDescription: { not: null } },
      select: { skillDescription: true, maleCount: true, femaleCount: true, totalCount: true },
    });

    const grouped: Record<string, { male: number; female: number; total: number }> = {};
    for (const r of rows) {
      const key = r.skillDescription?.trim() || 'Non précisé';
      if (!grouped[key]) grouped[key] = { male: 0, female: 0, total: 0 };
      grouped[key].male += r.maleCount ?? 0;
      grouped[key].female += r.femaleCount ?? 0;
      grouped[key].total += r.totalCount ?? 0;
    }

    const result = Object.entries(grouped)
      .map(([skill, c]) => ({ skill, maleCount: c.male, femaleCount: c.female, totalCount: c.total }))
      .sort((a, b) => b.totalCount - a.totalCount);

    return filter.limit ? result.slice(0, filter.limit) : result;
  }

  // ─────────────────────────────────────────────────────────────
  // 18. TRAINING NEEDS
  // ─────────────────────────────────────────────────────────────
  async getTrainingNeeds(filter: AnalyticsFilter & { limit?: number }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const rows = await (this.prisma as any).onefopTrainingNeed.findMany({
      where: { submissionId: { in: ids }, trainingDomain: { not: null } },
      select: { trainingDomain: true, maleCount: true, femaleCount: true, totalCount: true },
    });

    const grouped: Record<string, { male: number; female: number; total: number }> = {};
    for (const r of rows) {
      const key = r.trainingDomain?.trim() || 'Non précisé';
      if (!grouped[key]) grouped[key] = { male: 0, female: 0, total: 0 };
      grouped[key].male += r.maleCount ?? 0;
      grouped[key].female += r.femaleCount ?? 0;
      grouped[key].total += r.totalCount ?? 0;
    }

    const result = Object.entries(grouped)
      .map(([domain, c]) => ({ domain, maleCount: c.male, femaleCount: c.female, totalCount: c.total }))
      .sort((a, b) => b.totalCount - a.totalCount);

    return filter.limit ? result.slice(0, filter.limit) : result;
  }

  // ─────────────────────────────────────────────────────────────
  // 19. TRAINING GAP
  // ─────────────────────────────────────────────────────────────
  async getTrainingGap(filter: AnalyticsFilter) {
    const [skillNeeds, trainingNeeds] = await Promise.all([
      this.getSkillNeeds(filter),
      this.getTrainingNeeds(filter),
    ]);

    const demandMap = new Map(skillNeeds.map((s) => [s.skill, s.totalCount]));
    const supplyMap = new Map(trainingNeeds.map((t) => [t.domain, t.totalCount]));
    const allKeys = new Set([...demandMap.keys(), ...supplyMap.keys()]);

    const gap = Array.from(allKeys)
      .map((key) => ({
        skill: key,
        demand: demandMap.get(key) ?? 0,
        supply: supplyMap.get(key) ?? 0,
        gap: (demandMap.get(key) ?? 0) - (supplyMap.get(key) ?? 0),
      }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return {
      skillsInDemand: gap.filter((g) => g.gap > 0).slice(0, 10),
      skillsInSurplus: gap.filter((g) => g.gap < 0).slice(0, 10),
      balanced: gap.filter((g) => g.gap === 0),
    };
  }


  // Add these alias methods for frontend compatibility
  async getHiresByDiploma(filter: AnalyticsFilter & { limit?: number }) {
    return this.getDiplomaSummary(filter);
  }

  async getSkillDemand(filter: AnalyticsFilter & { limit?: number }) {
    return this.getSkillNeeds(filter);
  }



  // ─────────────────────────────────────────────────────────────
  // 20. VACANCIES BY SEGMENT
  // ─────────────────────────────────────────────────────────────
  async getVacanciesBySegment(filter: AnalyticsFilter & { groupBy: 'companySize' | 'sector' }) {
    const ids = await this.resolveSubmissionIds(filter);
    if (!ids.length) return [];

    const details = await (this.prisma as any).onefopEnterpriseDetail.findMany({
      where: { submissionId: { in: ids } },
      select: { enterpriseSize: true, sector: true, vacancies: true },
    });

    const map = new Map<string, { vacancies: number; count: number }>();
    for (const d of details) {
      const key = filter.groupBy === 'companySize'
        ? (d.enterpriseSize ?? 'Inconnu')
        : (d.sector ?? 'Inconnu');
      if (!map.has(key)) map.set(key, { vacancies: 0, count: 0 });
      const stats = map.get(key)!;
      stats.vacancies += d.vacancies ?? 0;
      stats.count += 1;
    }

    return Array.from(map.entries())
      .map(([segment, stats]) => ({
        segment,
        totalVacancies: stats.vacancies,
        companyCount: stats.count,
        avgVacanciesPerCompany: stats.count > 0 ? Math.round(stats.vacancies / stats.count) : 0,
      }))
      .sort((a, b) => b.totalVacancies - a.totalVacancies);
  }

  // ─────────────────────────────────────────────────────────────
  // 21. SUBMISSION LIST
  // ─────────────────────────────────────────────────────────────
  async getSubmissions(filter: SubmissionListFilter) {
    return (this.prisma as any).onefopSubmission.findMany({
      where: this.buildSubmissionWhere(filter, filter.status ?? 'APPROVED'),
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
      include: {
        respondent: true,
        enterpriseDetail: true,
        cooperativeDetail: true,
        ctdDetail: true,
        ongDetail: true,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 22. FULL DASHBOARD
  // ─────────────────────────────────────────────────────────────
  async getDashboard(filter: AnalyticsFilter) {
    const ids = await this.resolveSubmissionIds(filter);

    if (!ids.length) {
      return {
        submissionCount: 0, filter,
        employment: { totalEmployees: 0, byGender: [], byCsp: [] },
        genderParity: { maleCount: 0, femaleCount: 0, malePercentage: 0, femalePercentage: 0, ratioFemaleToMale: null },
        youthEmployment: { youthHires: 0, totalHires: 0, youthPercentage: 0 },
        diplomas: [], disability: [],
        inclusion: { disabled: 0, vulnerable: 0, totalHires: 0, disabledByCsp: [], vulnerableByType: [] },
        vulnerable: [], firstTimeWorkers: [], departures: [], dismissalReasons: [],
        dismissalUnemployment: [], internships: [], skillNeeds: [], trainingNeeds: [],
        trainingGap: { skillsInDemand: [], skillsInSurplus: [], balanced: [] },
      };
    }

    // Inject pre-resolved IDs so sub-methods skip the DB round-trip
    const f: AnalyticsFilter = { ...filter, _ids: ids };

    const [
      employment, genderParity, youthEmployment, diplomas, disability,
      inclusion, vulnerable, firstTimeWorkers, departures, dismissalReasons,
      dismissalUnemployment, internships, skillNeeds, trainingNeeds, trainingGap,
    ] = await Promise.all([
      this.getEmploymentSummary(f),
      this.getGenderParity(f),
      this.getYouthEmployment(f),
      this.getDiplomaSummary({ ...f, limit: 10 }),
      this.getDisabilityData(f),
      this.getInclusionMetrics({ ...f, breakdownBy: 'both' }),
      this.getVulnerableWorkers(f),
      this.getFirstTimeWorkers(f),
      this.getDepartureSummary(f),
      this.getDismissalReasons(f),
      this.getDismissalUnemployment(f),
      this.getInternships(f),
      this.getSkillNeeds({ ...f, limit: 10 }),
      this.getTrainingNeeds({ ...f, limit: 10 }),
      this.getTrainingGap(f),
    ]);

    return {
      submissionCount: ids.length, filter,  // return original filter, not f
      employment, genderParity, youthEmployment, diplomas, disability,
      inclusion, vulnerable, firstTimeWorkers, departures, dismissalReasons,
      dismissalUnemployment, internships, skillNeeds, trainingNeeds, trainingGap,
    };
  }
}