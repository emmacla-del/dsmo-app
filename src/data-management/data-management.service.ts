// src/data-management/data-management.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

// ── Pivot configs for the ONEFOP export ─────────────────────────────────────
// These 10 breakdown tables have a small, fixed set of categories (CSP ×
// gender × age-band, etc.), so each distinct combination becomes its own
// column on the entity's row instead of a separate long-format sheet.
interface EnumPivotConfig {
    relationKey: string;
    keyBuilder: (item: any) => string;
    headerBuilder: (item: any) => string;
    valueField: string;
}

const ENUM_PIVOT_CONFIGS: EnumPivotConfig[] = [
    {
        relationKey: 'cspGenderAge', valueField: 'value',
        keyBuilder: (i) => `csp_${i.tableName}_${i.cspCategory}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => `CSP ${i.tableName} ${i.cspCategory} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
    },
    {
        relationKey: 'diplomaData', valueField: 'value',
        keyBuilder: (i) => `dipl_${i.diploma}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => `Diplôme ${i.diploma} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
    },
    {
        relationKey: 'disabilityData', valueField: 'value',
        keyBuilder: (i) => `handi_${i.cspCategory}_${i.status}_${i.gender}`,
        headerBuilder: (i) => `Handicap ${i.cspCategory} ${i.status} ${i.gender}`,
    },
    {
        relationKey: 'vulnerableData', valueField: 'value',
        keyBuilder: (i) => `vuln_${i.vulnerableType}_${i.status}_${i.gender}`,
        headerBuilder: (i) => `Vulnérable ${i.vulnerableType} ${i.status} ${i.gender}`,
    },
    {
        relationKey: 'firstTimeWorkers', valueField: 'value',
        keyBuilder: (i) => `pe_${i.contractType}_${i.cspCategory}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => `1er emploi ${i.contractType} ${i.cspCategory} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
    },
    {
        relationKey: 'jobApplicationData', valueField: 'value',
        keyBuilder: (i) => `cand_${i.cspCategory}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => `Candidature ${i.cspCategory} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
    },
    {
        relationKey: 'registeredSeekers', valueField: 'value',
        keyBuilder: (i) => `dem_${i.contractType}_${i.cspCategory}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => `Demandeur ${i.contractType} ${i.cspCategory} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
    },
    {
        relationKey: 'departureData', valueField: 'value',
        keyBuilder: (i) => `dep_${i.cspCategory}_${i.departureType}_${i.gender}`,
        headerBuilder: (i) => `Départ ${i.cspCategory} ${i.departureType} ${i.gender}`,
    },
    {
        relationKey: 'dismissalUnemployment', valueField: 'value',
        keyBuilder: (i) => `lic_${i.cspCategory}_${i.type}_${i.gender}`,
        headerBuilder: (i) => `Licenciement/Chômage ${i.cspCategory} ${i.type} ${i.gender}`,
    },
    {
        relationKey: 'internshipData', valueField: 'value',
        keyBuilder: (i) => `stage_${i.internshipType}_${i.gender}`,
        headerBuilder: (i) => `Stage ${i.internshipType} ${i.gender}`,
    },
];

// These 3 tables are indexed lists (a fixed small number of numbered slots,
// each with a free-text description + male/female/total counts) — pivoted
// by slot number rather than by the free text itself.
interface IndexedPivotConfig {
    relationKey: string;
    indexField: string;
    textField: string;
    prefix: string;
}

const INDEXED_PIVOT_CONFIGS: IndexedPivotConfig[] = [
    { relationKey: 'dismissalReasons', indexField: 'reasonIndex', textField: 'reasonText', prefix: 'Motif' },
    { relationKey: 'skillNeeds', indexField: 'skillIndex', textField: 'skillDescription', prefix: 'Compétence' },
    { relationKey: 'trainingNeeds', indexField: 'domainIndex', textField: 'trainingDomain', prefix: 'Formation' },
];

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
                cspGenderAge: true,
                diplomaData: true,
                disabilityData: true,
                vulnerableData: true,
                firstTimeWorkers: true,
                jobApplicationData: true,
                registeredSeekers: true,
                departureData: true,
                dismissalReasons: true,
                dismissalUnemployment: true,
                internshipData: true,
                skillNeeds: true,
                trainingNeeds: true,
                factRecruitments: true,
                factSkillNeeds: true,
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

            const pivots = ENUM_PIVOT_CONFIGS.map((cfg) => this.pivotColumnsAndValues(rows, cfg));
            const indexedPivots = INDEXED_PIVOT_CONFIGS.map((cfg) => this.indexedPivotColumnsAndValues(rows, cfg));

            const sheet = workbook.addWorksheet(def.title);
            sheet.columns = [
                ...this.commonColumns(),
                ...def.columns,
                ...pivots.flatMap((p) => p.columns),
                ...indexedPivots.flatMap((p) => p.columns),
            ];
            sheet.getRow(1).font = { bold: true };

            for (const s of rows) {
                const detail = s[def.detailKey] ?? {};
                const row: Record<string, unknown> = { ...this.commonRow(s), ...detail };
                for (const p of pivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                for (const p of indexedPivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                sheet.addRow(row);
            }
        }

        // Tidy/long-format versions of the same 13 breakdown tables, kept
        // alongside the flattened per-entity sheets above. The flattened
        // sheets are for browsing one entity's full submission; these are
        // for actual analysis (PivotTables, SUMIFS, or loading straight
        // into Python/R/Stata) — one row per submission × category, a
        // single "Valeur" column, nothing to unpivot first.
        this.addBreakdownSheet(workbook, 'Effectifs CSP-Genre-Âge',
            [{ header: 'Tableau', key: 'tableName', width: 20 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'cspGenderAge',
            (item) => ({ tableName: item.tableName, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }));

        this.addBreakdownSheet(workbook, 'Diplômes',
            [{ header: 'Diplôme', key: 'diploma', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'diplomaData',
            (item) => ({ diploma: item.diploma, gender: item.gender, ageBand: item.ageBand, value: item.value }));

        this.addBreakdownSheet(workbook, 'Situations de handicap',
            [{ header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Statut', key: 'status', width: 12 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'disabilityData',
            (item) => ({ cspCategory: item.cspCategory, status: item.status, gender: item.gender, value: item.value }));

        this.addBreakdownSheet(workbook, 'Personnes vulnérables',
            [{ header: 'Catégorie vulnérable', key: 'vulnerableType', width: 20 },
            { header: 'Statut', key: 'status', width: 12 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'vulnerableData',
            (item) => ({ vulnerableType: item.vulnerableType, status: item.status, gender: item.gender, value: item.value }));

        this.addBreakdownSheet(workbook, 'Premiers emplois',
            [{ header: 'Type de contrat', key: 'contractType', width: 16 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'firstTimeWorkers',
            (item) => ({ contractType: item.contractType, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }));

        this.addBreakdownSheet(workbook, 'Candidatures reçues',
            [{ header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'jobApplicationData',
            (item) => ({ cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }));

        this.addBreakdownSheet(workbook, 'Demandeurs enregistrés',
            [{ header: 'Type de contrat', key: 'contractType', width: 16 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'registeredSeekers',
            (item) => ({ contractType: item.contractType, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }));

        this.addBreakdownSheet(workbook, 'Départs',
            [{ header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Type de départ', key: 'departureType', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'departureData',
            (item) => ({ cspCategory: item.cspCategory, departureType: item.departureType, gender: item.gender, value: item.value }));

        this.addBreakdownSheet(workbook, 'Motifs de licenciement',
            [{ header: 'N°', key: 'reasonIndex', width: 8 },
            { header: 'Motif', key: 'reasonText', width: 30 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 }],
            submissions, 'dismissalReasons',
            (item) => ({ reasonIndex: item.reasonIndex, reasonText: item.reasonText, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }));

        this.addBreakdownSheet(workbook, 'Licenciement-Chômage technique',
            [{ header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Type', key: 'type', width: 20 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'dismissalUnemployment',
            (item) => ({ cspCategory: item.cspCategory, type: item.type, gender: item.gender, value: item.value }));

        this.addBreakdownSheet(workbook, 'Stages',
            [{ header: 'Type de stage', key: 'internshipType', width: 18 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 }],
            submissions, 'internshipData',
            (item) => ({ internshipType: item.internshipType, gender: item.gender, value: item.value }));

        this.addBreakdownSheet(workbook, 'Besoins en compétences',
            [{ header: 'N°', key: 'skillIndex', width: 8 },
            { header: 'Compétence', key: 'skillDescription', width: 32 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 }],
            submissions, 'skillNeeds',
            (item) => ({ skillIndex: item.skillIndex, skillDescription: item.skillDescription, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }));

        this.addBreakdownSheet(workbook, 'Besoins en formation',
            [{ header: 'N°', key: 'domainIndex', width: 8 },
            { header: 'Domaine', key: 'trainingDomain', width: 32 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 }],
            submissions, 'trainingNeeds',
            (item) => ({ domainIndex: item.domainIndex, trainingDomain: item.trainingDomain, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }));

        // The two free-text "fact" tables don't reduce to a fixed set of
        // columns (no bounded index, freeform descriptions), so they've
        // always been their own long-format sheets.
        this.addBreakdownSheet(workbook, 'Recrutements (détail)',
            [{ header: 'Année', key: 'year', width: 10 },
            { header: 'CSP', key: 'csp', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageGroup', width: 14 },
            { header: 'Nombre', key: 'count', width: 10 },
            { header: 'Type de recrutement', key: 'recruitmentType', width: 20 }],
            submissions, 'factRecruitments',
            (item) => ({ year: item.year, csp: item.csp, gender: item.gender, ageGroup: item.ageGroup, count: item.count, recruitmentType: item.recruitmentType }));

        this.addBreakdownSheet(workbook, 'Besoins compétences (détail)',
            [{ header: 'Année', key: 'year', width: 10 },
            { header: 'Compétence', key: 'skillDescription', width: 32 },
            { header: 'Nombre', key: 'count', width: 10 }],
            submissions, 'factSkillNeeds',
            (item) => ({ year: item.year, skillDescription: item.skillDescription, count: item.count }));

        if (workbook.worksheets.length === 0) {
            workbook.addWorksheet('Soumissions').addRow(['Aucune soumission approuvée trouvée.']);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private identityColumns(): Partial<ExcelJS.Column>[] {
        return [
            { header: 'N° de soumission', key: 'submissionId', width: 24 },
            { header: 'Entreprise', key: 'entreprise', width: 26 },
            { header: "Type d'entité", key: 'typeEntite', width: 14 },
            { header: 'Région', key: 'region', width: 14 },
        ];
    }

    private identityFields(s: any) {
        return {
            submissionId: s.submissionId,
            entreprise: s.company?.name ?? null,
            typeEntite: s.formType,
            region: s.region,
        };
    }

    private pivotColumnsAndValues(
        rows: any[],
        cfg: EnumPivotConfig,
    ): { columns: Partial<ExcelJS.Column>[]; valuesBySubmission: Map<string, Record<string, unknown>> } {
        const headerByKey = new Map<string, string>();
        const valuesBySubmission = new Map<string, Record<string, unknown>>();

        for (const s of rows) {
            const items = s[cfg.relationKey] as any[] | undefined;
            if (!items || items.length === 0) continue;
            const bucket: Record<string, unknown> = {};
            for (const item of items) {
                const key = cfg.keyBuilder(item);
                if (!headerByKey.has(key)) headerByKey.set(key, cfg.headerBuilder(item));
                bucket[key] = item[cfg.valueField] ?? 0;
            }
            valuesBySubmission.set(s.id, bucket);
        }

        const columns: Partial<ExcelJS.Column>[] = Array.from(headerByKey.entries()).map(
            ([key, header]) => ({ header, key, width: 14 }),
        );
        return { columns, valuesBySubmission };
    }

    private indexedPivotColumnsAndValues(
        rows: any[],
        cfg: IndexedPivotConfig,
    ): { columns: Partial<ExcelJS.Column>[]; valuesBySubmission: Map<string, Record<string, unknown>> } {
        const indices = new Set<number>();
        const valuesBySubmission = new Map<string, Record<string, unknown>>();

        for (const s of rows) {
            const items = s[cfg.relationKey] as any[] | undefined;
            if (!items || items.length === 0) continue;
            const bucket: Record<string, unknown> = {};
            for (const item of items) {
                const idx = item[cfg.indexField];
                indices.add(idx);
                bucket[`${cfg.relationKey}_${idx}_desc`] = item[cfg.textField];
                bucket[`${cfg.relationKey}_${idx}_h`] = item.maleCount;
                bucket[`${cfg.relationKey}_${idx}_f`] = item.femaleCount;
                bucket[`${cfg.relationKey}_${idx}_t`] = item.totalCount;
            }
            valuesBySubmission.set(s.id, bucket);
        }

        const columns: Partial<ExcelJS.Column>[] = [];
        for (const idx of Array.from(indices).sort((a, b) => a - b)) {
            columns.push(
                { header: `${cfg.prefix} ${idx} - Description`, key: `${cfg.relationKey}_${idx}_desc`, width: 28 },
                { header: `${cfg.prefix} ${idx} - Hommes`, key: `${cfg.relationKey}_${idx}_h`, width: 10 },
                { header: `${cfg.prefix} ${idx} - Femmes`, key: `${cfg.relationKey}_${idx}_f`, width: 10 },
                { header: `${cfg.prefix} ${idx} - Total`, key: `${cfg.relationKey}_${idx}_t`, width: 10 },
            );
        }
        return { columns, valuesBySubmission };
    }

    private addBreakdownSheet(
        workbook: ExcelJS.Workbook,
        title: string,
        columns: Partial<ExcelJS.Column>[],
        submissions: any[],
        relationKey: string,
        rowMapper: (item: any) => Record<string, unknown>,
    ): void {
        const rows: Record<string, unknown>[] = [];
        for (const s of submissions) {
            const items = s[relationKey] as any[] | undefined;
            if (!items || items.length === 0) continue;
            for (const item of items) {
                rows.push({ ...this.identityFields(s), ...rowMapper(item) });
            }
        }
        if (rows.length === 0) return;

        const sheet = workbook.addWorksheet(title);
        sheet.columns = [...this.identityColumns(), ...columns];
        sheet.getRow(1).font = { bold: true };
        for (const row of rows) sheet.addRow(row);
    }
}