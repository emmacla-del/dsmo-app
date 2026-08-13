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
                // Needed by the frontend's export filter (Région → Département
                // cascade) — cheap to include since a region has at most a few
                // dozen departments.
                departments: {
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
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
        const submissions = await this.fetchApprovedOnefopSubmissions(filters);
        return this.buildOnefopWorkbook(submissions);
    }

    /// A flat CSV + SPSS (.sps) syntax pair of the same approved ONEFOP
    /// submissions used by the Excel export, collapsed into a single table
    /// (one row per submission, all entity types unioned) since SPSS analyses
    /// are done at that unit of observation rather than per-form-type sheets.
    async exportSubmissionsSpss(filters: {
        region?: string;
        department?: string;
        year?: number;
        fromDate?: string;
        toDate?: string;
    }): Promise<{ csv: string; sps: string }> {
        const submissions = await this.fetchApprovedOnefopSubmissions(filters);
        const { columns, rows } = this.buildFlatOnefopTable(submissions);
        const csvFilename = 'onefop_submissions.csv';
        return {
            csv: this.rowsToCsv(columns, rows),
            sps: this.buildSpssSyntax(columns, rows, csvFilename),
        };
    }

    // Only APPROVED submissions are exported: these are the validated records
    // entities have submitted through the ONEFOP questionnaire.
    private async fetchApprovedOnefopSubmissions(filters: {
        region?: string;
        department?: string;
        year?: number;
        fromDate?: string;
        toDate?: string;
    }) {
        const where: any = { status: 'APPROVED' };
        if (filters.region) where.region = filters.region;
        if (filters.department) where.department = filters.department;
        if (filters.year) where.surveyYear = Number(filters.year);
        if (filters.fromDate || filters.toDate) {
            where.createdAt = {};
            if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
            if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
        }

        return this.prisma.onefopSubmission.findMany({
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

    private onefopSheetDefs(): Array<{
        formType: string;
        title: string;
        detailKey: 'enterpriseDetail' | 'cooperativeDetail' | 'ctdDetail' | 'ongDetail';
        columns: Partial<ExcelJS.Column>[];
    }> {
        return [
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
    }

    private async buildOnefopWorkbook(submissions: any[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MINEFOP';
        workbook.created = new Date();

        const sheetDefs = this.onefopSheetDefs();

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

    // Collapses the per-form-type sheets used by the Excel export into one
    // flat table: same submissions, same section 1-4 columns, but every
    // entity type unioned onto a single row shape (blank where a column
    // doesn't apply to that submission's form type). Where a form-type's
    // column key collides with a differently-meaning column already claimed
    // (e.g. ENTREPRISE's self-reported "Raison sociale" vs. the common
    // "Entreprise (fiche)" pulled from the linked Company record), the
    // later one is suffixed with its form type rather than silently merged.
    private buildFlatOnefopTable(submissions: any[]): {
        columns: { key: string; header: string }[];
        rows: Record<string, unknown>[];
    } {
        const sheetDefs = this.onefopSheetDefs();
        const usedKeys = new Set<string>();
        const columns: { key: string; header: string }[] = [];
        const remapByFormType = new Map<string, Map<string, string>>();

        for (const c of this.commonColumns()) {
            usedKeys.add(c.key as string);
            columns.push({ key: c.key as string, header: c.header as string });
        }
        usedKeys.add('formType');
        columns.push({ key: 'formType', header: 'Type de formulaire' });

        for (const def of sheetDefs) {
            const remap = new Map<string, string>();
            for (const c of def.columns) {
                const origKey = c.key as string;
                const collided = usedKeys.has(origKey);
                const finalKey = collided ? `${origKey}_${def.formType.toLowerCase()}` : origKey;
                usedKeys.add(finalKey);
                columns.push({
                    key: finalKey,
                    header: collided ? `${c.header} (${def.title})` : (c.header as string),
                });
                if (collided) remap.set(origKey, finalKey);
            }
            remapByFormType.set(def.formType, remap);
        }

        const pivots = ENUM_PIVOT_CONFIGS.map((cfg) => this.pivotColumnsAndValues(submissions, cfg));
        const indexedPivots = INDEXED_PIVOT_CONFIGS.map((cfg) => this.indexedPivotColumnsAndValues(submissions, cfg));
        for (const p of [...pivots, ...indexedPivots]) {
            for (const c of p.columns) {
                if (usedKeys.has(c.key as string)) continue;
                usedKeys.add(c.key as string);
                columns.push({ key: c.key as string, header: c.header as string });
            }
        }

        const detailKeyByFormType = new Map(sheetDefs.map((d) => [d.formType, d.detailKey]));
        const rows = submissions.map((s) => {
            const detailKey = detailKeyByFormType.get(s.formType);
            const detail = detailKey ? (s[detailKey] ?? {}) : {};
            const remap = remapByFormType.get(s.formType);
            const remappedDetail: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(detail)) {
                remappedDetail[remap?.get(k) ?? k] = v;
            }

            const row: Record<string, unknown> = { ...this.commonRow(s), formType: s.formType, ...remappedDetail };
            for (const p of pivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
            for (const p of indexedPivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
            return row;
        });

        return { columns, rows };
    }

    private csvEscape(value: unknown): string {
        if (value === null || value === undefined) return '';
        const str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
        return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }

    private rowsToCsv(columns: { key: string; header: string }[], rows: Record<string, unknown>[]): string {
        const lines = [columns.map((c) => this.csvEscape(c.header)).join(',')];
        for (const row of rows) {
            lines.push(columns.map((c) => this.csvEscape(row[c.key])).join(','));
        }
        // Leading BOM so SPSS/Excel autodetect UTF-8 and render accented
        // French headers ("Année d'enquête", etc.) correctly on Windows.
        return '﻿' + lines.join('\r\n') + '\r\n';
    }

    private sanitizeSpssVarName(header: string, index: number, used: Set<string>): string {
        const reserved = new Set(['ALL', 'AND', 'BY', 'EQ', 'GE', 'GT', 'LE', 'LT', 'NE', 'NOT', 'OR', 'TO', 'WITH']);
        let base = header
            .normalize('NFD').replace(/\p{Mn}/gu, '')
            .replace(/[^A-Za-z0-9_]/g, '_')
            .replace(/^_+/, '')
            .slice(0, 64);
        if (!base || /^[0-9]/.test(base)) base = `v${index}_${base}`;
        if (reserved.has(base.toUpperCase())) base = `${base}_`;

        let name = base;
        let n = 2;
        while (used.has(name.toUpperCase())) {
            name = `${base}_${n++}`;
        }
        used.add(name.toUpperCase());
        return name;
    }

    private spssQuote(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    // A GET DATA TYPE=TXT syntax block that, run against the sibling CSV in
    // SPSS, produces a fully labeled dataset — the standard way to hand SPSS
    // users a dataset without a binary .sav writer (none exist for Node.js).
    // Column order is positional (FIRSTCASE=2 skips the CSV's own header
    // row), so this only has to agree with rowsToCsv on column order, not
    // on names.
    private buildSpssSyntax(
        columns: { key: string; header: string }[],
        rows: Record<string, unknown>[],
        csvFilename: string,
    ): string {
        const used = new Set<string>();
        const varNames = columns.map((c, i) => this.sanitizeSpssVarName(c.header, i + 1, used));

        const formats = columns.map((c) => {
            const values = rows.map((r) => r[c.key]).filter((v) => v !== null && v !== undefined);
            const allNumeric = values.length > 0 && values.every((v) => typeof v === 'number' && Number.isFinite(v));
            if (allNumeric) {
                const hasDecimals = values.some((v) => !Number.isInteger(v as number));
                return hasDecimals ? 'F10.2' : 'F10.0';
            }
            let maxLen = 8;
            for (const v of values) maxLen = Math.max(maxLen, String(v).length);
            return `A${Math.min(254, maxLen)}`;
        });

        const variableLines = varNames.map((name, i) => `  ${name} ${formats[i]}`).join('\n');
        const labelLines = columns
            .map((c, i) => `  ${varNames[i]} ${this.spssQuote(c.header)}`)
            .join('\n');

        return [
            '* Encoding: UTF-8.',
            '* Généré par DSMO — export SPSS des soumissions ONEFOP.',
            `* Placez ce fichier dans le même dossier que "${csvFilename}", puis exécutez-le`,
            '* entièrement (Exécuter > Tout) dans SPSS pour charger les données étiquetées.',
            '',
            'GET DATA',
            '  /TYPE=TXT',
            `  /FILE=${this.spssQuote(csvFilename)}`,
            "  /ENCODING='UTF8'",
            '  /ARRANGEMENT=DELIMITED',
            '  /FIRSTCASE=2',
            "  /DELIMITERS=','",
            '  /QUALIFIER=\'"\'',
            '  /VARIABLES=',
            variableLines,
            '  /MAP.',
            'CACHE.',
            'EXECUTE.',
            '',
            'VARIABLE LABELS',
            labelLines,
            '  .',
            'EXECUTE.',
            '',
        ].join('\n');
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