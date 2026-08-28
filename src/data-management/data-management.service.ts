// src/data-management/data-management.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
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

// ── Streaming SPSS export support ───────────────────────────────────────
//
// The SPSS export used to do one unbounded findMany across all ~19
// relations for every approved submission — the ONEFOP Excel export
// (streamOnefopSubmissionsExcel, further below) used to have the exact same
// problem and has since been rewritten the same way, just sheet-by-sheet
// instead of one CSV pass (see its own doc comment for why). Rebuilt below
// as two cheap passes instead of one unbounded one:
//
//   Pass A (discoverPivotColumns) — the column *list* for the pivoted
//   tables. Every one of them is keyed by a small, fixed enum/index space
//   (CSP × gender × age-band, etc.) — the number of *possible* columns is
//   bounded by that enum space, not by how many submissions exist. A
//   `distinct` query per relation returns at most that bounded set
//   regardless of whether it's backing 50 submissions or 50,000.
//
//   Pass B (streamApprovedOnefopSubmissionsCsv) — the data itself, fetched
//   in fixed-size batches via keyset pagination (ordered + cursored on
//   `id`, which the primary key already indexes) and written straight to
//   the HTTP response as each batch is transformed, instead of being
//   accumulated into one in-memory array/string first. Peak memory is
//   bounded by one batch, not by the total export size, and bytes start
//   reaching the client immediately rather than only once the whole export
//   has finished computing — which also keeps a client-side receive
///  timeout from firing during the long stretch of otherwise-silent work.
//
// This only works because the column *list* has to be fully known before
// the first data row is written (CSV columns are positional) — hence two
// passes rather than discovering columns lazily while streaming rows, the
// way the old buildFlatOnefopTable did.
//
// Kept as separate maps rather than folded into ENUM_PIVOT_CONFIGS/
// INDEXED_PIVOT_CONFIGS above (which the still-unchanged Excel export also
// reads) so this doesn't risk changing Excel export behavior.
const ENUM_PIVOT_MODELS: Record<string, { modelName: string; fields: string[] }> = {
    cspGenderAge: { modelName: 'onefopCspGenderAge', fields: ['tableName', 'cspCategory', 'gender', 'ageBand'] },
    diplomaData: { modelName: 'onefopDiplomaData', fields: ['diploma', 'gender', 'ageBand'] },
    disabilityData: { modelName: 'onefopDisabilityData', fields: ['cspCategory', 'status', 'gender'] },
    vulnerableData: { modelName: 'onefopVulnerableData', fields: ['vulnerableType', 'status', 'gender'] },
    firstTimeWorkers: { modelName: 'onefopFirstTimeWorker', fields: ['contractType', 'cspCategory', 'gender', 'ageBand'] },
    jobApplicationData: { modelName: 'onefopJobApplicationData', fields: ['cspCategory', 'gender', 'ageBand'] },
    registeredSeekers: { modelName: 'onefopRegisteredSeeker', fields: ['contractType', 'cspCategory', 'gender', 'ageBand'] },
    departureData: { modelName: 'onefopDepartureData', fields: ['cspCategory', 'departureType', 'gender'] },
    dismissalUnemployment: { modelName: 'onefopDismissalUnemployment', fields: ['cspCategory', 'type', 'gender'] },
    internshipData: { modelName: 'onefopInternshipData', fields: ['internshipType', 'gender'] },
};

const INDEXED_PIVOT_MODELS: Record<string, { modelName: string }> = {
    dismissalReasons: { modelName: 'onefopDismissalReason' },
    skillNeeds: { modelName: 'onefopSkillNeed' },
    trainingNeeds: { modelName: 'onefopTrainingNeed' },
};

// ── Streaming Excel export support ──────────────────────────────────────
//
// The long-format breakdown/fact sheets (one row per submission × category)
// all share the same shape — title, static columns, a source relation, and
// a per-item row mapper — so they're declared once here instead of as 15
// separate inline calls, and driven by streamOnefopSubmissionsExcel below
// rather than the old buildOnefopWorkbook's single unbounded fetch.
interface BreakdownSheetDef {
    title: string;
    relationKey: string;
    modelName: string;
    columns: Partial<ExcelJS.Column>[];
    rowMapper: (item: any) => Record<string, unknown>;
}

const BREAKDOWN_SHEET_DEFS: BreakdownSheetDef[] = [
    {
        title: 'Effectifs CSP-Genre-Âge', relationKey: 'cspGenderAge', modelName: 'onefopCspGenderAge',
        columns: [
            { header: 'Tableau', key: 'tableName', width: 20 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ tableName: item.tableName, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }),
    },
    {
        title: 'Diplômes', relationKey: 'diplomaData', modelName: 'onefopDiplomaData',
        columns: [
            { header: 'Diplôme', key: 'diploma', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ diploma: item.diploma, gender: item.gender, ageBand: item.ageBand, value: item.value }),
    },
    {
        title: 'Situations de handicap', relationKey: 'disabilityData', modelName: 'onefopDisabilityData',
        columns: [
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Statut', key: 'status', width: 12 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ cspCategory: item.cspCategory, status: item.status, gender: item.gender, value: item.value }),
    },
    {
        title: 'Personnes vulnérables', relationKey: 'vulnerableData', modelName: 'onefopVulnerableData',
        columns: [
            { header: 'Catégorie vulnérable', key: 'vulnerableType', width: 20 },
            { header: 'Statut', key: 'status', width: 12 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ vulnerableType: item.vulnerableType, status: item.status, gender: item.gender, value: item.value }),
    },
    {
        title: 'Premiers emplois', relationKey: 'firstTimeWorkers', modelName: 'onefopFirstTimeWorker',
        columns: [
            { header: 'Type de contrat', key: 'contractType', width: 16 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ contractType: item.contractType, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }),
    },
    {
        title: 'Candidatures reçues', relationKey: 'jobApplicationData', modelName: 'onefopJobApplicationData',
        columns: [
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }),
    },
    {
        title: 'Demandeurs enregistrés', relationKey: 'registeredSeekers', modelName: 'onefopRegisteredSeeker',
        columns: [
            { header: 'Type de contrat', key: 'contractType', width: 16 },
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ contractType: item.contractType, cspCategory: item.cspCategory, gender: item.gender, ageBand: item.ageBand, value: item.value }),
    },
    {
        title: 'Départs', relationKey: 'departureData', modelName: 'onefopDepartureData',
        columns: [
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Type de départ', key: 'departureType', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ cspCategory: item.cspCategory, departureType: item.departureType, gender: item.gender, value: item.value }),
    },
    {
        title: 'Motifs de licenciement', relationKey: 'dismissalReasons', modelName: 'onefopDismissalReason',
        columns: [
            { header: 'N°', key: 'reasonIndex', width: 8 },
            { header: 'Motif', key: 'reasonText', width: 30 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 },
        ],
        rowMapper: (item) => ({ reasonIndex: item.reasonIndex, reasonText: item.reasonText, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }),
    },
    {
        title: 'Licenciement-Chômage technique', relationKey: 'dismissalUnemployment', modelName: 'onefopDismissalUnemployment',
        columns: [
            { header: 'Catégorie', key: 'cspCategory', width: 14 },
            { header: 'Type', key: 'type', width: 20 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ cspCategory: item.cspCategory, type: item.type, gender: item.gender, value: item.value }),
    },
    {
        title: 'Stages', relationKey: 'internshipData', modelName: 'onefopInternshipData',
        columns: [
            { header: 'Type de stage', key: 'internshipType', width: 18 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ internshipType: item.internshipType, gender: item.gender, value: item.value }),
    },
    {
        title: 'Besoins en compétences', relationKey: 'skillNeeds', modelName: 'onefopSkillNeed',
        columns: [
            { header: 'N°', key: 'skillIndex', width: 8 },
            { header: 'Compétence', key: 'skillDescription', width: 32 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 },
        ],
        rowMapper: (item) => ({ skillIndex: item.skillIndex, skillDescription: item.skillDescription, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }),
    },
    {
        title: 'Besoins en formation', relationKey: 'trainingNeeds', modelName: 'onefopTrainingNeed',
        columns: [
            { header: 'N°', key: 'domainIndex', width: 8 },
            { header: 'Domaine', key: 'trainingDomain', width: 32 },
            { header: 'Hommes', key: 'maleCount', width: 10 },
            { header: 'Femmes', key: 'femaleCount', width: 10 },
            { header: 'Total', key: 'totalCount', width: 10 },
        ],
        rowMapper: (item) => ({ domainIndex: item.domainIndex, trainingDomain: item.trainingDomain, maleCount: item.maleCount, femaleCount: item.femaleCount, totalCount: item.totalCount }),
    },
    {
        title: 'Recrutements (détail)', relationKey: 'factRecruitments', modelName: 'onefopFactRecruitment',
        columns: [
            { header: 'Année', key: 'year', width: 10 },
            { header: 'CSP', key: 'csp', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageGroup', width: 14 },
            { header: 'Nombre', key: 'count', width: 10 },
            { header: 'Type de recrutement', key: 'recruitmentType', width: 20 },
        ],
        rowMapper: (item) => ({ year: item.year, csp: item.csp, gender: item.gender, ageGroup: item.ageGroup, count: item.count, recruitmentType: item.recruitmentType }),
    },
    {
        title: 'Besoins compétences (détail)', relationKey: 'factSkillNeeds', modelName: 'onefopFactSkillNeed',
        columns: [
            { header: 'Année', key: 'year', width: 10 },
            { header: 'Compétence', key: 'skillDescription', width: 32 },
            { header: 'Nombre', key: 'count', width: 10 },
        ],
        rowMapper: (item) => ({ year: item.year, skillDescription: item.skillDescription, count: item.count }),
    },
];

// Every pivoted value column (the ones built from ENUM_PIVOT_CONFIGS /
// INDEXED_PIVOT_CONFIGS) is a headcount and always numeric — that part
// doesn't need a data scan to know. These are the only *static*/identity
// columns that are also numeric; everything else in commonColumns()/
// onefopSheetDefs() (names, statuses, phone numbers, codes) is treated as
// text. This is what lets column *types* for the .sps syntax be known
// without ever reading a row of actual data (see buildStaticFlatColumns).
const NUMERIC_STATIC_KEYS = new Set(['surveyYear', 'permanentWorkers', 'vacancies', 'yearCreated']);

interface FlatColumn {
    key: string;
    header: string;
    numeric: boolean;
}

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

        // ONEFOP Excel export now streams straight to the response (see
        // streamOnefopSubmissionsExcel) instead of building the whole
        // multi-sheet workbook from one unbounded ~19-relation fetch — the
        // same problem the SPSS export used to have. This branch stays
        // only to give a clear pointer to whoever still calls the old
        // shape rather than silently misbehaving.
        throw new BadRequestException(
            'ONEFOP Excel export has moved to POST /data-management/export/submissions/excel (streamed).',
        );
    }

    // Only APPROVED submissions are exported: these are the validated records
    // entities have submitted through the ONEFOP questionnaire. Shared by
    // the Excel export, and by both passes of the streaming SPSS export
    // below — one filter definition, so the two can never quietly drift
    // apart and export a different set of submissions from each other.
    private buildApprovedOnefopWhere(filters: {
        region?: string;
        department?: string;
        year?: number;
        fromDate?: string;
        toDate?: string;
    }): any {
        const where: any = { status: 'APPROVED' };
        if (filters.region) where.region = filters.region;
        if (filters.department) where.department = filters.department;
        if (filters.year) where.surveyYear = Number(filters.year);
        if (filters.fromDate || filters.toDate) {
            where.createdAt = {};
            if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
            if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
        }
        return where;
    }

    /// The .sps syntax half of the SPSS export — fast and bounded regardless
    /// of how many submissions match: it only needs the column *list*
    /// (Pass A, see the comment above ENUM_PIVOT_MODELS), never the
    /// submissions' own data. Call this first, then stream the CSV via
    /// streamApprovedOnefopSubmissionsCsv with the same filters.
    async buildSpssManifest(filters: {
        region?: string;
        department?: string;
        year?: number;
        fromDate?: string;
        toDate?: string;
    }): Promise<{ sps: string }> {
        const where = this.buildApprovedOnefopWhere(filters);
        const columns = await this.buildFlatColumns(where);
        return { sps: this.buildSpssSyntax(columns, 'onefop_submissions.csv') };
    }

    /// The data half — writes the CSV straight to the HTTP response as it's
    /// computed, in fixed-size keyset-paginated batches, instead of
    /// accumulating every approved submission (with all ~19 related tables)
    /// into memory first. Peak memory is one batch, not the whole export;
    /// bytes start flowing to the client immediately rather than only once
    /// the entire export has finished — see the comment above
    /// ENUM_PIVOT_MODELS for why this needs two passes.
    async streamApprovedOnefopSubmissionsCsv(
        filters: {
            region?: string;
            department?: string;
            year?: number;
            fromDate?: string;
            toDate?: string;
        },
        res: Response,
    ): Promise<void> {
        const where = this.buildApprovedOnefopWhere(filters);
        const columns = await this.buildFlatColumns(where);
        const detailKeyByFormType = new Map(this.onefopSheetDefs().map((d) => [d.formType, d.detailKey]));
        const remapByFormType = this.buildFormTypeRemap();

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="onefop_submissions.csv"');
        // Leading BOM so SPSS/Excel autodetect UTF-8 and render accented
        // French headers ("Année d'enquête", etc.) correctly on Windows —
        // matches the non-streaming export this replaced.
        res.write('﻿' + columns.map((c) => this.csvEscape(c.header)).join(',') + '\r\n');

        const BATCH_SIZE = 250;
        let cursor: string | undefined;

        // Headers are already sent by the time the first batch is fetched
        // (see the header-row write above), so a failure partway through a
        // 20,000-row export can't be turned into a clean HTTP error status
        // any more — the client would just see the connection end. This at
        // least logs what happened server-side and always ends the
        // response, rather than leaving the request hanging open (and a
        // connection-pool slot tied up) if an exception unwound past the
        // loop without ever calling res.end().
        try {
            for (; ;) {
                const batch: any[] = await this.prisma.onefopSubmission.findMany({
                    where,
                    orderBy: { id: 'asc' },
                    take: BATCH_SIZE,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                    include: this.approvedOnefopInclude(),
                });
                if (batch.length === 0) break;

                const pivots = ENUM_PIVOT_CONFIGS.map((cfg) => this.pivotColumnsAndValues(batch, cfg));
                const indexedPivots = INDEXED_PIVOT_CONFIGS.map((cfg) => this.indexedPivotColumnsAndValues(batch, cfg));

                let chunk = '';
                for (const s of batch) {
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
                    chunk += columns.map((c) => this.csvEscape(row[c.key])).join(',') + '\r\n';
                }

                // Backpressure: if the client (or a proxy in between) can't
                // keep up, wait for the socket to drain before fetching the
                // next batch, instead of buffering unboundedly in Node's own
                // memory while the network catches up.
                if (!res.write(chunk)) {
                    await new Promise<void>((resolve) => res.once('drain', resolve));
                }

                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }
        } catch (err) {
            console.error('❌ SPSS CSV export failed mid-stream:', err);
        } finally {
            res.end();
        }
    }

    // The exact set of relations the flat SPSS export reads — factRecruitments/
    // factSkillNeeds are Excel-only (their own long-format sheets there, see
    // buildOnefopWorkbook) so they're deliberately left out here to keep
    // each batch's fetch smaller.
    private approvedOnefopInclude() {
        return {
            company: {
                select: { name: true, taxNumber: true, region: true, department: true, establishmentId: true },
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
        };
    }

    // Pass A — the column list for the flat SPSS/CSV export. The static
    // (non-pivoted) columns are the same regardless of which submissions
    // match `where` (every entity-type's detail-sheet columns are always
    // included, exactly like the old buildFlatOnefopTable did), so those
    // need no query at all. Only the pivoted columns are discovered from
    // the database — via bounded `distinct` queries (see the comment above
    // ENUM_PIVOT_MODELS), not by reading the submissions themselves.
    private async buildFlatColumns(where: any): Promise<FlatColumn[]> {
        const columns: FlatColumn[] = [];

        for (const c of this.commonColumns()) {
            columns.push({
                key: c.key as string,
                header: c.header as string,
                numeric: NUMERIC_STATIC_KEYS.has(c.key as string),
            });
        }
        columns.push({ key: 'formType', header: 'Type de formulaire', numeric: false });

        const remapByFormType = this.buildFormTypeRemap();
        for (const def of this.onefopSheetDefs()) {
            const remap = remapByFormType.get(def.formType);
            for (const c of def.columns) {
                const origKey = c.key as string;
                const finalKey = remap?.get(origKey) ?? origKey;
                const collided = finalKey !== origKey;
                columns.push({
                    key: finalKey,
                    header: collided ? `${c.header} (${def.title})` : (c.header as string),
                    numeric: NUMERIC_STATIC_KEYS.has(origKey),
                });
            }
        }

        for (const cfg of ENUM_PIVOT_CONFIGS) {
            const model = ENUM_PIVOT_MODELS[cfg.relationKey];
            const delegate = (this.prisma as any)[model.modelName];
            const combos: any[] = await delegate.findMany({
                where: { submission: where },
                distinct: model.fields,
                select: Object.fromEntries(model.fields.map((f) => [f, true])),
                orderBy: model.fields.map((f) => ({ [f]: 'asc' as const })),
            });
            for (const item of combos) {
                columns.push({ key: cfg.keyBuilder(item), header: cfg.headerBuilder(item), numeric: true });
            }
        }

        for (const cfg of INDEXED_PIVOT_CONFIGS) {
            const model = INDEXED_PIVOT_MODELS[cfg.relationKey];
            const delegate = (this.prisma as any)[model.modelName];
            const combos: any[] = await delegate.findMany({
                where: { submission: where },
                distinct: [cfg.indexField],
                select: { [cfg.indexField]: true },
                orderBy: { [cfg.indexField]: 'asc' as const },
            });
            for (const item of combos) {
                const idx = item[cfg.indexField];
                columns.push(
                    { key: `${cfg.relationKey}_${idx}_desc`, header: `${cfg.prefix} ${idx} - Description`, numeric: false },
                    { key: `${cfg.relationKey}_${idx}_h`, header: `${cfg.prefix} ${idx} - Hommes`, numeric: true },
                    { key: `${cfg.relationKey}_${idx}_f`, header: `${cfg.prefix} ${idx} - Femmes`, numeric: true },
                    { key: `${cfg.relationKey}_${idx}_t`, header: `${cfg.prefix} ${idx} - Total`, numeric: true },
                );
            }
        }

        return columns;
    }

    // Pass A for one Excel entity sheet (Entreprises/Coopératives/CTD/ONG,
    // see streamOnefopSubmissionsExcel) — the pivot columns shown on that
    // sheet only ever include categories that appear among *that* form
    // type's submissions (each sheet is entirely separate, unlike the flat
    // CSV/SPSS export which merges every form type into one table), so this
    // is scoped to formType. Same bounded-by-enum-space reasoning as
    // buildFlatColumns: each `distinct` query returns at most the
    // *possible* combinations, not one row per submission.
    private async buildEntitySheetPivotColumns(where: any, formType: string): Promise<Partial<ExcelJS.Column>[]> {
        const scoped = { ...where, formType };
        const columns: Partial<ExcelJS.Column>[] = [];

        for (const cfg of ENUM_PIVOT_CONFIGS) {
            const model = ENUM_PIVOT_MODELS[cfg.relationKey];
            const delegate = (this.prisma as any)[model.modelName];
            const combos: any[] = await delegate.findMany({
                where: { submission: scoped },
                distinct: model.fields,
                select: Object.fromEntries(model.fields.map((f) => [f, true])),
                orderBy: model.fields.map((f) => ({ [f]: 'asc' as const })),
            });
            for (const item of combos) {
                columns.push({ header: cfg.headerBuilder(item), key: cfg.keyBuilder(item), width: 14 });
            }
        }

        for (const cfg of INDEXED_PIVOT_CONFIGS) {
            const model = INDEXED_PIVOT_MODELS[cfg.relationKey];
            const delegate = (this.prisma as any)[model.modelName];
            const combos: any[] = await delegate.findMany({
                where: { submission: scoped },
                distinct: [cfg.indexField],
                select: { [cfg.indexField]: true },
                orderBy: { [cfg.indexField]: 'asc' as const },
            });
            for (const item of combos) {
                const idx = item[cfg.indexField];
                columns.push(
                    { header: `${cfg.prefix} ${idx} - Description`, key: `${cfg.relationKey}_${idx}_desc`, width: 28 },
                    { header: `${cfg.prefix} ${idx} - Hommes`, key: `${cfg.relationKey}_${idx}_h`, width: 10 },
                    { header: `${cfg.prefix} ${idx} - Femmes`, key: `${cfg.relationKey}_${idx}_f`, width: 10 },
                    { header: `${cfg.prefix} ${idx} - Total`, key: `${cfg.relationKey}_${idx}_t`, width: 10 },
                );
            }
        }

        return columns;
    }

    // Same collision-remap rule buildFlatColumns/streamApprovedOnefopSubmissionsCsv
    // both need: where a form-type's own detail column key collides with a
    // common column already claimed (e.g. ENTREPRISE's self-reported "Raison
    // sociale" vs. the common "Entreprise (fiche)" pulled from the linked
    // Company record), the later one is suffixed with its form type rather
    // than silently merged. Recomputed on each call (cheap — a handful of
    // static column defs, no I/O) rather than cached, so the two call sites
    // can't drift out of sync with each other.
    private buildFormTypeRemap(): Map<string, Map<string, string>> {
        const usedKeys = new Set<string>(this.commonColumns().map((c) => c.key as string));
        usedKeys.add('formType');
        const remapByFormType = new Map<string, Map<string, string>>();

        for (const def of this.onefopSheetDefs()) {
            const remap = new Map<string, string>();
            for (const c of def.columns) {
                const origKey = c.key as string;
                const collided = usedKeys.has(origKey);
                const finalKey = collided ? `${origKey}_${def.formType.toLowerCase()}` : origKey;
                usedKeys.add(finalKey);
                if (collided) remap.set(origKey, finalKey);
            }
            remapByFormType.set(def.formType, remap);
        }
        return remapByFormType;
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

    // Streams the ONEFOP Excel workbook straight to the HTTP response via
    // ExcelJS's row-by-row WorkbookWriter, instead of building the whole
    // multi-sheet workbook (~19 relations × every approved submission) in
    // memory first and returning it as one Buffer — the same unbounded-fetch
    // problem the SPSS export used to have (see streamApprovedOnefopSubmissionsCsv).
    //
    // Unlike the CSV export, sheets can't be filled in an interleaved,
    // batch-by-batch pass: ExcelJS's streaming writer hands each worksheet
    // its own zip entry via `archiver`, which only actively drains one entry
    // at a time — writing to several sheets in an interleaved fashion would
    // just leave every sheet but the one currently being drained buffering
    // in memory regardless, defeating the point. So each sheet is fully
    // fetched (its own keyset-paginated pass), written, and committed before
    // the next one starts — more round trips than a single pass, but the
    // only way to keep peak memory bounded to one sheet's one batch.
    async streamOnefopSubmissionsExcel(
        filters: {
            region?: string;
            department?: string;
            year?: number;
            fromDate?: string;
            toDate?: string;
        },
        res: Response,
    ): Promise<void> {
        const where = this.buildApprovedOnefopWhere(filters);
        const sheetDefs = this.onefopSheetDefs();
        const BATCH_SIZE = 250;

        const date = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="onefop_submissions_${date}.xlsx"`);

        const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        workbookWriter.creator = 'MINEFOP';
        workbookWriter.created = new Date();

        let anySheet = false;

        try {
            // Bounded regardless of submission count — at most 4 form types.
            const formTypesPresent = new Set(
                (
                    await this.prisma.onefopSubmission.findMany({
                        where,
                        distinct: ['formType'],
                        select: { formType: true },
                    })
                ).map((r) => r.formType as string),
            );

            for (const def of sheetDefs) {
                if (!formTypesPresent.has(def.formType)) continue;
                const pivotColumns = await this.buildEntitySheetPivotColumns(where, def.formType);

                const sheet = workbookWriter.addWorksheet(def.title);
                sheet.columns = [...this.commonColumns(), ...def.columns, ...pivotColumns];
                sheet.getRow(1).font = { bold: true };
                anySheet = true;

                const scoped = { ...where, formType: def.formType };
                let cursor: string | undefined;
                for (; ;) {
                    const batch: any[] = await this.prisma.onefopSubmission.findMany({
                        where: scoped,
                        orderBy: { id: 'asc' },
                        take: BATCH_SIZE,
                        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                        include: this.approvedOnefopInclude(),
                    });
                    if (batch.length === 0) break;

                    const pivots = ENUM_PIVOT_CONFIGS.map((cfg) => this.pivotColumnsAndValues(batch, cfg));
                    const indexedPivots = INDEXED_PIVOT_CONFIGS.map((cfg) => this.indexedPivotColumnsAndValues(batch, cfg));
                    for (const s of batch) {
                        const detail = s[def.detailKey] ?? {};
                        const row: Record<string, unknown> = { ...this.commonRow(s), ...detail };
                        for (const p of pivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                        for (const p of indexedPivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                        (sheet.addRow(row) as any).commit();
                    }

                    cursor = batch[batch.length - 1].id;
                    if (batch.length < BATCH_SIZE) break;
                }
                (sheet as any).commit();
            }

            // Tidy/long-format versions of the same breakdown tables, kept
            // alongside the flattened per-entity sheets above — one row per
            // submission × category, for PivotTables/SUMIFS/Python/R/Stata
            // rather than browsing a single entity's full submission.
            for (const def of BREAKDOWN_SHEET_DEFS) {
                const delegate = (this.prisma as any)[def.modelName];
                const exists = await delegate.findFirst({ where: { submission: where }, select: { id: true } });
                if (!exists) continue;

                const sheet = workbookWriter.addWorksheet(def.title);
                sheet.columns = [...this.identityColumns(), ...def.columns];
                sheet.getRow(1).font = { bold: true };
                anySheet = true;

                let cursor: string | undefined;
                for (; ;) {
                    const batch: any[] = await this.prisma.onefopSubmission.findMany({
                        where,
                        orderBy: { id: 'asc' },
                        take: BATCH_SIZE,
                        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                        // Only the one relation this sheet needs, unlike the
                        // ~19-relation include the entity sheets use — each
                        // of these 15 passes rescans every approved
                        // submission, so keeping the fetch light matters.
                        select: {
                            id: true,
                            submissionId: true,
                            formType: true,
                            region: true,
                            company: { select: { name: true } },
                            [def.relationKey]: true,
                        } as any,
                    });
                    if (batch.length === 0) break;

                    for (const s of batch) {
                        const items = s[def.relationKey] as any[] | undefined;
                        if (!items || items.length === 0) continue;
                        for (const item of items) {
                            const row = { ...this.identityFields(s), ...def.rowMapper(item) };
                            (sheet.addRow(row) as any).commit();
                        }
                    }

                    cursor = batch[batch.length - 1].id;
                    if (batch.length < BATCH_SIZE) break;
                }
                (sheet as any).commit();
            }

            if (!anySheet) {
                workbookWriter.addWorksheet('Soumissions').addRow(['Aucune soumission approuvée trouvée.']).commit();
            }
        } catch (err) {
            console.error('❌ Excel export failed mid-stream:', err);
        }

        await workbookWriter.commit();
    }

    private csvEscape(value: unknown): string {
        if (value === null || value === undefined) return '';
        const str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
        return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
    // row), so this only has to agree with the streamed CSV on column
    // order, not on names.
    //
    // Format is decided from each column's static `numeric` flag rather
    // than scanning actual values: every pivoted value column is a
    // headcount (always a non-negative integer, never a decimal — see the
    // comment on NUMERIC_STATIC_KEYS), so F10.0 is exact, not a guess.
    // String columns get SPSS's own max width (A254) rather than a
    // measured one — since /ARRANGEMENT=DELIMITED means this width is only
    // a data-dictionary hint, not a fixed-column parse position, a
    // generously-wide declaration parses identically to a tightly-measured
    // one. Both let this run as a single pass over the *column list* —
    // O(columns), never O(rows) — so it stays fast at 20,000 submissions
    // exactly as it was at 20.
    private buildSpssSyntax(columns: FlatColumn[], csvFilename: string): string {
        const used = new Set<string>();
        const varNames = columns.map((c, i) => this.sanitizeSpssVarName(c.header, i + 1, used));
        const formats = columns.map((c) => (c.numeric ? 'F10.0' : 'A254'));

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

}