// src/data-management/data-management.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

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

    async updateRegion(id: string, data: { name?: string; code?: string; nameEn?: string }) {
        const region = await this.prisma.region.findUnique({ where: { id } });
        if (!region) throw new NotFoundException('Région introuvable.');
        return this.prisma.region.update({ where: { id }, data });
    }

    async deleteRegion(id: string) {
        const region = await this.prisma.region.findUnique({
            where: { id },
            include: { _count: { select: { companies: true, departments: true } } },
        });
        if (!region) throw new NotFoundException('Région introuvable.');
        if (region._count.companies > 0 || region._count.departments > 0) {
            throw new BadRequestException(
                'Impossible de supprimer une région encore liée à des entreprises ou départements.',
            );
        }
        await this.prisma.region.delete({ where: { id } });
        return { success: true };
    }

    async updateSector(id: string, data: { name?: string; code?: string; category?: string; nameEn?: string }) {
        const sector = await this.prisma.sector.findUnique({ where: { id } });
        if (!sector) throw new NotFoundException('Secteur introuvable.');
        return this.prisma.sector.update({ where: { id }, data });
    }

    async deleteSector(id: string) {
        const sector = await this.prisma.sector.findUnique({
            where: { id },
            include: { _count: { select: { companies: true } } },
        });
        if (!sector) throw new NotFoundException('Secteur introuvable.');
        if (sector._count.companies > 0) {
            throw new BadRequestException(
                'Impossible de supprimer un secteur encore lié à des entreprises.',
            );
        }
        await this.prisma.sector.delete({ where: { id } });
        return { success: true };
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

        // ONEFOP submissions — compiled into a real, downloadable Excel workbook.
        // Only APPROVED submissions are exported: these are the validated records
        // entities have submitted through the ONEFOP questionnaire.
        const where: any = { status: 'APPROVED' };
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
                respondent: true,
                enterpriseDetail: true,
                cooperativeDetail: true,
                ctdDetail: true,
                ongDetail: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return this.buildOnefopWorkbook(submissions);
    }

    private commonColumns(): Partial<ExcelJS.Column>[] {
        return [
            { header: 'N° de soumission', key: 'submissionId', width: 24 },
            { header: 'Statut', key: 'status', width: 14 },
            { header: 'Année d\'enquête', key: 'surveyYear', width: 14 },
            { header: 'Trimestre', key: 'quarterCode', width: 12 },
            { header: 'Entreprise (fiche)', key: 'companyName', width: 26 },
            { header: 'N° contribuable', key: 'taxNumber', width: 18 },
            { header: 'ID établissement', key: 'establishmentId', width: 18 },
            { header: 'Région', key: 'region', width: 16 },
            { header: 'Département', key: 'department', width: 18 },
            { header: 'Arrondissement', key: 'subdivision', width: 18 },
            { header: 'Date de soumission', key: 'submissionDate', width: 20 },
            { header: 'Répondant', key: 'respondentName', width: 22 },
            { header: 'Fonction du répondant', key: 'respondentFunction', width: 22 },
            { header: 'Téléphone répondant', key: 'respondentPhone', width: 18 },
        ];
    }

    private commonRow(s: any) {
        return {
            submissionId: s.submissionId,
            status: s.status,
            surveyYear: s.surveyYear,
            quarterCode: s.quarterCode,
            companyName: s.company?.name ?? null,
            taxNumber: s.company?.taxNumber ?? s.taxNumber ?? null,
            establishmentId: s.company?.establishmentId ?? s.establishmentId ?? null,
            region: s.region ?? s.company?.region ?? null,
            department: s.department ?? s.company?.department ?? null,
            subdivision: s.subdivision,
            submissionDate: s.submissionDate,
            respondentName: s.respondent?.respondentName ?? null,
            respondentFunction: s.respondent?.respondentFunction ?? null,
            respondentPhone: s.respondent?.phone1 ?? null,
        };
    }

    private async buildOnefopWorkbook(submissions: any[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MINEFOP';
        workbook.created = new Date();

        const sheetDefs: Array<{
            formType: string;
            title: string;
            detailKey: 'enterpriseDetail' | 'cooperativeDetail' | 'ctdDetail' | 'ongDetail';
            columns: Partial<ExcelJS.Column>[];
        }> = [
            {
                formType: 'ENTREPRISE',
                title: 'Entreprises',
                detailKey: 'enterpriseDetail',
                columns: [
                    { header: 'Raison sociale', key: 'companyName', width: 26 },
                    { header: 'Statut juridique', key: 'legalStatus', width: 18 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Activité principale', key: 'mainActivity', width: 28 },
                    { header: 'Siège social', key: 'headOffice', width: 20 },
                    { header: 'Effectif permanent', key: 'permanentWorkers', width: 16 },
                    { header: 'Postes vacants', key: 'vacancies', width: 14 },
                    { header: 'Taille', key: 'enterpriseSize', width: 12 },
                ],
            },
            {
                formType: 'COOPERATIVE',
                title: 'Coopératives',
                detailKey: 'cooperativeDetail',
                columns: [
                    { header: 'Nom de la coopérative', key: 'cooperativeName', width: 26 },
                    { header: 'Siège social', key: 'headOffice', width: 20 },
                    { header: 'Année de création', key: 'yearCreated', width: 16 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Activité principale', key: 'mainActivity', width: 28 },
                    { header: 'Type de coopérative', key: 'cooperativeType', width: 20 },
                    { header: 'Type (autre)', key: 'cooperativeTypeOther', width: 20 },
                    { header: 'Effectif permanent', key: 'permanentWorkers', width: 16 },
                    { header: 'Postes vacants', key: 'vacancies', width: 14 },
                ],
            },
            {
                formType: 'CTD',
                title: 'CTD',
                detailKey: 'ctdDetail',
                columns: [
                    { header: 'Type de CTD', key: 'ctdType', width: 18 },
                    { header: 'Type de conseil', key: 'councilType', width: 18 },
                    { header: 'Année de création', key: 'yearCreated', width: 16 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Effectif permanent', key: 'permanentWorkers', width: 16 },
                    { header: 'Postes vacants', key: 'vacancies', width: 14 },
                ],
            },
            {
                formType: 'ONG',
                title: 'ONG',
                detailKey: 'ongDetail',
                columns: [
                    { header: 'Nom de l\'ONG', key: 'ongName', width: 26 },
                    { header: 'Siège social', key: 'headOffice', width: 20 },
                    { header: 'Année de création', key: 'yearCreated', width: 16 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Mission principale', key: 'mainMission', width: 28 },
                    { header: 'Effectif permanent', key: 'permanentWorkers', width: 16 },
                    { header: 'Postes vacants', key: 'vacancies', width: 14 },
                ],
            },
        ];

        for (const def of sheetDefs) {
            const rows = submissions.filter((s) => s.formType === def.formType);
            if (rows.length === 0) continue;

            const sheet = workbook.addWorksheet(def.title);
            sheet.columns = [...this.commonColumns(), ...def.columns];
            sheet.getRow(1).font = { bold: true };

            for (const s of rows) {
                const detail = s[def.detailKey] ?? {};
                sheet.addRow({ ...this.commonRow(s), ...detail });
            }
        }

        if (workbook.worksheets.length === 0) {
            workbook.addWorksheet('Soumissions').addRow(['Aucune soumission approuvée trouvée.']);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}