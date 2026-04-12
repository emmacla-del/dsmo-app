import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeclarationStatus } from '../types/prisma.types';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) { }

    // ===== EMPLOYMENT BY REGION =====
    async getEmploymentByRegion(year: number) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: DeclarationStatus.FINAL_APPROVED },
            include: { employees: true, company: true },
        });

        const byRegion: Record<string, any> = {};
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
            const males = decl.employees.filter((e: any) => e.gender === 'M').length;
            const females = decl.employees.filter((e: any) => e.gender === 'F').length;
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

    // ===== EMPLOYMENT TRENDS (supports region) =====
    async getEmploymentTrends(
        startYear: number,
        endYear: number,
        region?: string,
    ): Promise<{ year: number; totalEmployees: number }[]> {
        const trends = [];
        for (let year = startYear; year <= endYear; year++) {
            const where: any = { year, status: DeclarationStatus.FINAL_APPROVED };
            if (region) where.region = region;
            const declarations = await this.prisma.declaration.findMany({
                where,
                include: { employees: true },
            });
            const totalEmployees = declarations.reduce((sum, d) => sum + d.employees.length, 0);
            trends.push({ year, totalEmployees });
        }
        return trends;
    }

    // ===== SECTOR DISTRIBUTION (supports region, returns male/female) =====
    async getSectorDistribution(
        year: number,
        region?: string,
    ): Promise<{ sector: string; employees: number; male: number; female: number }[]> {
        const where: any = { year, status: DeclarationStatus.FINAL_APPROVED };
        if (region) where.region = region;

        const declarations = await this.prisma.declaration.findMany({
            where,
            include: {
                company: true,
                employees: true,
            },
        });

        const sectorsMap: Record<string, { employees: number; male: number; female: number }> = {};

        for (const decl of declarations) {
            const sector = decl.company.mainActivity;
            if (!sectorsMap[sector]) {
                sectorsMap[sector] = { employees: 0, male: 0, female: 0 };
            }
            const males = decl.employees.filter((e: any) => e.gender === 'M').length;
            const females = decl.employees.filter((e: any) => e.gender === 'F').length;
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

    // ===== GENDER DISTRIBUTION (supports region) =====
    async getGenderDistribution(year: number, region?: string) {
        const where: any = { year, status: DeclarationStatus.FINAL_APPROVED };
        if (region) where.region = region;

        const declarations = await this.prisma.declaration.findMany({
            where,
            include: { employees: true },
        });

        let maleCount = 0, femaleCount = 0, otherCount = 0;
        for (const decl of declarations) {
            for (const emp of decl.employees) {
                if (emp.gender === 'M') maleCount++;
                else if (emp.gender === 'F') femaleCount++;
                else otherCount++;
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

    // ===== CATEGORY DISTRIBUTION =====
    async getCategoryDistribution(year: number) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: DeclarationStatus.FINAL_APPROVED },
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
                '1-3': { count: categories.cat1_3, percentage: total > 0 ? (categories.cat1_3 / total) * 100 : 0 },
                '4-6': { count: categories.cat4_6, percentage: total > 0 ? (categories.cat4_6 / total) * 100 : 0 },
                '7-9': { count: categories.cat7_9, percentage: total > 0 ? (categories.cat7_9 / total) * 100 : 0 },
                '10-12': { count: categories.cat10_12, percentage: total > 0 ? (categories.cat10_12 / total) * 100 : 0 },
                'Non-déclaré': { count: categories.nonDeclared, percentage: total > 0 ? (categories.nonDeclared / total) * 100 : 0 },
            },
            total,
        };
    }

    // ===== RECRUITMENT FORECAST (simple moving average) =====
    async getRecruitmentForecast(years: number = 3, forecastYears: number = 2) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - years;

        // Use the employment trends method (which returns totalRecruitments? No, it returns totalEmployees. We need recruitment data.
        // Better to fetch directly:
        const declarations = await this.prisma.declaration.findMany({
            where: { year: { gte: startYear, lte: currentYear }, status: DeclarationStatus.FINAL_APPROVED },
            include: { movements: true },
        });

        const recruitmentsByYear: Record<number, number> = {};
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

    // ===== UNEMPLOYMENT RISK REGIONS =====
    async getUnemploymentRiskRegions(year: number) {
        const regionalData = await this.getEmploymentByRegion(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declaration: { year, status: DeclarationStatus.FINAL_APPROVED } },
        });

        const recruitmentByRegion: Record<string, number> = {};
        for (const movement of movements) {
            const decl = await this.prisma.declaration.findUnique({
                where: { id: movement.declarationId },
            });
            if (!decl) continue;
            if (movement.movementType === 'RECRUITMENT') {
                const total = movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
                recruitmentByRegion[decl.region] = (recruitmentByRegion[decl.region] || 0) + total;
            }
        }

        const risks = regionalData.map((region: any) => {
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

    // ===== SECTOR LABOR SHORTAGES =====
    async getSectorLaborShortages(year: number) {
        const sectorData = await this.getSectorDistribution(year);
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declaration: { year, status: DeclarationStatus.FINAL_APPROVED } },
            include: { declaration: { include: { company: true } } },
        });

        const recruitmentBySector: Record<string, number> = {};
        for (const movement of movements) {
            const decl = movement.declaration;
            if (!decl) continue;
            const sector = decl.company.mainActivity;
            if (movement.movementType === 'RECRUITMENT') {
                const total = movement.cat1_3 + movement.cat4_6 + movement.cat7_9 + movement.cat10_12 + movement.catNonDeclared;
                recruitmentBySector[sector] = (recruitmentBySector[sector] || 0) + total;
            }
        }

        const shortages = sectorData
            .map((sector: any) => ({
                sector: sector.sector,
                employees: sector.employees,
                recruitments: recruitmentBySector[sector.sector] || 0,
                shortageIndex: sector.employees > 0 ? (recruitmentBySector[sector.sector] || 0) / sector.employees * 100 : 0,
            }))
            .filter(s => s.shortageIndex > 5)
            .sort((a, b) => b.shortageIndex - a.shortageIndex);

        return shortages.slice(0, 5);
    }

    // ===== COMPANIES WITH RECRUITMENT PLANS =====
    async getCompaniesWithRecruitmentPlans(year: number, limit: number = 20) {
        const declarations = await this.prisma.declaration.findMany({
            where: { year, status: DeclarationStatus.FINAL_APPROVED },
            include: { company: true, qualitativeQuestions: true },
        });

        const planning = declarations
            .filter((d: any) => d.qualitativeQuestions?.recruitmentPlansNext)
            .map((d: any) => ({
                company: d.company.name,
                sector: d.company.mainActivity,
                region: d.region,
                plannedRecruitments: d.qualitativeQuestions.recruitmentPlanCount || 'Not specified',
                hasCamerunisationPlan: d.qualitativeQuestions.camerounisationPlan,
            }))
            .sort((a: any, b: any) => (b.plannedRecruitments as any) - (a.plannedRecruitments as any))
            .slice(0, limit);

        return planning;
    }

    // ===== DASHBOARD SUMMARY (enhanced for Flutter dashboard) =====
    async getDashboardSummary(year: number, region?: string) {
        const where: any = { year, status: DeclarationStatus.FINAL_APPROVED };
        if (region) where.region = region;

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
                if (mov.movementType === 'RECRUITMENT') totalRecruitments += sum;
                else if (mov.movementType === 'DISMISSAL') totalDismissals += sum;
                else if (mov.movementType === 'RETIREMENT') totalRetirements += sum;
                else if (mov.movementType === 'PROMOTION') totalPromotions += sum;
            }
        }

        const prevYear = year - 1;
        const prevWhere: any = { year: prevYear, status: DeclarationStatus.FINAL_APPROVED };
        if (region) prevWhere.region = region;
        const prevDeclarations = await this.prisma.declaration.findMany({
            where: prevWhere,
            include: { employees: true },
        });
        const prevEmployees = prevDeclarations.reduce((sum, d) => sum + d.employees.length, 0);
        const employmentGrowthRate = prevEmployees === 0 ? 0 : ((totalEmployees - prevEmployees) / prevEmployees) * 100;

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
}