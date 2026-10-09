import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EligibilityEngineService } from '../questionnaires/eligibility-engine.service';
import {
    DATASET_SCHEMA_VERSION,
    CanonicalSchemaAdapterService,
    AnalyticalPartition,
    AnalyticalVariableDefinition,
} from './canonical-schema-adapter.service';
import {
    buildOnefopExportWhere,
    buildSpssExportWhere,
    resolveExportPartition,
    type OnefopExportFilters,
} from './spss/export-filters';
import { Territory, territoryWhere, territoryWhereForDeclaration, territoryWhereForExport } from '../auth/territory';
import { SAV_NCASES_OFFSET, SavWriter, type SavVariable } from './spss/sav-writer';
import { hasRealNiu } from './niu';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export { DATASET_SCHEMA_VERSION };

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
        keyBuilder: (i) => i.cspCategory ? `dipl_${i.cspCategory}_${i.diploma}_${i.gender}_${i.ageBand ?? 'NA'}` : `dipl_${i.diploma}_${i.gender}_${i.ageBand ?? 'NA'}`,
        headerBuilder: (i) => i.cspCategory ? `Diplôme ${i.cspCategory} ${i.diploma} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}` : `Diplôme ${i.diploma} ${i.gender}${i.ageBand ? ' ' + i.ageBand : ''}`,
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
    diplomaData: { modelName: 'onefopDiplomaData', fields: ['cspCategory', 'diploma', 'gender', 'ageBand'] },
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
            { header: 'Catégorie CSP', key: 'cspCategory', width: 14 },
            { header: 'Diplôme', key: 'diploma', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ cspCategory: item.cspCategory, diploma: item.diploma, gender: item.gender, ageBand: item.ageBand, value: item.value }),
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
    // onefopFactRecruitment and onefopFactSkillNeed are permanently empty —
    // no ETL path writes to them. Their entries have been removed from this
    // array so Excel exports do not include misleading empty sheets.
    // If an ETL path is added in the future, restore entries here.
    {
        title: 'Projets - Activités', relationKey: 'projectProgramActivities', modelName: 'projectProgramActivity',
        columns: [
            { header: 'N° ligne', key: 'rowIndex', width: 10 },
            { header: 'Activité', key: 'description', width: 30 },
            { header: 'Population cible', key: 'targetPopulation', width: 18 },
            { header: "Type d'appui", key: 'supportType', width: 16 },
            { header: 'Portée', key: 'scope', width: 14 },
            { header: 'Date début', key: 'startDate', width: 14 },
            { header: 'Durée', key: 'duration', width: 12 },
        ],
        rowMapper: (item) => ({
            rowIndex: item.rowIndex,
            description: item.description,
            targetPopulation: item.targetPopulation,
            supportType: item.supportType,
            scope: item.scope,
            startDate: item.startDate,
            duration: item.duration,
        }),
    },
    // VT (Formation Professionnelle) breakdown tables — 11 of the 12 OnefopVt*
    // child tables. OnefopVtTrainerRoster (8.8) is deliberately excluded: it
    // holds named individuals (PII) and, per the design note §9, stays out of
    // the default statistical export — any roster export is separate,
    // explicitly labelled, and gated the same way this endpoint already is.
    {
        title: 'FP - Diplômes', relationKey: 'vtDiplomaData', modelName: 'onefopVtDiplomaData',
        columns: [
            { header: 'Type de personne', key: 'personType', width: 16 },
            { header: 'Type de diplôme', key: 'diplomaKind', width: 16 },
            { header: 'Diplôme', key: 'diploma', width: 24 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ personType: item.personType, diplomaKind: item.diplomaKind, diploma: item.diploma, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Flux âge apprenants', relationKey: 'vtTraineeAgeFlow', modelName: 'onefopVtTraineeAgeFlow',
        columns: [
            { header: "Tranche d'âge", key: 'ageBand', width: 14 },
            { header: 'Statut de flux', key: 'flowStatus', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ ageBand: item.ageBand, flowStatus: item.flowStatus, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Âge formateurs', relationKey: 'vtTrainerAge', modelName: 'onefopVtTrainerAge',
        columns: [
            { header: "Tranche d'âge", key: 'ageBand', width: 16 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ ageBand: item.ageBand, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Flux niveau éducation', relationKey: 'vtEducationLevelFlow', modelName: 'onefopVtEducationLevelFlow',
        columns: [
            { header: "Niveau d'éducation", key: 'educationLevel', width: 24 },
            { header: 'Statut de flux', key: 'flowStatus', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ educationLevel: item.educationLevel, flowStatus: item.flowStatus, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Apprenants vulnérables', relationKey: 'vtTraineeVulnerable', modelName: 'onefopVtTraineeVulnerable',
        columns: [
            { header: 'Catégorie', key: 'category', width: 22 },
            { header: 'Statut de flux', key: 'flowStatus', width: 14 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ category: item.category, flowStatus: item.flowStatus, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Handicap formateurs', relationKey: 'vtTrainerDisability', modelName: 'onefopVtTrainerDisability',
        columns: [
            { header: 'Catégorie', key: 'category', width: 18 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ category: item.category, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Bourses', relationKey: 'vtScholarship', modelName: 'onefopVtScholarship',
        columns: [
            { header: 'Catégorie', key: 'category', width: 18 },
            { header: 'Statut', key: 'status', width: 12 },
            { header: 'Genre', key: 'gender', width: 10 },
            { header: 'Valeur', key: 'value', width: 10 },
        ],
        rowMapper: (item) => ({ category: item.category, status: item.status, gender: item.gender, value: item.value }),
    },
    {
        title: 'FP - Filières (spécialités)', relationKey: 'vtSpecialtyRows', modelName: 'onefopVtSpecialtyRow',
        columns: [
            { header: 'Tableau', key: 'tableCode', width: 12 },
            { header: 'N° ligne', key: 'rowIndex', width: 10 },
            { header: 'Filière', key: 'specialtyText', width: 28 },
            { header: 'FI Hommes', key: 'fiMale', width: 12 },
            { header: 'FI Femmes', key: 'fiFemale', width: 12 },
            { header: 'FC Hommes', key: 'fcMale', width: 12 },
            { header: 'FC Femmes', key: 'fcFemale', width: 12 },
            { header: 'Année 1 Hommes', key: 'year1Male', width: 14 },
            { header: 'Année 1 Femmes', key: 'year1Female', width: 14 },
            { header: 'Année 2 Hommes', key: 'year2Male', width: 14 },
            { header: 'Année 2 Femmes', key: 'year2Female', width: 14 },
            { header: 'Hommes', key: 'male', width: 10 },
            { header: 'Femmes', key: 'female', width: 10 },
            { header: 'Total', key: 'total', width: 10 },
            { header: 'FI (effectif)', key: 'fiCount', width: 12 },
            { header: 'FC (effectif)', key: 'fcCount', width: 12 },
        ],
        rowMapper: (item) => ({
            tableCode: item.tableCode, rowIndex: item.rowIndex, specialtyText: item.specialtyText,
            fiMale: item.fiMale, fiFemale: item.fiFemale, fcMale: item.fcMale, fcFemale: item.fcFemale,
            year1Male: item.year1Male, year1Female: item.year1Female, year2Male: item.year2Male, year2Female: item.year2Female,
            male: item.male, female: item.female, total: item.total,
            fiCount: item.fiCount, fcCount: item.fcCount,
        }),
    },
    {
        title: 'FP - Curricula', relationKey: 'vtCurricula', modelName: 'onefopVtCurriculum',
        columns: [
            { header: 'N° ligne', key: 'rowIndex', width: 10 },
            { header: 'Filière', key: 'specialtyText', width: 28 },
            { header: 'Curriculum existant', key: 'hasCurriculum', width: 18 },
            { header: 'Curriculum approuvé', key: 'isApproved', width: 18 },
        ],
        rowMapper: (item) => ({ rowIndex: item.rowIndex, specialtyText: item.specialtyText, hasCurriculum: item.hasCurriculum, isApproved: item.isApproved }),
    },
    {
        title: 'FP - Infrastructures', relationKey: 'vtInfrastructure', modelName: 'onefopVtInfrastructure',
        columns: [
            { header: "Type d'infrastructure", key: 'infrastructureType', width: 24 },
            { header: 'Total', key: 'totalCount', width: 10 },
            { header: 'Permanent bon état', key: 'permanentGoodCount', width: 18 },
            { header: 'Permanent mauvais état', key: 'permanentBadCount', width: 20 },
            { header: 'Temporaire', key: 'temporaryCount', width: 12 },
        ],
        rowMapper: (item) => ({ infrastructureType: item.infrastructureType, totalCount: item.totalCount, permanentGoodCount: item.permanentGoodCount, permanentBadCount: item.permanentBadCount, temporaryCount: item.temporaryCount }),
    },
    {
        title: 'FP - Mobilier', relationKey: 'vtFurniture', modelName: 'onefopVtFurniture',
        columns: [
            { header: 'Type de mobilier', key: 'furnitureType', width: 20 },
            { header: 'Bon état', key: 'goodCount', width: 12 },
            { header: 'Mauvais état', key: 'badCount', width: 12 },
        ],
        rowMapper: (item) => ({ furnitureType: item.furnitureType, goodCount: item.goodCount, badCount: item.badCount }),
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
    constructor(
        private prisma: PrismaService,
        @Optional() private eligibilityEngine?: EligibilityEngineService,
        @Optional() private canonicalAdapter?: CanonicalSchemaAdapterService,
    ) { }

    private resolvePartition(filters: any, where: any): AnalyticalPartition {
        if (filters?.partition === 'TVET' || filters?.entityType === 'VOCATIONAL_TRAINING' || where?.formType === 'VOCATIONAL_TRAINING') {
            return 'TVET';
        }
        if (filters?.partition === 'ALL') {
            return 'ALL';
        }
        return 'DEMAND';
    }


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

    async getDataStats(territory?: Territory) {
        // Three models, three where shapes. Company and OnefopSubmission both
        // declare every column territoryWhere can emit; Declaration declares
        // neither regionId nor departmentId and calls the second tier
        // `division`, so it gets the narrowed builder. Typed rather than
        // `any` so a future key mismatch fails the build instead of 500-ing.
        const companyWhere = territoryWhere(territory) as Prisma.CompanyWhereInput;
        const onefopWhere = territoryWhere(territory) as Prisma.OnefopSubmissionWhereInput;
        const declarationWhere: Prisma.DeclarationWhereInput = territoryWhereForDeclaration(territory);
        const [
            totalCompanies,
            totalDeclarations,
            totalOnefopSubmissions,
            totalUsers,
            declarationsByStatus,
            onefopByStatus,
            companiesByRegion,
        ] = await Promise.all([
            this.prisma.company.count({ where: companyWhere }),
            this.prisma.declaration.count({ where: declarationWhere }),
            this.prisma.onefopSubmission.count({ where: onefopWhere }),
            territory?.region
                ? this.prisma.user.count({ where: { region: territory.region } })
                : this.prisma.user.count(),

            this.prisma.declaration.groupBy({
                by: ['status'],
                where: declarationWhere,
                _count: true,
            }),

            this.prisma.onefopSubmission.groupBy({
                by: ['status'],
                where: onefopWhere,
                _count: true,
            }),

            this.prisma.company.groupBy({
                by: ['region'],
                where: companyWhere,
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

    // Only statistically eligible submissions are exported: Axis 1 Approved
    // AND Axis 2 has zero open blocking anomalies (Axe 3 Statistical Eligibility).
    // Shared by the Excel export, and by both passes of the streaming SPSS export
    // below — one filter definition, so the two can never quietly drift
    // apart and export a different set of submissions from each other.
    private eligibilityWhere() {
        return this.eligibilityEngine
            ? this.eligibilityEngine.getStatisticalEligibilityWhere()
            : EligibilityEngineService.getStatisticalEligibilityWhere();
    }

    /// Rows for every ONEFOP export. Without `statuses` this is the official
    /// statistical base (APPROVED, no open blocking anomaly); with `statuses`
    /// it is exactly those administrative statuses — see export-filters.ts.
    private buildApprovedOnefopWhere(filters: OnefopExportFilters, territory?: Territory): any {
        const base = buildOnefopExportWhere(filters, this.eligibilityWhere());
        if (!territory) return base;
        return { AND: [territoryWhereForExport(territory), base] };
    }

    /// SPSS/CSV rows additionally restricted to the partition whose variables
    /// the file carries, so a demand file never contains TVET rows (and the
    /// reverse) — they would otherwise come out almost entirely blank.
    private buildSpssWhere(filters: OnefopExportFilters, territory?: Territory): any {
        const base = buildSpssExportWhere(filters, this.eligibilityWhere());
        if (!territory) return base;
        return { AND: [territoryWhereForExport(territory), base] };
    }

    /// The .sps syntax half of the SPSS export — fast and bounded regardless
    /// of how many submissions match: it only needs the column *list*
    /// (Pass A, see the comment above ENUM_PIVOT_MODELS), never the
    /// submissions' own data. Call this first, then stream the CSV via
    /// streamApprovedOnefopSubmissionsCsv with the same filters.
    async buildSpssManifest(filters: OnefopExportFilters, territory?: Territory): Promise<{ sps: string; schemaVersion: number }> {
        const where = this.buildSpssWhere(filters, territory);
        if (this.canonicalAdapter) {
            const partition = resolveExportPartition(filters);
            const variables = this.canonicalAdapter.getVariablesForPartition(partition);
            return {
                sps: this.canonicalAdapter.buildSpssSyntax(variables, 'onefop_submissions.csv'),
                schemaVersion: DATASET_SCHEMA_VERSION,
            };
        }
        const columns = await this.buildFlatColumns(where);
        return { sps: this.buildSpssSyntax(columns, 'onefop_submissions.csv'), schemaVersion: DATASET_SCHEMA_VERSION };
    }

    /// The data half — writes the CSV straight to the HTTP response as it's
    /// computed, in fixed-size keyset-paginated batches, instead of
    /// accumulating every approved submission (with all ~19 related tables)
    /// into memory first. Peak memory is one batch, not the whole export;
    /// bytes start flowing to the client immediately rather than only once
    /// the entire export has finished — see the comment above
    /// ENUM_PIVOT_MODELS for why this needs two passes.
    async streamApprovedOnefopSubmissionsCsv(
        filters: OnefopExportFilters,
        res: Response,
        territory?: Territory,
    ): Promise<void> {
        const where = this.buildSpssWhere(filters, territory);

        if (this.canonicalAdapter) {
            const partition = resolveExportPartition(filters);
            const variables = this.canonicalAdapter.getVariablesForPartition(partition);

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="onefop_submissions.csv"');
            res.setHeader('X-Dataset-Schema-Version', String(DATASET_SCHEMA_VERSION));
            // Header row = SPSS variable names (E10, dataset v4), so the CSV is
            // usable on its own in R/Stata/Python. The .sps reads it with
            // FIRSTCASE=2 (skips this row) and positional columns, unchanged.
            res.write('﻿' + variables.map((v) => this.csvEscape(v.variableName)).join(',') + '\r\n');
            const referencePeriods = await this.loadReferencePeriods();

            const BATCH_SIZE = 250;
            let cursor: string | undefined;

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

                    let chunk = '';
                    for (const s of batch) {
                        this.attachReferencePeriod(s, referencePeriods);
                        chunk += variables.map((v) => this.csvEscape(this.canonicalAdapter!.extractValue(v, s))).join(',') + '\r\n';
                    }

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
            return;
        }

        const columns = await this.buildFlatColumns(where);
        const detailKeyByFormType = new Map(this.onefopSheetDefs().map((d) => [d.formType, d.detailKey]));
        const remapByFormType = this.buildFormTypeRemap();

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="onefop_submissions.csv"');
        res.setHeader('X-Dataset-Schema-Version', String(DATASET_SCHEMA_VERSION));
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

    /// Generates and streams a native IBM SPSS .sav dataset (variable and
    /// value labels, formats, measurement levels, -99 user-missing) — written
    /// in-process by SavWriter, no Python/pyreadstat dependency. The file is
    /// built in a temp directory first so a failure still produces a clean
    /// HTTP error (and the header gets the exact case count) instead of a
    /// truncated download.
    async streamApprovedOnefopSubmissionsSav(
        filters: OnefopExportFilters,
        res: Response,
        territory?: Territory,
    ): Promise<void> {
        // Outside the try: an invalid filter is a 400, not a generation failure.
        const where = this.buildSpssWhere(filters, territory);
        const partition = resolveExportPartition(filters);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onefop-sav-'));
        const tmpSav = path.join(tmpDir, 'onefop_submissions.sav');

        try {
            let writer: SavWriter;
            let rowsOf: (batch: any[]) => unknown[][];

            if (this.canonicalAdapter) {
                const adapter = this.canonicalAdapter;
                const variables = adapter.getVariablesForPartition(partition);
                writer = new SavWriter(variables.map((v) => this.toSavVariable(v)), {
                    fileLabel: `CAM-LEAP / ONEFOP - Registre Analytique Canonique (v${DATASET_SCHEMA_VERSION})`,
                });
                const referencePeriods = await this.loadReferencePeriods();
                rowsOf = (batch) => batch.map((s) => {
                    this.attachReferencePeriod(s, referencePeriods);
                    return variables.map((v) => adapter.extractValue(v, s));
                });
            } else {
                const columns = await this.buildFlatColumns(where);
                const used = new Set<string>();
                writer = new SavWriter(
                    columns.map((c, i) => ({
                        name: this.sanitizeSpssVarName(c.header, i + 1, used),
                        label: c.header,
                        type: c.numeric ? ('numeric' as const) : ('string' as const),
                        width: c.numeric ? 10 : 254,
                        missingValues: c.numeric ? [-99] : undefined,
                    })),
                    { fileLabel: 'CAM-LEAP / ONEFOP' },
                );
                const detailKeyByFormType = new Map(this.onefopSheetDefs().map((d) => [d.formType, d.detailKey]));
                const remapByFormType = this.buildFormTypeRemap();
                rowsOf = (batch) => {
                    const pivots = ENUM_PIVOT_CONFIGS.map((cfg) => this.pivotColumnsAndValues(batch, cfg));
                    const indexedPivots = INDEXED_PIVOT_CONFIGS.map((cfg) => this.indexedPivotColumnsAndValues(batch, cfg));
                    return batch.map((s) => {
                        const detailKey = detailKeyByFormType.get(s.formType);
                        const detail = detailKey ? (s[detailKey] ?? {}) : {};
                        const remap = remapByFormType.get(s.formType);
                        const row: Record<string, unknown> = { ...this.commonRow(s), formType: s.formType };
                        for (const [k, v] of Object.entries(detail)) row[remap?.get(k) ?? k] = v;
                        for (const p of pivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                        for (const p of indexedPivots) Object.assign(row, p.valuesBySubmission.get(s.id) ?? {});
                        return columns.map((c) => row[c.key]);
                    });
                };
            }

            await this.writeSavFile(tmpSav, writer, where, rowsOf);

            res.setHeader('Content-Type', 'application/x-spss-sav');
            res.setHeader('Content-Disposition', 'attachment; filename="onefop_submissions.sav"');
            res.setHeader('X-Dataset-Schema-Version', String(DATASET_SCHEMA_VERSION));
            res.setHeader('Content-Length', String(fs.statSync(tmpSav).size));
            const fileStream = fs.createReadStream(tmpSav);
            fileStream.pipe(res);
            await new Promise<void>((resolve) => {
                fileStream.on('end', resolve);
                fileStream.on('error', (err) => {
                    console.error('❌ Error streaming .sav file:', err);
                    res.destroy(err);
                    resolve();
                });
            });
        } catch (err) {
            console.error('❌ SPSS .sav export failed:', err);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Erreur lors de la génération du fichier SPSS .sav: ' + (err as any)?.message });
            }
        } finally {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.warn('⚠️ Could not remove temp dir:', cleanupErr);
            }
        }
    }

    /// quarterCode → the SubmissionRound's period bounds, read once per export
    /// (the table holds one row per round, so this is small). Feeds the
    /// periodStart/periodEnd variables — see
    /// CanonicalSchemaAdapterService.resolveReferencePeriod.
    private async loadReferencePeriods(): Promise<Map<string, { periodStart: Date; periodEnd: Date }>> {
        const rounds: Array<{ quarterCode: string; periodStart: Date; periodEnd: Date }> =
            await this.prisma.submissionRound.findMany({
                select: { quarterCode: true, periodStart: true, periodEnd: true },
            });
        return new Map(rounds.map((r) => [r.quarterCode, { periodStart: r.periodStart, periodEnd: r.periodEnd }]));
    }

    private attachReferencePeriod(
        submission: any,
        periods: Map<string, { periodStart: Date; periodEnd: Date }>,
    ): void {
        const period = submission.quarterCode ? periods.get(submission.quarterCode) : undefined;
        if (period) submission.referencePeriod = period;
    }

    /// Canonical variable → SavWriter variable. Numeric display formats keep
    /// the previous pyreadstat output (F10.0, F14.0 for payroll/turnover)
    /// unless the registry asks for something wider.
    private toSavVariable(v: AnalyticalVariableDefinition): SavVariable {
        const numeric = v.spssDataType === 'NUMERIC';
        const lower = v.variableName.toLowerCase();
        const minWidth = lower.includes('payroll') || lower.includes('turnover') ? 14 : 10;
        const measure = !numeric || v.measurementLevel === 'NOMINAL'
            ? 'nominal'
            : v.measurementLevel === 'ORDINAL' ? 'ordinal' : 'scale';
        return {
            name: v.variableName,
            label: v.labelFr || v.labelEn || v.variableName,
            type: numeric ? 'numeric' : 'string',
            width: numeric ? Math.max(v.spssWidth || 0, minWidth) : v.spssWidth || 254,
            valueLabels: v.valueLabels,
            missingValues: numeric ? [-99] : undefined,
            measure,
        };
    }

    /// Keyset-paginated pass over `where`, encoded straight into the .sav file
    /// (peak memory = one batch), then the real case count is patched into
    /// the header.
    private async writeSavFile(
        filePath: string,
        writer: SavWriter,
        where: any,
        rowsOf: (batch: any[]) => unknown[][],
    ): Promise<void> {
        const out = fs.createWriteStream(filePath);
        const closed = new Promise<void>((resolve, reject) => {
            out.once('finish', resolve);
            out.once('error', reject);
        });
        const write = async (buf: Buffer) => {
            if (buf.length > 0 && !out.write(buf)) {
                await new Promise<void>((resolve) => out.once('drain', resolve));
            }
        };

        try {
            await write(writer.header());
            const BATCH_SIZE = 250;
            let cursor: string | undefined;
            for (; ;) {
                const batch: any[] = await this.prisma.onefopSubmission.findMany({
                    where,
                    orderBy: { id: 'asc' },
                    take: BATCH_SIZE,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                    include: this.approvedOnefopInclude(),
                });
                if (batch.length === 0) break;
                for (const row of rowsOf(batch)) await write(writer.encodeCase(row));
                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }
            await write(writer.finish());
        } finally {
            out.end();
        }
        await closed;

        if (writer.truncatedValues.size > 0) {
            // Silent data loss would be worse than a noisy log: a registry
            // width is too small for real values — widen it in the adapter.
            console.warn(
                '⚠️ SPSS .sav export truncated values to fit variable widths:',
                Object.fromEntries(writer.truncatedValues),
            );
        }

        const fd = fs.openSync(filePath, 'r+');
        try {
            const count = Buffer.alloc(4);
            count.writeInt32LE(writer.casesWritten, 0);
            fs.writeSync(fd, count, 0, 4, SAV_NCASES_OFFSET);
        } finally {
            fs.closeSync(fd);
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
            administrationDetail: true,
            projectProgramDetail: true,
            vocationalTrainingDetail: true,
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
            projectProgramActivities: true,
            // VT statistical child tables — required for TVET .sav/.csv export;
            // previously absent, causing all VT breakdown variables to be
            // system-missing.
            vtDiplomaData: true,
            vtTraineeAgeFlow: true,
            vtTrainerAge: true,
            vtEducationLevelFlow: true,
            vtTraineeVulnerable: true,
            vtTrainerDisability: true,
            vtScholarship: true,
            vtSpecialtyRows: true,
            vtCurricula: true,
            vtInfrastructure: true,
            vtFurniture: true,
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
        if (this.canonicalAdapter) {
            const partition = this.resolvePartition({}, where);
            const variables = this.canonicalAdapter.getVariablesForPartition(partition);
            return variables.map((v) => ({
                key: v.variableName,
                header: v.variableName,
                numeric: v.spssDataType === 'NUMERIC',
            }));
        }

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
            // A synthetic NA-<uuid> placeholder exports as an empty cell.
            taxNumber: [s.company?.taxNumber, s.taxNumber].find(hasRealNiu) ?? null,
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
        detailKey: 'enterpriseDetail' | 'cooperativeDetail' | 'ctdDetail' | 'ongDetail' | 'administrationDetail' | 'projectProgramDetail' | 'vocationalTrainingDetail';
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
            {
                formType: 'ADMINISTRATION',
                title: 'Administrations',
                detailKey: 'administrationDetail',
                columns: [
                    { header: "Nom de l'administration", key: 'name', width: 26 },
                    { header: 'Sigle', key: 'sigle', width: 14 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Mission principale', key: 'mainMission', width: 28 },
                    { header: 'Existence de projet', key: 'hasProject', width: 18 },
                    { header: 'Nombre de projets', key: 'projectCount', width: 16 },
                    { header: 'Structures sous tutelle', key: 'hasSupervisedStructures', width: 20 },
                    { header: 'Nombre de structures sous tutelle', key: 'supervisedStructureCount', width: 22 },
                ],
            },
            {
                formType: 'PROJECT_PROGRAM',
                title: 'Projets et Programmes',
                detailKey: 'projectProgramDetail',
                columns: [
                    { header: 'Nature de la structure', key: 'nature', width: 22 },
                    { header: 'Nom', key: 'name', width: 26 },
                    { header: 'Sigle', key: 'sigle', width: 14 },
                    { header: 'Responsable', key: 'personInCharge', width: 22 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Téléphone 1', key: 'phone1', width: 16 },
                    { header: 'Téléphone 2', key: 'phone2', width: 16 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Secteur', key: 'sector', width: 18 },
                    { header: 'Branche', key: 'branch', width: 18 },
                    { header: 'Mission principale', key: 'mainMission', width: 28 },
                    { header: 'Siège social', key: 'headOffice', width: 20 },
                    { header: 'Ministère de tutelle', key: 'supervisingMinistry', width: 22 },
                    { header: 'Statut du projet / programme', key: 'status', width: 22 },
                    { header: "Motif d'arrêt", key: 'stopReason', width: 20 },
                    { header: 'Effectif permanent', key: 'permanentWorkers', width: 16 },
                    { header: 'Postes vacants', key: 'vacancies', width: 14 },
                ],
            },
            {
                // Flattened Detail columns only here — the 11 statistical
                // OnefopVt* child/fact tables (diplomas, age flows,
                // specialties, infrastructure, etc.) each get their own
                // long-format sheet via BREAKDOWN_SHEET_DEFS below, same as
                // PROJECT_PROGRAM's activities and the shared six-entity fact
                // tables. OnefopVtTrainerRoster (8.8, named individuals) is
                // deliberately not among them — see BREAKDOWN_SHEET_DEFS.
                formType: 'VOCATIONAL_TRAINING',
                title: 'Formation Professionnelle',
                detailKey: 'vocationalTrainingDetail',
                columns: [
                    { header: 'Nom du CFP', key: 'name', width: 26 },
                    { header: 'Sigle', key: 'sigle', width: 14 },
                    { header: 'Type de CFP', key: 'cfpType', width: 18 },
                    { header: 'Statut fonctionnel', key: 'functionalStatus', width: 18 },
                    { header: 'Milieu', key: 'area', width: 12 },
                    { header: 'Commune', key: 'commune', width: 18 },
                    { header: 'Localité', key: 'locality', width: 18 },
                    { header: 'Boîte postale', key: 'poBox', width: 16 },
                    { header: 'Email', key: 'email', width: 22 },
                    { header: 'Année de création', key: 'yearOfEstablishment', width: 16 },
                    { header: 'Nom du promoteur', key: 'promoterName', width: 22 },
                    { header: 'Téléphone promoteur', key: 'promoterPhone1', width: 18 },
                    { header: 'Effectif apprenants déclaré', key: 'totalTraineesDeclared', width: 20 },
                    { header: 'Effectif formateurs déclaré', key: 'totalTrainersDeclared', width: 20 },
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
        filters: OnefopExportFilters,
        res: Response,
        territory?: Territory,
    ): Promise<void> {
        const where = this.buildApprovedOnefopWhere(filters, territory);
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

        // Missing values declaration for numeric variables (-99 convention for non-response/not applicable)
        const numericVarNames = columns
            .map((c, i) => (c.numeric ? varNames[i] : null))
            .filter((n): n is string => Boolean(n));

        const missingValuesBlock = numericVarNames.length > 0
            ? [
                '* Declaration des valeurs manquantes (-99 = Non renseigne / Non applicable).',
                'MISSING VALUES',
                ...this.chunkVariableList(numericVarNames, 8).map((chunk) => `  ${chunk.join(' ')} (-99)`),
                '  .',
                'EXECUTE.',
                '',
              ].join('\n')
            : '';

        // Value labels for standard categorical variables
        const valueLabelsParts: string[] = [];

        const formTypeIdx = columns.findIndex((c) => c.key === 'formType');
        if (formTypeIdx !== -1) {
            valueLabelsParts.push([
                `VALUE LABELS ${varNames[formTypeIdx]}`,
                `  'ENTREPRISE' "Entreprise"`,
                `  'COOPERATIVE' "Cooperative"`,
                `  'CTD' "Collectivite Territoriale Decentralisee"`,
                `  'ONG' "ONG / Association"`,
                `  'ADMINISTRATION' "Administration Publique"`,
                `  'PROJECT_PROGRAM' "Projet / Programme"`,
                `  'VOCATIONAL_TRAINING' "Centre de Formation Professionnelle"`,
                `  .`,
            ].join('\n'));
        }

        const statusIdx = columns.findIndex((c) => c.key === 'status');
        if (statusIdx !== -1) {
            valueLabelsParts.push([
                `VALUE LABELS ${varNames[statusIdx]}`,
                `  'DRAFT' "Brouillon"`,
                `  'PENDING_REVIEW' "En cours d'instruction"`,
                `  'APPROVED' "Vise / Approuve"`,
                `  'REJECTED' "Rejete"`,
                `  'CORRECTION_REQUESTED' "Correction demandee"`,
                `  .`,
            ].join('\n'));
        }

        const regionIdx = columns.findIndex((c) => c.key === 'region');
        if (regionIdx !== -1) {
            valueLabelsParts.push([
                `VALUE LABELS ${varNames[regionIdx]}`,
                `  'ADAMAOUA' "Adamaoua"`,
                `  'CENTRE' "Centre"`,
                `  'EST' "Est"`,
                `  'EXTREME_NORD' "Extreme-Nord"`,
                `  'LITTORAL' "Littoral"`,
                `  'NORD' "Nord"`,
                `  'NORD_OUEST' "Nord-Ouest"`,
                `  'OUEST' "Ouest"`,
                `  'SUD' "Sud"`,
                `  'SUD_OUEST' "Sud-Ouest"`,
                `  .`,
            ].join('\n'));
        }

        const valueLabelsBlock = valueLabelsParts.length > 0
            ? [
                '* Etiquettes de valeurs pour variables categorielles.',
                ...valueLabelsParts,
                'EXECUTE.',
                '',
              ].join('\n')
            : '';

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
            ...(missingValuesBlock ? [missingValuesBlock] : []),
            ...(valueLabelsBlock ? [valueLabelsBlock] : []),
        ].join('\n');
    }

    private chunkVariableList(list: string[], size: number): string[][] {
        const chunks: string[][] = [];
        for (let i = 0; i < list.length; i += size) {
            chunks.push(list.slice(i, i + size));
        }
        return chunks;
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

    async logExport(userId?: string, format = 'UNKNOWN', details?: any) {
        if (!userId) return;
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId,
                    action: 'DATA_EXPORT',
                    resourceType: 'DIFFUSION',
                    resourceId: 'submissions',
                    details: {
                        format,
                        ...(details || {}),
                    },
                },
            });
        } catch {
            // Non-blocking logging
        }
    }

    async getExportHistory(limit = 20) {
        const logs = await this.prisma.auditLog.findMany({
            where: {
                action: 'DATA_EXPORT',
                resourceType: 'DIFFUSION',
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });

        return logs.map((l) => ({
            id: l.id,
            timestamp: l.timestamp,
            format: (l.details as any)?.format || 'EXCEL',
            filters: (l.details as any)?.filters || {},
            user: l.user
                ? {
                    id: l.user.id,
                    email: l.user.email,
                    name: `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.email,
                    role: l.user.role,
                }
                : null,
        }));
    }

}