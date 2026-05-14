// src/analytics/onefop-analytics.service.ts
//
// BUG-3 FIX: All analytics methods now read from flat cell-ID keys
// (e.g. "s21q01_total_male_total") instead of nested DTO paths
// (e.g. "jobApplications.total.male.total") which were always undefined.
//
// New helper: flatGet(raw, key) — replaces safeGet() for table data.
// safeGet() is kept for simple scalar fields (area, sector, etc.)
// that ARE stored as nested DTO keys in rawData for non-table fields.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type FlatRaw = Record<string, string | number | null>;

@Injectable()
export class OnefopAnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  // Read a nested DTO scalar (non-table simple fields stored nested).
  private safeGet(obj: any, path: string): any {
    return path
      .split('.')
      .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }

  // BUG-3 FIX: Read a flat cell key from rawData.
  // Returns 0 for missing or non-numeric values.
  private flatGet(raw: FlatRaw, key: string): number {
    const v = raw[key];
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  // Sum a CSP gender-age prefix total from flat rawData.
  // e.g. getCspTotal(raw, 's21q01', 'male') reads s21q01_total_male_total
  private getCspTotal(raw: FlatRaw, prefix: string, gender: string): number {
    return this.flatGet(raw, `${prefix}_total_${gender}_total`);
  }

  // Sum across all CSP rows for a given prefix, gender and age band.
  private getCspAgeTotal(
    raw: FlatRaw,
    prefix: string,
    gender: string,
    age: string,
  ): number {
    return this.flatGet(raw, `${prefix}_total_${gender}_${age}`);
  }

  private async fetchApproved(
    year?: number,
    region?: string,
    department?: string,
    subdivision?: string,
  ) {
    const records = await this.prisma.onefopSubmission.findMany({
      where: {
        status: 'APPROVED',
        ...(year && { surveyYear: year }),
        ...(region && { region }),
        ...(department && { department }),
        ...(subdivision && { subdivision }),
      },
      select: {
        rawData: true,
        region: true,
        department: true,
        subdivision: true,
        createdAt: true,
        surveyYear: true,
        formType: true,
      },
    });

    return records.map((r) => ({
      raw: r.rawData as FlatRaw,
      region: r.region,
      department: r.department,
      subdivision: r.subdivision,
      submittedAt: r.createdAt?.toISOString() ?? null,
      surveyYear: r.surveyYear,
      formType: r.formType,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // EMPLOYMENT BY LOCATION
  // BUG-3 FIX: permanentWorkers is a scalar in the DTO, stored nested
  // (simple field, not a table cell) — safeGet() still works here.
  // ─────────────────────────────────────────────────────────────

  async getEmploymentByLocation(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    groupBy: 'region' | 'department' | 'subdivision';
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );
    const map = new Map<string, { totalEmployees: number; companyCount: number }>();

    for (const item of data) {
      const key =
        params.groupBy === 'region'
          ? item.region ?? 'Unknown'
          : params.groupBy === 'department'
            ? item.department ?? 'Unknown'
            : item.subdivision ?? 'Unknown';

      if (!map.has(key)) map.set(key, { totalEmployees: 0, companyCount: 0 });
      const stats = map.get(key)!;
      // permanentWorkers is a simple scalar field — stored in the rawData
      // as a top-level key from the DTO (not a flat cell ID).
      const permanent =
        (this.safeGet(item.raw, 'permanentWorkers') as number) ?? 0;
      stats.totalEmployees += permanent;
      stats.companyCount += 1;
    }

    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      totalEmployees: stats.totalEmployees,
      companyCount: stats.companyCount,
      avgEmployeesPerCompany:
        stats.companyCount > 0
          ? Math.round(stats.totalEmployees / stats.companyCount)
          : 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // RECRUITMENT TRENDS
  // BUG-3 FIX: reads s22q01_total_total_total and s22q02_total_total_total
  // ─────────────────────────────────────────────────────────────

  async getRecruitmentTrends(params: {
    startYear: number;
    endYear: number;
    region?: string;
    department?: string;
    subdivision?: string;
    granularity: 'year' | 'quarter' | 'month';
  }) {
    const records = await this.prisma.onefopSubmission.findMany({
      where: {
        status: 'APPROVED',
        surveyYear: { gte: params.startYear, lte: params.endYear },
        ...(params.region && { region: params.region }),
        ...(params.department && { department: params.department }),
        ...(params.subdivision && { subdivision: params.subdivision }),
      },
      select: {
        rawData: true,
        createdAt: true,
        region: true,
        department: true,
        subdivision: true,
        surveyYear: true,
      },
    });

    const trendsMap = new Map<string, { permanent: number; temporary: number }>();

    for (const r of records) {
      const raw = r.rawData as FlatRaw;
      const date = r.createdAt;
      let periodKey: string;

      if (params.granularity === 'year') {
        periodKey = String(r.surveyYear ?? date?.getFullYear() ?? params.startYear);
      } else if (params.granularity === 'quarter') {
        const y = r.surveyYear ?? date?.getFullYear() ?? params.startYear;
        const q = date ? Math.ceil((date.getMonth() + 1) / 3) : 1;
        periodKey = `${y}-Q${q}`;
      } else {
        const y = r.surveyYear ?? date?.getFullYear() ?? params.startYear;
        const m = date ? date.getMonth() + 1 : 1;
        periodKey = `${y}-${String(m).padStart(2, '0')}`;
      }

      if (!trendsMap.has(periodKey)) {
        trendsMap.set(periodKey, { permanent: 0, temporary: 0 });
      }
      const stats = trendsMap.get(periodKey)!;

      // BUG-3 FIX: read flat keys for permanent (s22q01) and temporary (s22q02)
      stats.permanent += this.flatGet(raw, 's22q01_total_total_total');
      stats.temporary += this.flatGet(raw, 's22q02_total_total_total');
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
  // HIRES BY DEMOGRAPHICS
  // BUG-3 FIX: reads flat cell IDs from s22q01 (permanent recruitments)
  // ─────────────────────────────────────────────────────────────

  async getHiresByDemographics(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    csp?: 'cadres' | 'foremen' | 'workers';
    gender?: 'male' | 'female';
    ageGroup?: '15_24' | '25_34' | '35_plus';
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    const prefix = 's22q01';
    const cspRows = params.csp ? [params.csp] : ['cadres', 'foremen', 'workers'];
    const genders = params.gender ? [params.gender] : ['male', 'female'];
    const ages = params.ageGroup
      ? [params.ageGroup]
      : ['15_24', '25_34', '35_plus'];

    const result: Record<string, any> = {};

    for (const csp of cspRows) {
      result[csp] = {};
      for (const gender of genders) {
        result[csp][gender] = {};
        let genderTotal = 0;
        for (const age of ages) {
          const key = `${prefix}_${csp}_${gender}_${age}`;
          const sum = data.reduce((acc, item) => acc + this.flatGet(item.raw, key), 0);
          result[csp][gender][age] = sum;
          genderTotal += sum;
        }
        result[csp][gender]['total'] = genderTotal;
      }
      result[csp]['total'] =
        (result[csp]['male']?.['total'] ?? 0) +
        (result[csp]['female']?.['total'] ?? 0);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // HIRES BY DIPLOMA
  // BUG-3 FIX: reads s22q03_<diploma>_total_total flat keys
  // ─────────────────────────────────────────────────────────────

  async getHiresByDiploma(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    diploma?: string;
    limit?: number;
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    // Diploma keys match AST prefixes
    const diplomas = [
      'cep', 'probatoire', 'bac', 'bts', 'licence',
      'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome',
    ];

    const diplomaMap = new Map<string, number>();

    for (const item of data) {
      for (const d of diplomas) {
        if (params.diploma && params.diploma !== d) continue;
        // BUG-3 FIX: read flat key for diploma total across all genders/ages
        const count = this.flatGet(item.raw, `s22q03_${d}_total_total`);
        diplomaMap.set(d, (diplomaMap.get(d) ?? 0) + count);
      }
    }

    if (params.diploma) {
      return { diploma: params.diploma, hires: diplomaMap.get(params.diploma) ?? 0 };
    }

    const result = Array.from(diplomaMap.entries())
      .map(([diploma, hires]) => ({ diploma, hires }))
      .sort((a, b) => b.hires - a.hires);

    return params.limit ? result.slice(0, params.limit) : result;
  }

  // ─────────────────────────────────────────────────────────────
  // VACANCIES BY SEGMENT
  // vacancies is a simple scalar, safeGet() still works.
  // ─────────────────────────────────────────────────────────────

  async getVacanciesBySegment(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    groupBy: 'companySize' | 'businessSector';
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    const sizeNames: Record<number, string> = { 1: 'TPE', 2: 'PE', 3: 'ME', 4: 'GE' };
    const sectorNames: Record<number, string> = {
      1: 'Primary',
      2: 'Secondary',
      3: 'Tertiary',
    };

    const map = new Map<string, { vacancies: number; count: number }>();

    for (const item of data) {
      let key: string;
      if (params.groupBy === 'companySize') {
        const size = this.safeGet(item.raw, 'companySize');
        key = sizeNames[size as number] ?? 'Unknown';
      } else {
        const sector = this.safeGet(item.raw, 'businessSector');
        key = sectorNames[sector as number] ?? 'Unknown';
      }
      const vacancies = (this.safeGet(item.raw, 'vacancies') as number) ?? 0;
      if (!map.has(key)) map.set(key, { vacancies: 0, count: 0 });
      const stats = map.get(key)!;
      stats.vacancies += vacancies;
      stats.count += 1;
    }

    return Array.from(map.entries()).map(([segment, stats]) => ({
      segment,
      totalVacancies: stats.vacancies,
      companyCount: stats.count,
      avgVacanciesPerCompany:
        stats.count > 0 ? Math.round(stats.vacancies / stats.count) : 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // SKILL DEMAND
  // BUG-3 FIX: reads flat keys s4q02_skill_N_text
  // ─────────────────────────────────────────────────────────────

  async getSkillDemand(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    limit?: number;
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );
    const skillCounts: Record<string, number> = {};

    for (const item of data) {
      for (let i = 1; i <= 3; i++) {
        // BUG-3 FIX: read flat key for skill description text
        const desc = String(item.raw[`s4q02_skill_${i}_text`] ?? '').trim();
        if (desc) {
          skillCounts[desc] = (skillCounts[desc] ?? 0) + 1;
        }
      }
    }

    const result = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);

    return params.limit ? result.slice(0, params.limit) : result;
  }

  // ─────────────────────────────────────────────────────────────
  // TRAINING GAP
  // BUG-3 FIX: reads flat keys s4q02_skill_N_text / s4q03_domain_N_text
  // ─────────────────────────────────────────────────────────────

  async getTrainingGap(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    const skillDemand: Record<string, number> = {};
    const trainingSupply: Record<string, number> = {};

    for (const item of data) {
      // BUG-3 FIX: flat keys for skill text
      for (let i = 1; i <= 3; i++) {
        const skill = String(item.raw[`s4q02_skill_${i}_text`] ?? '').trim();
        if (skill) skillDemand[skill] = (skillDemand[skill] ?? 0) + 1;
      }
      // BUG-3 FIX: flat keys for training domain text
      for (let i = 1; i <= 3; i++) {
        const domain = String(item.raw[`s4q03_domain_${i}_text`] ?? '').trim();
        if (domain) trainingSupply[domain] = (trainingSupply[domain] ?? 0) + 1;
      }
    }

    const allSkills = new Set([
      ...Object.keys(skillDemand),
      ...Object.keys(trainingSupply),
    ]);

    const gap = Array.from(allSkills)
      .map((skill) => ({
        skill,
        demand: skillDemand[skill] ?? 0,
        supply: trainingSupply[skill] ?? 0,
        gap: (skillDemand[skill] ?? 0) - (trainingSupply[skill] ?? 0),
      }))
      .filter((g) => g.demand > 0 || g.supply > 0)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return {
      year: params.year,
      region: params.region,
      skillsInDemand: gap.filter((g) => g.demand > g.supply).slice(0, 10),
      skillsInSurplus: gap.filter((g) => g.supply > g.demand).slice(0, 10),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GENDER PARITY
  // BUG-3 FIX: reads s21q01_total_male_total / s21q01_total_female_total
  // ─────────────────────────────────────────────────────────────

  async getGenderParity(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    let totalMale = 0;
    let totalFemale = 0;

    for (const item of data) {
      // BUG-3 FIX: flat keys for job application totals (s21q01)
      totalMale += this.flatGet(item.raw, 's21q01_total_male_total');
      totalFemale += this.flatGet(item.raw, 's21q01_total_female_total');
    }

    const total = totalMale + totalFemale;
    return {
      maleApplicants: totalMale,
      femaleApplicants: totalFemale,
      malePercentage: total > 0 ? +((totalMale / total) * 100).toFixed(1) : 0,
      femalePercentage: total > 0 ? +((totalFemale / total) * 100).toFixed(1) : 0,
      ratioFemaleToMale: totalMale > 0 ? +(totalFemale / totalMale).toFixed(2) : null,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // YOUTH EMPLOYMENT
  // BUG-3 FIX: reads s22q01_total_male_15_24 + s22q01_total_female_15_24
  // ─────────────────────────────────────────────────────────────

  async getYouthEmployment(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    let youth = 0;
    let total = 0;

    for (const item of data) {
      // BUG-3 FIX: flat keys for 15-24 age band in permanent recruitments
      youth += this.flatGet(item.raw, 's22q01_total_male_15_24');
      youth += this.flatGet(item.raw, 's22q01_total_female_15_24');
      total += this.flatGet(item.raw, 's22q01_total_total_total');
    }

    return {
      youthHires: youth,
      totalHires: total,
      youthPercentage: total > 0 ? +((youth / total) * 100).toFixed(1) : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // INCLUSION METRICS
  // BUG-3/4 FIX: reads flat keys for disability (s22q04) and
  // vulnerable (s22q05_ent for enterprise, s22q05_oth for others)
  // ─────────────────────────────────────────────────────────────

  async getInclusionMetrics(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
    breakdownBy?: 'disability' | 'vulnerability' | 'both';
  }) {
    const data = await this.fetchApproved(
      params.year,
      params.region,
      params.department,
      params.subdivision,
    );

    let disabled = 0;
    let vulnerable = 0;
    let totalHires = 0;

    for (const item of data) {
      // Disability total: s22q04_total_total_total
      disabled += this.flatGet(item.raw, 's22q04_total_total_total');

      // BUG-4 FIX: use correct prefix based on entity type
      const isEnterprise = item.formType === 'ENTREPRISE';
      const vulPrefix = isEnterprise ? 's22q05_ent' : 's22q05_oth';
      vulnerable += this.flatGet(item.raw, `${vulPrefix}_total_total_total`);

      totalHires += this.flatGet(item.raw, 's22q01_total_total_total');
    }

    const result: Record<string, any> = { disabled, vulnerable, totalHires };

    if (params.breakdownBy === 'disability' || params.breakdownBy === 'both') {
      const byCSP: Record<string, number> = {};
      for (const item of data) {
        for (const csp of ['cadres', 'foremen', 'workers']) {
          byCSP[csp] = (byCSP[csp] ?? 0) +
            this.flatGet(item.raw, `s22q04_${csp}_total_total`);
        }
      }
      result.disabledByCSP = byCSP;
    }

    if (params.breakdownBy === 'vulnerability' || params.breakdownBy === 'both') {
      const byType: Record<string, number> = {};
      for (const item of data) {
        const isEnterprise = item.formType === 'ENTREPRISE';
        if (isEnterprise) {
          for (const vRow of ['deplaces_internes', 'refugies', 'orphelins']) {
            byType[vRow] = (byType[vRow] ?? 0) +
              this.flatGet(item.raw, `s22q05_ent_${vRow}_total_total`);
          }
        } else {
          for (const csp of ['cadres', 'foremen', 'workers']) {
            byType[csp] = (byType[csp] ?? 0) +
              this.flatGet(item.raw, `s22q05_oth_${csp}_total_total`);
          }
        }
      }
      result.vulnerableByType = byType;
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // DASHBOARD SUMMARY
  // ─────────────────────────────────────────────────────────────

  async getDashboardSummary(params: {
    year?: number;
    region?: string;
    department?: string;
    subdivision?: string;
  }) {
    const [
      employment,
      recruitmentTrends,
      vacancies,
      skillDemand,
      genderParity,
      youth,
      inclusion,
      hiresByDiploma,
    ] = await Promise.all([
      this.getEmploymentByLocation({ ...params, groupBy: 'region' }),
      this.getRecruitmentTrends({
        startYear: params.year ?? new Date().getFullYear() - 2,
        endYear: params.year ?? new Date().getFullYear(),
        region: params.region,
        department: params.department,
        subdivision: params.subdivision,
        granularity: 'year',
      }),
      this.getVacanciesBySegment({ ...params, groupBy: 'businessSector' }),
      this.getSkillDemand({ ...params, limit: 5 }),
      this.getGenderParity(params),
      this.getYouthEmployment(params),
      this.getInclusionMetrics({ ...params, breakdownBy: 'both' }),
      this.getHiresByDiploma({ ...params, limit: 5 }),
    ]);

    return {
      ...params,
      totalEmployees: employment.reduce((s, r) => s + r.totalEmployees, 0),
      totalCompanies: employment.reduce((s, r) => s + r.companyCount, 0),
      recruitmentTrends,
      vacanciesBySector: vacancies,
      topSkillsInDemand: skillDemand,
      genderParity,
      youthEmployment: youth,
      inclusion,
      topDiplomasHired: Array.isArray(hiresByDiploma)
        ? hiresByDiploma.slice(0, 5)
        : [],
    };
  }
}