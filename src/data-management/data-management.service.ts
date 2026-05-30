// src/data-management/data-management.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataManagementService {
    constructor(private prisma: PrismaService) { }

    async getRegions() {
        return this.prisma.region.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { companies: true, departments: true },
                },
            },
        });
    }

    async getSectors() {
        return this.prisma.sector.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { companies: true },
                },
            },
        });
    }

    async getDataStats() {
        const [
            totalCompanies,
            totalDeclarations,
            totalOnefopSubmissions,
            totalUsers,
            declarationsByStatus,
            onefopByStatus,
            companiesByRegion,
        ] = await Promise.all([
            this.prisma.company.count(),
            this.prisma.declaration.count(),
            this.prisma.onefopSubmission.count(),
            this.prisma.user.count(),

            this.prisma.declaration.groupBy({
                by: ['status'],
                _count: true,
            }),

            this.prisma.onefopSubmission.groupBy({
                by: ['status'],
                _count: true,
            }),

            this.prisma.company.groupBy({
                by: ['region'],
                _count: true,
                orderBy: { _count: { region: 'desc' } },
            }),
        ]);

        return {
            totals: {
                companies: totalCompanies,
                declarations: totalDeclarations,
                onefopSubmissions: totalOnefopSubmissions,
                users: totalUsers,
            },
            declarationsByStatus: declarationsByStatus.reduce(
                (acc, s) => ({ ...acc, [s.status]: s._count }),
                {} as Record<string, number>,
            ),
            onefopByStatus: onefopByStatus.reduce(
                (acc, s) => ({ ...acc, [s.status]: s._count }),
                {} as Record<string, number>,
            ),
            companiesByRegion: companiesByRegion.map(r => ({
                region: r.region,
                count: r._count,
            })),
            generatedAt: new Date(),
        };
    }

    async exportSubmissions(filters: {
        type?: 'DECLARATION' | 'ONEFOP';
        status?: string;
        region?: string;
        department?: string;
        year?: number;
        fromDate?: string;
        toDate?: string;
    }) {
        const type = filters.type ?? 'ONEFOP';

        if (type === 'DECLARATION') {
            const where: any = {};
            if (filters.status) where.status = filters.status;
            if (filters.region) where.region = filters.region;
            if (filters.department) where.division = filters.department;
            if (filters.year) where.year = Number(filters.year);
            if (filters.fromDate || filters.toDate) {
                where.createdAt = {};
                if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
                if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
            }

            const declarations = await this.prisma.declaration.findMany({
                where,
                include: {
                    company: {
                        select: {
                            name: true,
                            taxNumber: true,
                            region: true,
                            department: true,
                            establishmentId: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return {
                type: 'DECLARATION',
                count: declarations.length,
                filters,
                exportedAt: new Date(),
                data: declarations,
            };
        }

        // ONEFOP submissions
        const where: any = {};
        if (filters.status) where.status = filters.status;
        if (filters.region) where.region = filters.region;
        if (filters.department) where.department = filters.department;
        if (filters.year) where.surveyYear = Number(filters.year);
        if (filters.fromDate || filters.toDate) {
            where.createdAt = {};
            if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
            if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
        }

        const submissions = await this.prisma.onefopSubmission.findMany({
            where,
            include: {
                company: {
                    select: {
                        name: true,
                        taxNumber: true,
                        region: true,
                        department: true,
                        establishmentId: true,
                    },
                },
                enterpriseDetail: {
                    select: { mainActivity: true, sector: true, permanentWorkers: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            type: 'ONEFOP',
            count: submissions.length,
            filters,
            exportedAt: new Date(),
            data: submissions,
        };
    }
}