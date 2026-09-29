// src/data-management/spss/export-filters.ts
//
// Row selection shared by every ONEFOP export (SPSS .sav/.csv/.sps, Excel).
import { BadRequestException } from '@nestjs/common';
import { OnefopEntityType, OnefopStatus } from '../../types/prisma.types';
import {
  DEMAND_SCHEMA_ENTITIES,
  SCHEMA_TO_PRISMA_ENTITY,
  type AnalyticalPartition,
} from '../canonical-schema-adapter.service';

export interface OnefopExportFilters {
  region?: string;
  department?: string;
  year?: number | string;
  fromDate?: string;
  toDate?: string;
  partition?: AnalyticalPartition;
  entityType?: string;
  /**
   * Administrative statuses to include — comma-separated (query string) or an
   * array (JSON body). Omitted = the official statistical base: APPROVED with
   * no open blocking anomaly (EligibilityEngineService).
   */
  statuses?: string | string[];
}

const KNOWN_STATUSES = new Set<string>(Object.values(OnefopStatus));
const KNOWN_ENTITY_TYPES = new Set<string>(Object.values(OnefopEntityType));
export const DEMAND_FORM_TYPES: string[] = DEMAND_SCHEMA_ENTITIES.map((e) => SCHEMA_TO_PRISMA_ENTITY[e]);
export const TVET_FORM_TYPE = 'VOCATIONAL_TRAINING';

export function parseStatuses(raw: OnefopExportFilters['statuses']): string[] {
  const list = (Array.isArray(raw) ? raw : (raw ?? '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);
  for (const s of list) {
    if (!KNOWN_STATUSES.has(s)) throw new BadRequestException(`Statut inconnu : ${s}`);
  }
  return Array.from(new Set(list));
}

/**
 * Prisma `where` for the export rows. `eligibilityWhere` is the official
 * statistical-base predicate, used only when no status is requested.
 */
export function buildOnefopExportWhere(filters: OnefopExportFilters, eligibilityWhere: object): any {
  const statuses = parseStatuses(filters.statuses);
  const where: any = statuses.length > 0 ? { status: { in: statuses } } : { ...eligibilityWhere };

  if (filters.entityType) {
    if (!KNOWN_ENTITY_TYPES.has(filters.entityType)) {
      throw new BadRequestException(`Type d'entité inconnu : ${filters.entityType}`);
    }
    where.formType = filters.entityType;
  }
  if (filters.region) where.region = { equals: filters.region, mode: 'insensitive' };
  if (filters.department) where.department = { equals: filters.department, mode: 'insensitive' };
  if (filters.year) {
    const year = Number(filters.year);
    if (!Number.isInteger(year)) throw new BadRequestException(`Année invalide : ${filters.year}`);
    where.surveyYear = year;
  }
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
    if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
  }
  return where;
}

/**
 * The demand questionnaire (entities 1–6) and the vocational-training one
 * (entity 7) have different variables, so one SPSS file holds one partition:
 * an explicit entity type decides it, otherwise `partition` (default DEMAND).
 */
export function resolveExportPartition(filters: OnefopExportFilters): AnalyticalPartition {
  if (filters.entityType) {
    if (filters.entityType === TVET_FORM_TYPE) return 'TVET';
    if (filters.partition === 'TVET') {
      throw new BadRequestException(
        `Le type ${filters.entityType} ne relève pas du questionnaire formation professionnelle.`,
      );
    }
    return filters.partition === 'ALL' ? 'ALL' : 'DEMAND';
  }
  if (filters.partition === 'TVET' || filters.partition === 'ALL') return filters.partition;
  return 'DEMAND';
}

/** Export `where` plus the rows restriction matching the partition's variables. */
export function buildSpssExportWhere(filters: OnefopExportFilters, eligibilityWhere: object): any {
  const where = buildOnefopExportWhere(filters, eligibilityWhere);
  if (!where.formType) {
    const partition = resolveExportPartition(filters);
    if (partition === 'DEMAND') where.formType = { in: DEMAND_FORM_TYPES };
    else if (partition === 'TVET') where.formType = TVET_FORM_TYPE;
  }
  return where;
}
