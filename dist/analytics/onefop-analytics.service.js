"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnefopAnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let OnefopAnalyticsService = class OnefopAnalyticsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    safeGet(obj, path) {
        return path
            .split('.')
            .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }
    flatGet(raw, key) {
        const v = raw[key];
        if (v === undefined || v === null || v === '')
            return 0;
        const n = typeof v === 'number' ? v : parseInt(String(v), 10);
        return isNaN(n) ? 0 : n;
    }
    getCspTotal(raw, prefix, gender) {
        return this.flatGet(raw, `${prefix}_total_${gender}_total`);
    }
    getCspAgeTotal(raw, prefix, gender, age) {
        return this.flatGet(raw, `${prefix}_total_${gender}_${age}`);
    }
    async fetchApproved(year, region, department, subdivision) {
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
            raw: r.rawData,
            region: r.region,
            department: r.department,
            subdivision: r.subdivision,
            submittedAt: r.createdAt?.toISOString() ?? null,
            surveyYear: r.surveyYear,
            formType: r.formType,
        }));
    }
    async getEmploymentByLocation(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const map = new Map();
        for (const item of data) {
            const key = params.groupBy === 'region'
                ? item.region ?? 'Unknown'
                : params.groupBy === 'department'
                    ? item.department ?? 'Unknown'
                    : item.subdivision ?? 'Unknown';
            if (!map.has(key))
                map.set(key, { totalEmployees: 0, companyCount: 0 });
            const stats = map.get(key);
            const permanent = this.safeGet(item.raw, 'permanentWorkers') ?? 0;
            stats.totalEmployees += permanent;
            stats.companyCount += 1;
        }
        return Array.from(map.entries()).map(([name, stats]) => ({
            name,
            totalEmployees: stats.totalEmployees,
            companyCount: stats.companyCount,
            avgEmployeesPerCompany: stats.companyCount > 0
                ? Math.round(stats.totalEmployees / stats.companyCount)
                : 0,
        }));
    }
    async getRecruitmentTrends(params) {
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
        const trendsMap = new Map();
        for (const r of records) {
            const raw = r.rawData;
            const date = r.createdAt;
            let periodKey;
            if (params.granularity === 'year') {
                periodKey = String(r.surveyYear ?? date?.getFullYear() ?? params.startYear);
            }
            else if (params.granularity === 'quarter') {
                const y = r.surveyYear ?? date?.getFullYear() ?? params.startYear;
                const q = date ? Math.ceil((date.getMonth() + 1) / 3) : 1;
                periodKey = `${y}-Q${q}`;
            }
            else {
                const y = r.surveyYear ?? date?.getFullYear() ?? params.startYear;
                const m = date ? date.getMonth() + 1 : 1;
                periodKey = `${y}-${String(m).padStart(2, '0')}`;
            }
            if (!trendsMap.has(periodKey)) {
                trendsMap.set(periodKey, { permanent: 0, temporary: 0 });
            }
            const stats = trendsMap.get(periodKey);
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
    async getHiresByDemographics(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const prefix = 's22q01';
        const cspRows = params.csp ? [params.csp] : ['cadres', 'foremen', 'workers'];
        const genders = params.gender ? [params.gender] : ['male', 'female'];
        const ages = params.ageGroup
            ? [params.ageGroup]
            : ['15_24', '25_34', '35_plus'];
        const result = {};
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
    async getHiresByDiploma(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const diplomas = [
            'cep', 'probatoire', 'bac', 'bts', 'licence',
            'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome',
        ];
        const diplomaMap = new Map();
        for (const item of data) {
            for (const d of diplomas) {
                if (params.diploma && params.diploma !== d)
                    continue;
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
    async getVacanciesBySegment(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const sizeNames = { 1: 'TPE', 2: 'PE', 3: 'ME', 4: 'GE' };
        const sectorNames = {
            1: 'Primary',
            2: 'Secondary',
            3: 'Tertiary',
        };
        const map = new Map();
        for (const item of data) {
            let key;
            if (params.groupBy === 'companySize') {
                const size = this.safeGet(item.raw, 'companySize');
                key = sizeNames[size] ?? 'Unknown';
            }
            else {
                const sector = this.safeGet(item.raw, 'businessSector');
                key = sectorNames[sector] ?? 'Unknown';
            }
            const vacancies = this.safeGet(item.raw, 'vacancies') ?? 0;
            if (!map.has(key))
                map.set(key, { vacancies: 0, count: 0 });
            const stats = map.get(key);
            stats.vacancies += vacancies;
            stats.count += 1;
        }
        return Array.from(map.entries()).map(([segment, stats]) => ({
            segment,
            totalVacancies: stats.vacancies,
            companyCount: stats.count,
            avgVacanciesPerCompany: stats.count > 0 ? Math.round(stats.vacancies / stats.count) : 0,
        }));
    }
    async getSkillDemand(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const skillCounts = {};
        for (const item of data) {
            for (let i = 1; i <= 3; i++) {
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
    async getTrainingGap(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        const skillDemand = {};
        const trainingSupply = {};
        for (const item of data) {
            for (let i = 1; i <= 3; i++) {
                const skill = String(item.raw[`s4q02_skill_${i}_text`] ?? '').trim();
                if (skill)
                    skillDemand[skill] = (skillDemand[skill] ?? 0) + 1;
            }
            for (let i = 1; i <= 3; i++) {
                const domain = String(item.raw[`s4q03_domain_${i}_text`] ?? '').trim();
                if (domain)
                    trainingSupply[domain] = (trainingSupply[domain] ?? 0) + 1;
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
    async getGenderParity(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        let totalMale = 0;
        let totalFemale = 0;
        for (const item of data) {
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
    async getYouthEmployment(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        let youth = 0;
        let total = 0;
        for (const item of data) {
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
    async getInclusionMetrics(params) {
        const data = await this.fetchApproved(params.year, params.region, params.department, params.subdivision);
        let disabled = 0;
        let vulnerable = 0;
        let totalHires = 0;
        for (const item of data) {
            disabled += this.flatGet(item.raw, 's22q04_total_total_total');
            const isEnterprise = item.formType === 'ENTREPRISE';
            const vulPrefix = isEnterprise ? 's22q05_ent' : 's22q05_oth';
            vulnerable += this.flatGet(item.raw, `${vulPrefix}_total_total_total`);
            totalHires += this.flatGet(item.raw, 's22q01_total_total_total');
        }
        const result = { disabled, vulnerable, totalHires };
        if (params.breakdownBy === 'disability' || params.breakdownBy === 'both') {
            const byCSP = {};
            for (const item of data) {
                for (const csp of ['cadres', 'foremen', 'workers']) {
                    byCSP[csp] = (byCSP[csp] ?? 0) +
                        this.flatGet(item.raw, `s22q04_${csp}_total_total`);
                }
            }
            result.disabledByCSP = byCSP;
        }
        if (params.breakdownBy === 'vulnerability' || params.breakdownBy === 'both') {
            const byType = {};
            for (const item of data) {
                const isEnterprise = item.formType === 'ENTREPRISE';
                if (isEnterprise) {
                    for (const vRow of ['deplaces_internes', 'refugies', 'orphelins']) {
                        byType[vRow] = (byType[vRow] ?? 0) +
                            this.flatGet(item.raw, `s22q05_ent_${vRow}_total_total`);
                    }
                }
                else {
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
    async getDashboardSummary(params) {
        const [employment, recruitmentTrends, vacancies, skillDemand, genderParity, youth, inclusion, hiresByDiploma,] = await Promise.all([
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
};
exports.OnefopAnalyticsService = OnefopAnalyticsService;
exports.OnefopAnalyticsService = OnefopAnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OnefopAnalyticsService);
//# sourceMappingURL=onefop-analytics.service.js.map