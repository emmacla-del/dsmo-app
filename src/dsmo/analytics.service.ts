import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeclarationStatus } from '../types/prisma.types';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get employment overview by region
     */
    async getEmploymentByRegion(year: number) {
        const declarations = await this.prisma.declaration.findMany({
            where: {
                year,
                status: DeclarationStatus.FINAL_APPROVED,
            },
            include: { employees: true, company: true },
        });

        const byRegion: { [key: string]: any } = {};

        for (const decl of declarations) {
            if (!byRegion[decl.region]) {
                byRegion[decl.region] = {
                    region: decl.region,
                    totalEmployees: 0,
                    maleEmployees: 0,
                    femaleEmployees: 0,
                    companyCount: 0,
                    avgEmployeesPerCompany: 0,
                };
            }

            const employees = decl.employees;
            const males = employees.filter((e: any) => e.gender === 'M').length;
            const females = employees.filter((e: any) => e.gender === 'F').length;

            byRegion[decl.region].totalEmployees += employees.length;
            byRegion[decl.region].maleEmployees += males;
            byRegion[decl.region].femaleEmployees += females;
            byRegion[decl.region].companyCount += 1;
        }

        // Calculate averages
        for (const region in byRegion) {
            const companies = byRegion[region].companyCount;
            if (companies > 0) {
                byRegion[region].avgEmployeesPerCompany = Math.round(byRegion[region].totalEmployees / companies);
            }
        }

        return Object.values(byRegion);
    }

    /**
     * Get employment trends by year
     */
    async getEmploymentTrends(startYear: number, endYear: number) {
        const years: (number | string)[] = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }

        const trends = [];

        for (const year of years) {
            const declarations = await this.prisma.declaration.findMany({
                where: {
                    year: year as number,
                    status: DeclarationStatus.FINAL_APPROVED,
                },
                include: { employees: true },
            });

            let totalEmployees = 0;
            let totalRecruitments = 0;
            let totalDismissals = 0;

            for (const decl of declarations) {
                totalEmployees += decl.employees.length;

                const movements = await this.prisma.declarationMovement.findMany({
                    where: { declarationId: decl.id },
                });

                const recruits = movements.find((m: any) => m.movementType === 'RECRUITMENT');
                const dismisses = movements.find((m: any) => m.movementType === 'DISMISSAL');

                if (recruits) {
                    totalRecruitments += recruits.cat1_3 + recruits.cat4_6 + recruits.cat7_9 + recruits.cat10_12 + recruits.catNonDeclared;
                }
                if (dismisses) {
                    totalDismissals += dismisses.cat1_3 + dismisses.cat4_6 + dismisses.cat7_9 + dismisses.cat10_12 + dismisses.catNonDeclared;
                }
            }

            trends.push({
                year,
                totalEmployees,
                totalRecruitments,
                totalDismissals,
                netChange: totalRecruitments - totalDismissals,
            });
        }

        return trends;
    }

    /**
     * Get sector distribution
     */
    async getSectorDistribution(year: number) {
        const declarations = await this.prisma.declaration.findMany({
            where: {
                year,
                status: DeclarationStatus.FINAL_APPROVED,
            },
            include: { company: true, employees: true },
        });

        const sectors: { [key: string]: any } = {};

        for (const decl of declarations) {
            const sector = decl.company.mainActivity;
            if (!sectors[sector]) {
                sectors[sector] = {
                    sector,
                    employees: 0,
                    companies: 0,
                    avgEmployeesPerCompany: 0,
                };
            }

            sectors[sector].employees += decl.employees.length;
            sectors[sector].companies += 1;
        }

        // Calculate averages and sort by employee count
        for (const sector in sectors) {
            sectors[sector].avgEmployeesPerCompany = Math.round(sectors[sector].employees / sectors[sector].companies);
        }

        return Object.values(sectors).sort((a, b) => b.employees - a.employees);
    }

    /**
     * Get gender distribution
     */
    async getGenderDistribution(year: number, region?: string) {
        const where: any = {
            year,
            status: DeclarationStatus.FINAL_APPROVED,
        };
        if (region) where.region = region;

        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { employees: true },
        });

        let maleCount = 0;
        let femaleCount = 0;
        let otherCount = 0;

        for (const decl of declarations) {
            for (const emp of decl.employees) {
                if (emp.gender === 'M') maleCount++;
                else if (emp.gender === 'F') femaleCount++;
                else otherCount++;
            }
        }

        const total = maleCount + femaleCount + otherCount;

        return {
            male: { count: maleCount, percentage: total > 0 ? ((maleCount / total) * 100).toFixed(2) : 0 },
            female: { count: femaleCount, percentage: total > 0 ? ((femaleCount / total) * 100).toFixed(2) : 0 },
            other: { count: otherCount, percentage: total > 0 ? ((otherCount / total) * 100).toFixed(2) : 0 },
            total,
        };
    }

    /**
     * Get socio-professional category distribution
     */
    async getCategoryDistribution(year: number) {
        const declarations = await this.prisma.declaration.findMany({
            where: {
                year,
                status: DeclarationStatus.FINAL_APPROVED,
            },
            include: { employees: true },
        });

        const categories = {
            cat1_3: 0,
            cat4_6: 0,
            cat7_9: 0,
            cat10_12: 0,
            nonDeclared: 0,
        };

        for (const decl of declarations) {
            for (const emp of decl.employees) {
                if (emp.salaryCategory === '1-3') categories.cat1_3++;
                else if (emp.salaryCategory === '4-6') categories.cat4_6++;
                else if (emp.salaryCategory === '7-9') categories.cat7_9++;
                else if (emp.salaryCategory === '10-12') categories.cat10_12++;
                else categories.nonDeclared++;
            }
        }

        const total = Object.values(categories).reduce((a, b) => a + b, 0);

        return {
            categories: {
                '1-3': { count: categories.cat1_3, percentage: total > 0 ? ((categories.cat1_3 / total) * 100).toFixed(2) : 0 },
                '4-6': { count: categories.cat4_6, percentage: total > 0 ? ((categories.cat4_6 / total) * 100).toFixed(2) : 0 },
                '7-9': { count: categories.cat7_9, percentage: total > 0 ? ((categories.cat7_9 / total) * 100).toFixed(2) : 0 },
                '10-12': { count: categories.cat10_12, percentage: total > 0 ? ((categories.cat10_12 / total) * 100).toFixed(2) : 0 },
                'Non-déclaré': { count: categories.nonDeclared, percentage: total > 0 ? ((categories.nonDeclared / total) * 100).toFixed(2) : 0 },
            },
            total,
        };
    }

    /**
     * Get recruitment forecast using simple moving average
     */
    async getRecruitmentForecast(years: number = 3, forecastYears: number = 2) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - years;

        const historicalData = await this.getEmploymentTrends(startYear, currentYear);

        const forecast = [];

        if (historicalData.length > 0) {
            const recruitments = historicalData.map((d) => d.totalRecruitments);
            const avgRecruitment = recruitments.reduce((a, b) => a + b, 0) / recruitments.length;

            for (let i = 1; i <= forecastYears; i++) {
                forecast.push({
                    year: currentYear + i,
                    forecastedRecruitment: Math.round(avgRecruitment),
                    confidence: 'Medium',
                });
            }
        }

        return forecast;
    }

    /**
     * Get regions with highest unemployment risk (low recruitment)
     */
    async getUnemploymentRiskRegions(year: number) {
        const regionalData = await this.getEmploymentByRegion(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: {
                declaration: {
                    year,
                    status: DeclarationStatus.FINAL_APPROVED,
                },
            },
        });

        // Get recruitment by region
        const recruitmentByRegion: { [key: string]: number } = {};

        for (const movement of movements) {
            const decl = await this.prisma.declaration.findUnique({
                where: { id: movement.declarationId },
            });
            if (!decl) continue;

            if (movement.movementType === 'RECRUITMENT') {
                if (!recruitmentByRegion[decl.region]) {
                    recruitmentByRegion[decl.region] = 0;
                }
                recruitmentByRegion[decl.region] +=
                    movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
            }
        }

        // Calculate risk (regions with low recruitment relative to workforce)
        const risks = regionalData
            .map((region) => ({
                region: region.region,
                riskScore: region.totalEmployees > 0 ? (recruitmentByRegion[region.region] || 0) / region.totalEmployees : 0,
                totalEmployees: region.totalEmployees,
                recruitments: recruitmentByRegion[region.region] || 0,
                riskLevel: (recruitmentByRegion[region.region] || 0) < region.totalEmployees * 0.05 ? 'HIGH' : 'MEDIUM',
            }))
            .sort((a, b) => a.riskScore - b.riskScore);

        return risks.slice(0, 5); // Top 5 high-risk regions
    }

    /**
     * Get sectors with labor shortages (high recruitment relative to workforce)
     */
    async getSectorLaborShortages(year: number) {
        const sectorData = await this.getSectorDistribution(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: {
                declaration: {
                    year,
                    status: DeclarationStatus.FINAL_APPROVED,
                },
            },
        });

        // Get recruitment by sector
        const recruitmentBySector: { [key: string]: number } = {};

        for (const movement of movements) {
            const decl = await this.prisma.declaration.findUnique({
                where: { id: movement.declarationId },
                include: { company: true },
            });
            if (!decl) continue;

            const sector = decl.company.mainActivity;
            if (movement.movementType === 'RECRUITMENT') {
                if (!recruitmentBySector[sector]) {
                    recruitmentBySector[sector] = 0;
                }
                recruitmentBySector[sector] +=
                    movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
            }
        }

        // Calculate shortage (sectors with high recruitment relative to workforce)
        const shortages = sectorData
            .map((sector) => ({
                sector: sector.sector,
                employees: sector.employees,
                recruitments: recruitmentBySector[sector.sector] || 0,
                shortageIndex: sector.employees > 0 ? ((recruitmentBySector[sector.sector] || 0) / sector.employees) * 100 : 0,
            }))
            .filter((s) => s.shortageIndex > 5) // Only sectors with >5% recruitment rate
            .sort((a, b) => b.shortageIndex - a.shortageIndex);

        return shortages.slice(0, 5); // Top 5 sectors with shortages
    }

    /**
     * Get companies planning recruitment
     */
    async getCompaniesWithRecruitmentPlans(year: number, limit: number = 20) {
        const declarations = await this.prisma.declaration.findMany({
            where: {
                year,
                status: DeclarationStatus.FINAL_APPROVED,
            },
            include: {
                company: true,
                qualitativeQuestions: true,
            },
        });

        const planningCompanies = declarations
            .filter((d: any) => d.qualitativeQuestions && d.qualitativeQuestions.recruitmentPlansNext)
            .map((d: any) => ({
                company: d.company.name,
                sector: d.company.mainActivity,
                region: d.region,
                plannedRecruitments: d.qualitativeQuestions.recruitmentPlanCount || 'Not specified',
                hasCamerunisationPlan: d.qualitativeQuestions.camerounisationPlan,
            }))
            .sort((a: any, b: any) => (b.plannedRecruitments as any) - (a.plannedRecruitments as any))
            .slice(0, limit);

        return planningCompanies;
    }

    /**
     * Get dashboard summary
     */
    async getDashboardSummary(year: number, region?: string) {
        const where: any = {
            year,
            status: DeclarationStatus.FINAL_APPROVED,
        };
        if (region) where.region = region;

        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { employees: true, movements: true },
        });

        let totalEmployees = 0;
        let totalRecruitments = 0;
        let totalDismissals = 0;

        for (const decl of declarations) {
            totalEmployees += decl.employees.length;

            for (const movement of decl.movements) {
                const movTotal = movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
                if (movement.movementType === 'RECRUITMENT') totalRecruitments += movTotal;
                if (movement.movementType === 'DISMISSAL') totalDismissals += movTotal;
            }
        }

        const previousYear = year - 1;
        const previousDeclarations = await this.prisma.declaration.findMany({
            where: {
                year: previousYear,
                status: DeclarationStatus.FINAL_APPROVED,
                ...(region ? { region } : {}),
            },
            include: { employees: true },
        });

        const previousEmployees = previousDeclarations.reduce((sum: any, d: any) => sum + d.employees.length, 0);
        const employmentGrowthRate = previousEmployees > 0 ? ((totalEmployees - previousEmployees) / previousEmployees * 100).toFixed(2) : 'N/A';

        const gender = await this.getGenderDistribution(year, region);
        const sectors = await this.getSectorDistribution(year);

        return {
            year,
            region: region || 'National',
            totalDeclarations: declarations.length,
            totalEmployees,
            employmentGrowthRate,
            genderDistribution: {
                male: gender.male.percentage,
                female: gender.female.percentage,
            },
            topSectors: sectors.slice(0, 5).map((s) => ({ sector: s.sector, employees: s.employees })),
            totalRecruitments,
            totalDismissals,
            netChange: totalRecruitments - totalDismissals,
        };
    }
}
