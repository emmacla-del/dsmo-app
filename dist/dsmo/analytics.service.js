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
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_types_1 = require("../types/prisma.types");
let AnalyticsService = class AnalyticsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getEmploymentByRegion(year) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED },
            include: { employees: true, company: true },
        });
        const byRegion = {};
        for (const decl of declarations) {
            if (!byRegion[decl.region]) {
                byRegion[decl.region] = {
                    region: decl.region,
                    totalEmployees: 0,
                    maleEmployees: 0,
                    femaleEmployees: 0,
                    companyCount: 0,
                };
            }
            const males = decl.employees.filter((e) => e.gender === 'M').length;
            const females = decl.employees.filter((e) => e.gender === 'F').length;
            byRegion[decl.region].totalEmployees += decl.employees.length;
            byRegion[decl.region].maleEmployees += males;
            byRegion[decl.region].femaleEmployees += females;
            byRegion[decl.region].companyCount += 1;
        }
        for (const r in byRegion) {
            const companies = byRegion[r].companyCount;
            if (companies > 0) {
                byRegion[r].avgEmployeesPerCompany = Math.round(byRegion[r].totalEmployees / companies);
            }
        }
        return Object.values(byRegion);
    }
    async getEmploymentTrends(startYear, endYear, region, granularity = 'year') {
        const trends = [];
        for (let year = startYear; year <= endYear; year++) {
            const where = { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED };
            if (region)
                where.region = region;
            const declarations = await this.prisma.declaration.findMany({
                where,
                include: { employees: true },
            });
            if (granularity === 'year') {
                const totalEmployees = declarations.reduce((sum, d) => sum + d.employees.length, 0);
                trends.push({
                    year,
                    period: String(year),
                    label: String(year),
                    totalEmployees,
                });
            }
            else if (granularity === 'semester') {
                const s1 = declarations.filter(d => !d.fillingDate || new Date(d.fillingDate).getMonth() < 6);
                const s2 = declarations.filter(d => d.fillingDate && new Date(d.fillingDate).getMonth() >= 6);
                trends.push({
                    year,
                    period: `${year}-S1`,
                    label: `${year} S1`,
                    totalEmployees: s1.reduce((sum, d) => sum + d.employees.length, 0),
                });
                trends.push({
                    year,
                    period: `${year}-S2`,
                    label: `${year} S2`,
                    totalEmployees: s2.reduce((sum, d) => sum + d.employees.length, 0),
                });
            }
            else if (granularity === 'quarter') {
                for (let q = 1; q <= 4; q++) {
                    const qStart = (q - 1) * 3;
                    const qEnd = q * 3;
                    const qDecls = declarations.filter(d => {
                        if (!d.fillingDate)
                            return q === 1;
                        const month = new Date(d.fillingDate).getMonth();
                        return month >= qStart && month < qEnd;
                    });
                    trends.push({
                        year,
                        period: `${year}-Q${q}`,
                        label: `${year} Q${q}`,
                        totalEmployees: qDecls.reduce((sum, d) => sum + d.employees.length, 0),
                    });
                }
            }
        }
        return trends;
    }
    async getSectorDistribution(year, region) {
        const where = { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED };
        if (region)
            where.region = region;
        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { company: true, employees: true },
        });
        const sectorsMap = {};
        for (const decl of declarations) {
            const sector = decl.company.mainActivity;
            if (!sectorsMap[sector]) {
                sectorsMap[sector] = { employees: 0, male: 0, female: 0 };
            }
            const males = decl.employees.filter((e) => e.gender === 'M').length;
            const females = decl.employees.filter((e) => e.gender === 'F').length;
            sectorsMap[sector].employees += decl.employees.length;
            sectorsMap[sector].male += males;
            sectorsMap[sector].female += females;
        }
        const result = Object.entries(sectorsMap).map(([sector, data]) => ({
            sector,
            employees: data.employees,
            male: data.male,
            female: data.female,
        }));
        result.sort((a, b) => b.employees - a.employees);
        return result;
    }
    async getGenderDistribution(year, region) {
        const where = { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED };
        if (region)
            where.region = region;
        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { employees: true },
        });
        let maleCount = 0, femaleCount = 0, otherCount = 0;
        for (const decl of declarations) {
            for (const emp of decl.employees) {
                if (emp.gender === 'M')
                    maleCount++;
                else if (emp.gender === 'F')
                    femaleCount++;
                else
                    otherCount++;
            }
        }
        const total = maleCount + femaleCount + otherCount;
        return {
            male: { count: maleCount, percentage: total > 0 ? (maleCount / total) * 100 : 0 },
            female: { count: femaleCount, percentage: total > 0 ? (femaleCount / total) * 100 : 0 },
            other: { count: otherCount, percentage: total > 0 ? (otherCount / total) * 100 : 0 },
            total,
        };
    }
    async getCategoryDistribution(year) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED },
            include: { employees: true },
        });
        const categories = { cat1_3: 0, cat4_6: 0, cat7_9: 0, cat10_12: 0, nonDeclared: 0 };
        for (const decl of declarations) {
            for (const emp of decl.employees) {
                if (emp.salaryCategory === '1-3')
                    categories.cat1_3++;
                else if (emp.salaryCategory === '4-6')
                    categories.cat4_6++;
                else if (emp.salaryCategory === '7-9')
                    categories.cat7_9++;
                else if (emp.salaryCategory === '10-12')
                    categories.cat10_12++;
                else
                    categories.nonDeclared++;
            }
        }
        const total = Object.values(categories).reduce((a, b) => a + b, 0);
        return {
            categories: {
                '1-3': { count: categories.cat1_3, percentage: total > 0 ? (categories.cat1_3 / total) * 100 : 0 },
                '4-6': { count: categories.cat4_6, percentage: total > 0 ? (categories.cat4_6 / total) * 100 : 0 },
                '7-9': { count: categories.cat7_9, percentage: total > 0 ? (categories.cat7_9 / total) * 100 : 0 },
                '10-12': { count: categories.cat10_12, percentage: total > 0 ? (categories.cat10_12 / total) * 100 : 0 },
                'Non-déclaré': { count: categories.nonDeclared, percentage: total > 0 ? (categories.nonDeclared / total) * 100 : 0 },
            },
            total,
        };
    }
    async getRecruitmentForecast(years = 3, forecastYears = 2) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - years;
        const declarations = await this.prisma.declaration.findMany({
            where: { year: { gte: startYear, lte: currentYear }, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED },
            include: { movements: true },
        });
        const recruitmentsByYear = {};
        for (const decl of declarations) {
            for (const mov of decl.movements) {
                if (mov.movementType === 'RECRUITMENT') {
                    const total = mov.cat1_3 + mov.cat4_6 + mov.cat7_9 + mov.cat10_12 + mov.catNonDeclared;
                    recruitmentsByYear[decl.year] = (recruitmentsByYear[decl.year] || 0) + total;
                }
            }
        }
        const yearsList = Array.from({ length: years }, (_, i) => startYear + i);
        const recruitmentValues = yearsList.map(y => recruitmentsByYear[y] || 0);
        const avgRecruitment = recruitmentValues.reduce((a, b) => a + b, 0) / recruitmentValues.length;
        const forecast = [];
        for (let i = 1; i <= forecastYears; i++) {
            forecast.push({
                year: currentYear + i,
                forecastedRecruitment: Math.round(avgRecruitment),
                confidence: 'Medium',
            });
        }
        return forecast;
    }
    async getUnemploymentRiskRegions(year) {
        const regionalData = await this.getEmploymentByRegion(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declaration: { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED } },
        });
        const recruitmentByRegion = {};
        for (const movement of movements) {
            const decl = await this.prisma.declaration.findUnique({
                where: { id: movement.declarationId },
            });
            if (!decl)
                continue;
            if (movement.movementType === 'RECRUITMENT') {
                const total = movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
                recruitmentByRegion[decl.region] = (recruitmentByRegion[decl.region] || 0) + total;
            }
        }
        const risks = regionalData.map((region) => {
            const recruitments = recruitmentByRegion[region.region] || 0;
            const riskScore = region.totalEmployees > 0 ? recruitments / region.totalEmployees : 0;
            return {
                region: region.region,
                riskScore,
                totalEmployees: region.totalEmployees,
                recruitments,
                riskLevel: recruitments < region.totalEmployees * 0.05 ? 'HIGH' : 'MEDIUM',
            };
        });
        risks.sort((a, b) => a.riskScore - b.riskScore);
        return risks.slice(0, 5);
    }
    async getSectorLaborShortages(year) {
        const sectorData = await this.getSectorDistribution(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declaration: { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED } },
            include: { declaration: { include: { company: true } } },
        });
        const recruitmentBySector = {};
        for (const movement of movements) {
            const decl = movement.declaration;
            if (!decl)
                continue;
            const sector = decl.company.mainActivity;
            if (movement.movementType === 'RECRUITMENT') {
                const total = movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
                recruitmentBySector[sector] = (recruitmentBySector[sector] || 0) + total;
            }
        }
        const shortages = sectorData
            .map((sector) => ({
            sector: sector.sector,
            employees: sector.employees,
            recruitments: recruitmentBySector[sector.sector] || 0,
            shortageIndex: sector.employees > 0
                ? (recruitmentBySector[sector.sector] || 0) / sector.employees * 100
                : 0,
        }))
            .filter(s => s.shortageIndex > 5)
            .sort((a, b) => b.shortageIndex - a.shortageIndex);
        return shortages.slice(0, 5);
    }
    async getCompaniesWithRecruitmentPlans(year, limit = 20) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED },
            include: { company: true, qualitativeQuestions: true },
        });
        const planning = declarations
            .filter((d) => d.qualitativeQuestions?.recruitmentPlansNext)
            .map((d) => ({
            company: d.company.name,
            sector: d.company.mainActivity,
            region: d.region,
            plannedRecruitments: d.qualitativeQuestions.recruitmentPlanCount || 'Not specified',
            hasCamerunisationPlan: d.qualitativeQuestions.camerounisationPlan,
        }))
            .sort((a, b) => b.plannedRecruitments - a.plannedRecruitments)
            .slice(0, limit);
        return planning;
    }
    async getDashboardSummary(year, region) {
        const where = { year, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED };
        if (region)
            where.region = region;
        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { employees: true, movements: true },
        });
        let totalEmployees = 0;
        let totalRecruitments = 0;
        let totalDismissals = 0;
        let totalRetirements = 0;
        let totalPromotions = 0;
        for (const decl of declarations) {
            totalEmployees += decl.employees.length;
            for (const mov of decl.movements) {
                const sum = mov.cat1_3 + mov.cat4_6 + mov.cat7_9 + mov.cat10_12 + mov.catNonDeclared;
                if (mov.movementType === 'RECRUITMENT')
                    totalRecruitments += sum;
                else if (mov.movementType === 'DISMISSAL')
                    totalDismissals += sum;
                else if (mov.movementType === 'RETIREMENT')
                    totalRetirements += sum;
                else if (mov.movementType === 'PROMOTION')
                    totalPromotions += sum;
            }
        }
        const prevYear = year - 1;
        const prevWhere = { year: prevYear, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED };
        if (region)
            prevWhere.region = region;
        const prevDeclarations = await this.prisma.declaration.findMany({
            where: prevWhere,
            include: { employees: true },
        });
        const prevEmployees = prevDeclarations.reduce((sum, d) => sum + d.employees.length, 0);
        const employmentGrowthRate = prevEmployees === 0
            ? 0
            : ((totalEmployees - prevEmployees) / prevEmployees) * 100;
        const gender = await this.getGenderDistribution(year, region);
        const sectors = await this.getSectorDistribution(year, region);
        return {
            year,
            region: region || 'National',
            totalDeclarations: declarations.length,
            totalEmployees,
            employmentGrowthRate: parseFloat(employmentGrowthRate.toFixed(1)),
            genderDistribution: {
                male: gender.male.percentage,
                female: gender.female.percentage,
            },
            topSectors: sectors.slice(0, 5).map(s => ({ sector: s.sector, employees: s.employees })),
            totalRecruitments,
            totalDismissals,
            totalRetirements,
            totalPromotions,
            netChange: totalRecruitments - totalDismissals,
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map