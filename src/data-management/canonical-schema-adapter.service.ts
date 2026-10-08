// src/data-management/canonical-schema-adapter.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import type {
  EntitySchema,
  OnefopSchemaRoot,
  SchemaEntityType,
  SchemaField,
  SchemaOption,
  SchemaSection,
} from '../onefop-schema-validation/onefop-schema.types';
import { OnefopEntityType } from '../types/prisma.types';
import { hasRealNiu } from './niu';
import { CANONICAL_PII_EXCLUSIONS } from './canonical-exclusions';

export type MeasurementLevel = 'NOMINAL' | 'ORDINAL' | 'SCALE' | 'DATE';
export type SpssDataType = 'NUMERIC' | 'A';

export interface AnalyticalVariableDefinition {
  variableName: string;
  paperCode: string;
  labelFr: string;
  labelEn: string;
  sectionId: string;
  entityApplicability: string[];
  spssDataType: SpssDataType;
  spssWidth: number;
  measurementLevel: MeasurementLevel;
  valueLabels?: Record<string, string>;
  sourcePath: string;
  orderIndex: number;
}

export type AnalyticalPartition = 'DEMAND' | 'TVET' | 'ALL';

export const DEMAND_SCHEMA_ENTITIES: SchemaEntityType[] = [
  'enterprise',
  'cooperative',
  'ctd',
  'ong',
  'administration',
  'projectProgram',
];

export const TVET_SCHEMA_ENTITIES: SchemaEntityType[] = [
  'vocationalTraining',
];

export const CANONICAL_ENTITY_PRIORITY: SchemaEntityType[] = [
  'enterprise',
  'cooperative',
  'ctd',
  'ong',
  'administration',
  'projectProgram',
  'vocationalTraining',
];

export const SCHEMA_TO_PRISMA_ENTITY: Record<SchemaEntityType, OnefopEntityType> = {
  enterprise: 'ENTREPRISE' as OnefopEntityType,
  cooperative: 'COOPERATIVE' as OnefopEntityType,
  ctd: 'CTD' as OnefopEntityType,
  ong: 'ONG' as OnefopEntityType,
  administration: 'ADMINISTRATION' as OnefopEntityType,
  projectProgram: 'PROJECT_PROGRAM' as OnefopEntityType,
  vocationalTraining: 'VOCATIONAL_TRAINING' as OnefopEntityType,
};

export const PRISMA_TO_SCHEMA_ENTITY: Record<string, SchemaEntityType> = {
  ENTREPRISE: 'enterprise',
  COOPERATIVE: 'cooperative',
  CTD: 'ctd',
  ONG: 'ong',
  ADMINISTRATION: 'administration',
  PROJECT_PROGRAM: 'projectProgram',
  VOCATIONAL_TRAINING: 'vocationalTraining',
};

// Reserved SPSS Keywords that cannot be variable names
const SPSS_RESERVED_WORDS = new Set([
  'ALL', 'AND', 'BY', 'EQ', 'GE', 'GT', 'LE', 'LT', 'NE', 'NOT', 'OR', 'TO', 'WITH',
]);

// Whitelist of questions/variables with natural ordinal hierarchy
const ORDINAL_WHITELIST_KEYWORDS = [
  'enterprisesize',
  'size',
  'taille',
  'diploma',
  'diplome',
  'educationlevel',
  'education_level',
  'ageband',
  'age_band',
  'tranche_d_age',
  'tranche d_age',
];

@Injectable()
export class CanonicalSchemaAdapterService {
  private readonly logger = new Logger(CanonicalSchemaAdapterService.name);

  // Cached deterministic registries
  private cachedAllVariables: AnalyticalVariableDefinition[] | null = null;
  private cachedDemandVariables: AnalyticalVariableDefinition[] | null = null;
  private cachedTvetVariables: AnalyticalVariableDefinition[] | null = null;
  private cachedByEntity = new Map<string, AnalyticalVariableDefinition[]>();

  constructor(private readonly schemaLoader: OnefopSchemaLoaderService) {}

  /**
   * Generates a valid, deterministic, collision-safe SPSS variable name.
   * - <= 64 characters
   * - Starts with a letter or @
   * - Contains only alphanumeric characters and underscores
   * - Not a reserved SPSS keyword
   * - Does not end with an underscore or dot
   */
  public generateSpssVariableName(rawId: string, usedNames?: Set<string>): string {
    const used = usedNames ?? new Set<string>();

    // 1. Strip accents and punctuation via Unicode NFD
    let clean = rawId
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+/, '');

    // 2. Must start with a letter (or @)
    if (!clean || /^[0-9]/.test(clean)) {
      clean = `V_${clean}`;
    }

    // 3. Remove trailing underscores
    clean = clean.replace(/_+$/, '');

    // 4. SPSS reserved words
    if (SPSS_RESERVED_WORDS.has(clean.toUpperCase())) {
      clean = `${clean}_VAR`;
    }

    // 5. Enforce 64-char limit (leave 4 chars for collision suffix e.g. _999)
    if (clean.length > 60) {
      clean = clean.slice(0, 60).replace(/_+$/, '');
    }

    // 6. Collision-safe deduplication
    let finalName = clean;
    let counter = 2;
    while (used.has(finalName.toUpperCase())) {
      const suffix = `_${counter++}`;
      const prefixLimit = 64 - suffix.length;
      finalName = `${clean.slice(0, prefixLimit)}${suffix}`;
    }

    used.add(finalName.toUpperCase());
    return finalName;
  }

  /**
   * Returns all analytical variables across all sections and entities.
   */
  public getAllVariables(): AnalyticalVariableDefinition[] {
    if (this.cachedAllVariables) return this.cachedAllVariables;
    this.buildRegistries();
    return this.cachedAllVariables!;
  }

  /**
   * Returns analytical variables for the DEMAND partition (Entities 1 to 6).
   */
  public getDemandVariables(): AnalyticalVariableDefinition[] {
    if (this.cachedDemandVariables) return this.cachedDemandVariables;
    this.buildRegistries();
    return this.cachedDemandVariables!;
  }

  /**
   * Returns analytical variables for the TVET partition (Entity 7 / Vocational Training).
   */
  public getTvetVariables(): AnalyticalVariableDefinition[] {
    if (this.cachedTvetVariables) return this.cachedTvetVariables;
    this.buildRegistries();
    return this.cachedTvetVariables!;
  }

  /**
   * Returns analytical variables for a given partition ('DEMAND' | 'TVET' | 'ALL').
   */
  public getVariablesForPartition(partition: AnalyticalPartition): AnalyticalVariableDefinition[] {
    switch (partition) {
      case 'DEMAND':
        return this.getDemandVariables();
      case 'TVET':
        return this.getTvetVariables();
      case 'ALL':
      default:
        return this.getAllVariables();
    }
  }

  /**
   * Returns analytical variables applicable to a specific entity type.
   */
  public getVariablesForEntity(entityType: SchemaEntityType | OnefopEntityType | string): AnalyticalVariableDefinition[] {
    const key = PRISMA_TO_SCHEMA_ENTITY[entityType] ?? (entityType as SchemaEntityType);
    const cached = this.cachedByEntity.get(key);
    if (cached) return cached;

    const all = this.getAllVariables();
    const filtered = all.filter(
      (v) => v.entityApplicability.includes('ALL') || v.entityApplicability.includes(key),
    );
    this.cachedByEntity.set(key, filtered);
    return filtered;
  }

  /**
   * Extracts the value of a given analytical variable from a hydrated submission.
   */
  public extractValue(v: AnalyticalVariableDefinition, submission: any): unknown {
    if (!submission) return undefined;

    const sp = v.sourcePath;

    // 0. System constants / metadata
    if (sp === 'system.schemaVersion' || sp === 'submission.schemaVersion') {
      return submission.schemaVersion !== undefined
        ? submission.schemaVersion
        : (Object.keys(submission).length === 0 ? undefined : 2);
    }

    // 1. Direct system variable paths
    if (sp.startsWith('submission.')) {
      const prop = sp.slice('submission.'.length);
      const value = submission[prop];
      // A synthetic NA-<uuid> placeholder exports as missing, not as a NIU.
      if (prop === 'taxNumber' && typeof value === 'string' && !hasRealNiu(value)) return null;
      return value;
    }
    if (sp.startsWith('company.')) {
      const prop = sp.slice('company.'.length);
      return submission.company?.[prop];
    }

    // 2. Respondent Section 0
    if (sp.startsWith('respondent.')) {
      const prop = sp.slice('respondent.'.length);
      const resp = submission.respondent;
      if (resp) {
        if (prop === 'name') return resp.respondentName;
        if (prop === 'function') return resp.respondentFunction;
        if (prop === 'phone1') return resp.phone1;
        if (prop === 'phone2') return resp.phone2;
        if (prop === 'email') return resp.email;
        if (resp[prop] !== undefined) return resp[prop];
      }
      return submission.rawData?.respondent?.[prop];
    }

    // 3. Section 1 Detail Entities
    if (sp.startsWith('detail.')) {
      // e.g. detail.enterprise.legalStatus
      const parts = sp.split('.');
      const entity = parts[1]; // enterprise, cooperative, etc.
      const prop = parts[2];
      const normalizedEntity = entity === 'entreprise' ? 'enterprise' : entity;
      const detailKey = `${normalizedEntity}Detail`;
      const detailObj = submission[detailKey];
      if (detailObj) {
        if (detailObj[prop] !== undefined) return detailObj[prop];
        if (prop === 'name' && detailObj.companyName !== undefined) return detailObj.companyName;
        if (prop === 'name' && detailObj.cooperativeName !== undefined) return detailObj.cooperativeName;
        if (prop === 'name' && detailObj.ongName !== undefined) return detailObj.ongName;
        if (prop === 'size' && detailObj.enterpriseSize !== undefined) return detailObj.enterpriseSize;
      }
      return submission.rawData?.[entity]?.[prop] ?? submission.rawData?.[normalizedEntity]?.[prop];
    }


    // 4. Matrix cells
    if (sp.startsWith('matrix.')) {
      const parts = sp.split('.');
      const tableId = parts[1];
      const cellId = parts[2];

      // Check flat rawData first if populated
      if (submission.rawData && submission.rawData[cellId] !== undefined) {
        const rawVal = submission.rawData[cellId];
        if (v.spssDataType === 'NUMERIC' && typeof rawVal === 'boolean') {
          return rawVal ? 1 : 0;
        }
        return rawVal;
      }

      // Check child table relation in Prisma
      const childValue = this.extractMatrixValueFromRelations(tableId, cellId, submission);
      if (childValue !== undefined) return childValue;

      return undefined;
    }

    // 5. Fixed Indexed slots (reasons, skills, training needs)
    if (sp.startsWith('indexed.')) {
      const parts = sp.split('.');
      const template = parts[1];
      const slot = parseInt(parts[2], 10);
      const field = parts[3]; // desc, male, female, total

      return this.extractIndexedValueFromRelations(template, slot, field, submission);
    }

    // 6. General fallback: rawData by variable ID / sourcePath with nested dot-traversal
    if (submission.rawData) {
      if (submission.rawData[v.variableName] !== undefined) return submission.rawData[v.variableName];
      if (submission.rawData[v.variableName.toLowerCase()] !== undefined) return submission.rawData[v.variableName.toLowerCase()];
      if (v.paperCode && submission.rawData[v.paperCode] !== undefined) return submission.rawData[v.paperCode];
      if (v.paperCode && submission.rawData[v.paperCode.toLowerCase()] !== undefined) return submission.rawData[v.paperCode.toLowerCase()];
      const nested = this.getNestedValue(submission.rawData, sp);
      if (nested !== undefined) return nested;
    }

    return undefined;
  }

  /**
   * Resolves a value from an object via a dot-delimited path or direct property key.
   * Supports arbitrary nested paths (e.g. 'responseStatus.S21Q01' or 'a.b.c')
   * while preserving direct property lookup when the key contains a dot.
   */
  public getNestedValue(obj: any, path: string): unknown {
    if (!obj || typeof obj !== 'object' || !path) return undefined;
    // 1. Direct property match takes precedence
    if (obj[path] !== undefined) return obj[path];
    if (!path.includes('.')) return undefined;

    // 2. Dot-delimited traversal
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  /**
   * Generates SPSS syntax (.sps) from an analytical variable list and target CSV filename.
   */
  public buildSpssSyntax(variables: AnalyticalVariableDefinition[], csvFilename: string): string {
    const varNames = variables.map((v) => v.variableName);
    const formats = variables.map((v) => (v.spssDataType === 'NUMERIC' ? `F${v.spssWidth}.0` : `A${v.spssWidth}`));

    const variableLines = varNames.map((name, i) => `  ${name} ${formats[i]}`).join('\n');
    const labelLines = variables
      .map((v) => `  ${v.variableName} '${this.spssQuote(v.labelFr)}'`)
      .join('\n');

    // Missing values declaration for numeric variables (-99 convention)
    const numericVarNames = variables
      .filter((v) => v.spssDataType === 'NUMERIC')
      .map((v) => v.variableName);

    const missingValuesBlock = numericVarNames.length > 0
      ? [
          '* Declaration des valeurs manquantes (-99 = Non renseigne / Non applicable).',
          'MISSING VALUES',
          ...this.chunkList(numericVarNames, 8).map((chunk) => `  ${chunk.join(' ')} (-99)`),
          '  .',
          'EXECUTE.',
          '',
        ].join('\n')
      : '';

    // Value labels for categorical variables
    const valueLabelsParts: string[] = [];
    for (const v of variables) {
      if (v.valueLabels && Object.keys(v.valueLabels).length > 0) {
        const lines: string[] = [`VALUE LABELS ${v.variableName}`];
        for (const [code, label] of Object.entries(v.valueLabels)) {
          if (v.spssDataType === 'NUMERIC') {
            lines.push(`  ${code} "${this.spssQuote(label)}"`);
          } else {
            lines.push(`  '${this.spssQuote(code)}' "${this.spssQuote(label)}"`);
          }
        }
        lines.push('  .');
        valueLabelsParts.push(lines.join('\n'));
      }
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
      '* Généré par DSMO — Registre Analytique Canonique ONEFOP.',
      `* Placez ce fichier dans le même dossier que "${csvFilename}", puis exécutez-le`,
      '* entièrement (Exécuter > Tout) dans SPSS pour charger les données étiquetées.',
      '',
      'GET DATA',
      '  /TYPE=TXT',
      `  /FILE='${this.spssQuote(csvFilename)}'`,
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

  // ── Private Internal Builder ──────────────────────────────────────────────

  /**
   * Derives the analytical section sequence dynamically from the canonical schema root:
   * 1. Collect sections across entities in order of canonical entity priority.
   * 2. Deduplicate by section ID.
   * 3. Sort by canonical section order (sec.order).
   * 4. Apply deterministic entity priority tie-breaker when orders are equal.
   */
  public deriveCanonicalSectionOrder(root: OnefopSchemaRoot): string[] {
    const sectionsById = new Map<string, { id: string; order: number; entityPriority: number }>();

    for (let entityIdx = 0; entityIdx < CANONICAL_ENTITY_PRIORITY.length; entityIdx++) {
      const entityKey = CANONICAL_ENTITY_PRIORITY[entityIdx];
      const entity = root.entities[entityKey];
      if (!entity) continue;

      for (const sec of entity.sections) {
        if (!sectionsById.has(sec.id)) {
          sectionsById.set(sec.id, {
            id: sec.id,
            order: sec.order,
            entityPriority: entityIdx,
          });
        }
      }
    }

    const sorted = Array.from(sectionsById.values()).sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.entityPriority - b.entityPriority;
    });

    return sorted.map((s) => s.id);
  }

  private buildRegistries(): void {
    const root = this.schemaLoader.getRoot();
    const usedNames = new Set<string>();
    const allVars: AnalyticalVariableDefinition[] = [];

    let orderIndex = 1;

    // 1. SYSTEM VARIABLES (applicable to all entities)
    const systemDefs = this.buildSystemVariables(usedNames, orderIndex);
    allVars.push(...systemDefs);
    orderIndex += systemDefs.length;

    // 2. QUESTIONNAIRE SECTIONS IN CANONICAL ORDER (DERIVED DYNAMICALLY)
    const canonicalSectionIds = this.deriveCanonicalSectionOrder(root);

    const visitedFieldIds = new Set<string>();
    const visitedCellIds = new Set<string>();

    for (const secId of canonicalSectionIds) {
      // Find sections across entities matching secId
      for (const [entityName, entity] of Object.entries(root.entities)) {
        const sec = entity.sections.find((s) => s.id === secId);
        if (!sec) continue;

        for (const field of sec.fields) {
          if (CANONICAL_PII_EXCLUSIONS.has(field.id)) {
            continue;
          }
          if (field.table?.matrix && field.table.matrix.length > 0) {
            const tableVars = this.expandMatrixTable(field, sec, usedNames, orderIndex, visitedCellIds, root);
            allVars.push(...tableVars);
            orderIndex += tableVars.length;
          } else {
            if (visitedFieldIds.has(field.id)) continue;
            visitedFieldIds.add(field.id);

            const applicability = this.findFieldApplicability(field.id, root);

            // Handle tables vs scalar fields
            if (field.table) {
              const tableVars = this.expandTable(field, sec, applicability, usedNames, orderIndex);
              allVars.push(...tableVars);
              orderIndex += tableVars.length;
            } else if (field.type !== 'repeating_table') {
              const scalarVar = this.createScalarVariable(field, sec, applicability, usedNames, orderIndex++);
              allVars.push(scalarVar);
            }
          }
        }
      }
    }

    this.cachedAllVariables = allVars;

    // Build Demand partition (Entities 1 to 6)
    const demandEntitySet = new Set(DEMAND_SCHEMA_ENTITIES);
    this.cachedDemandVariables = allVars.filter(
      (v) => v.entityApplicability.includes('ALL') || v.entityApplicability.some((e) => demandEntitySet.has(e as SchemaEntityType)),
    );

    // Build TVET partition (Entity 7)
    this.cachedTvetVariables = allVars.filter(
      (v) => v.entityApplicability.includes('ALL') || v.entityApplicability.includes('vocationalTraining'),
    );

    this.logger.log(
      `Canonical Analytical Registry built: ${allVars.length} total variables ` +
      `(${this.cachedDemandVariables.length} Demand, ${this.cachedTvetVariables.length} TVET)`,
    );
  }

  private buildSystemVariables(usedNames: Set<string>, startOrder: number): AnalyticalVariableDefinition[] {
    const sys: Array<Omit<AnalyticalVariableDefinition, 'orderIndex' | 'variableName'> & { rawName: string }> = [
      {
        rawName: 'schemaVersion',
        paperCode: 'SYS_00',
        labelFr: 'Version du schéma du jeu de données',
        labelEn: 'Dataset schema version',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'NUMERIC',
        spssWidth: 4,
        measurementLevel: 'SCALE',
        sourcePath: 'system.schemaVersion',
      },
      {
        rawName: 'submissionId',
        paperCode: 'SYS_01',
        labelFr: 'N° de soumission',
        labelEn: 'Submission ID',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        // Not only UUIDs: quarterly IDs look like
        // ONEFOP_EN26000300_QUARTERLY_2026_T3_<suffix> and were being cut at 36.
        spssWidth: 80,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.submissionId',
      },
      {
        rawName: 'status',
        paperCode: 'SYS_02',
        labelFr: 'Statut de la soumission',
        labelEn: 'Submission status',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 20,
        measurementLevel: 'NOMINAL',
        valueLabels: {
          DRAFT: 'Brouillon',
          PENDING_REVIEW: "En cours d'instruction",
          APPROVED: 'Visé / Approuvé',
          REJECTED: 'Rejeté',
          CORRECTION_REQUESTED: 'Correction demandée',
        },
        sourcePath: 'submission.status',
      },
      {
        rawName: 'surveyYear',
        paperCode: 'SYS_03',
        labelFr: "Année d'enquête",
        labelEn: 'Survey year',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'NUMERIC',
        spssWidth: 4,
        measurementLevel: 'SCALE',
        sourcePath: 'submission.surveyYear',
      },
      {
        rawName: 'quarterCode',
        paperCode: 'SYS_04',
        labelFr: 'Trimestre',
        labelEn: 'Quarter code',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        // Values include QUARTERLY_2026_T3, not only 2025-T1 (was cut at 10).
        spssWidth: 32,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.quarterCode',
      },
      {
        rawName: 'formType',
        paperCode: 'SYS_05',
        labelFr: "Type d'entité",
        labelEn: 'Entity form type',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 25,
        measurementLevel: 'NOMINAL',
        valueLabels: {
          ENTREPRISE: 'Entreprise',
          COOPERATIVE: 'Coopérative',
          CTD: 'Collectivité Territoriale Décentralisée',
          ONG: 'ONG / Association',
          ADMINISTRATION: 'Administration Publique',
          PROJECT_PROGRAM: 'Projet / Programme',
          VOCATIONAL_TRAINING: 'Centre de Formation Professionnelle',
        },
        sourcePath: 'submission.formType',
      },
      {
        rawName: 'companyName',
        paperCode: 'SYS_06',
        labelFr: 'Entreprise (fiche)',
        labelEn: 'Company name (record)',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 100,
        measurementLevel: 'NOMINAL',
        sourcePath: 'company.name',
      },
      {
        rawName: 'taxNumber',
        paperCode: 'SYS_07',
        labelFr: 'N° contribuable',
        labelEn: 'Taxpayer number',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 25,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.taxNumber',
      },
      {
        rawName: 'establishmentId',
        paperCode: 'SYS_08',
        labelFr: 'ID établissement',
        labelEn: 'Establishment ID',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 25,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.establishmentId',
      },
      {
        rawName: 'region',
        paperCode: 'SYS_09',
        labelFr: 'Région',
        labelEn: 'Region',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 20,
        measurementLevel: 'NOMINAL',
        valueLabels: {
          ADAMAOUA: 'Adamaoua',
          CENTRE: 'Centre',
          EST: 'Est',
          EXTREME_NORD: 'Extrême-Nord',
          LITTORAL: 'Littoral',
          NORD: 'Nord',
          NORD_OUEST: 'Nord-Ouest',
          OUEST: 'Ouest',
          SUD: 'Sud',
          SUD_OUEST: 'Sud-Ouest',
        },
        sourcePath: 'submission.region',
      },
      {
        rawName: 'department',
        paperCode: 'SYS_10',
        labelFr: 'Département',
        labelEn: 'Department',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 50,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.department',
      },
      {
        rawName: 'subdivision',
        paperCode: 'SYS_11',
        labelFr: 'Arrondissement',
        labelEn: 'Subdivision',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 50,
        measurementLevel: 'NOMINAL',
        sourcePath: 'submission.subdivision',
      },
      {
        rawName: 'submissionDate',
        paperCode: 'SYS_12',
        labelFr: 'Date de soumission',
        labelEn: 'Submission date',
        sectionId: 'system',
        entityApplicability: ['ALL'],
        spssDataType: 'A',
        spssWidth: 10,
        measurementLevel: 'DATE',
        sourcePath: 'submission.submissionDate',
      },
    ];

    let order = startOrder;
    return sys.map((s) => ({
      variableName: this.generateSpssVariableName(s.rawName, usedNames),
      paperCode: s.paperCode,
      labelFr: s.labelFr,
      labelEn: s.labelEn,
      sectionId: s.sectionId,
      entityApplicability: s.entityApplicability,
      spssDataType: s.spssDataType,
      spssWidth: s.spssWidth,
      measurementLevel: s.measurementLevel,
      valueLabels: s.valueLabels,
      sourcePath: s.sourcePath,
      orderIndex: order++,
    }));
  }

  private createScalarVariable(
    field: SchemaField,
    sec: SchemaSection,
    applicability: string[],
    usedNames: Set<string>,
    orderIndex: number,
  ): AnalyticalVariableDefinition {
    const measurementLevel = this.determineMeasurementLevel(field);
    const spssDataType: SpssDataType = measurementLevel === 'SCALE' ? 'NUMERIC' : 'A';
    const spssWidth = spssDataType === 'NUMERIC' ? 10 : 254;

    const valueLabels = this.extractValueLabels(field.options);
    const variableName = this.generateSpssVariableName(field.id, usedNames);

    let sourcePath = field.path;
    if (sec.id === 'section0') {
      const prop = field.path.includes('.') ? field.path.split('.')[1] : field.path;
      sourcePath = `respondent.${prop}`;
    } else if (sec.id.startsWith('section1_')) {
      const parts = field.path.split('.');
      const entity = parts.length > 1 ? parts[0] : sec.id.replace('section1_', '');
      const prop = parts.length > 1 ? parts[1] : field.path;
      const normalizedEntity = entity === 'entreprise' ? 'enterprise' : entity;
      sourcePath = `detail.${normalizedEntity}.${prop}`;
    }


    return {
      variableName,
      paperCode: field.paperCode ?? field.id,
      labelFr: field.label.fr,
      labelEn: field.label.en,
      sectionId: sec.id,
      entityApplicability: applicability,
      spssDataType,
      spssWidth,
      measurementLevel,
      valueLabels,
      sourcePath,
      orderIndex,
    };
  }

  private expandMatrixTable(
    field: SchemaField,
    sec: SchemaSection,
    usedNames: Set<string>,
    startOrder: number,
    visitedCellIds: Set<string>,
    root: OnefopSchemaRoot,
  ): AnalyticalVariableDefinition[] {
    const table = field.table!;
    const vars: AnalyticalVariableDefinition[] = [];
    let order = startOrder;

    for (let r = 0; r < table.matrix!.length; r++) {
      const row = table.matrix![r];
      for (let c = 0; c < row.length; c++) {
        const cellId = row[c];
        if (visitedCellIds.has(cellId)) continue;
        visitedCellIds.add(cellId);

        const varName = this.generateSpssVariableName(cellId, usedNames);
        const applicability = this.findMatrixCellApplicability(field.id, cellId, root);

        let cellLabelFr = `${field.label.fr} [${cellId}]`;
        let cellLabelEn = `${field.label.en} [${cellId}]`;

        let spssDataType: SpssDataType = 'NUMERIC';
        let spssWidth = 10;
        let measurementLevel: MeasurementLevel = 'SCALE';
        let valueLabels: Record<string, string> | undefined = undefined;

        // If rich VT metadata is available, build exact bilingual row/column labels
        if (table.vt && table.vt.rows && table.vt.cells) {
          const vtRow = table.vt.rows[r];
          const vtCell = table.vt.cells[c];
          if (vtRow && vtCell) {
            const rowLabelFr = vtRow.label?.fr ?? vtRow.id ?? `Ligne ${r + 1}`;
            const rowLabelEn = vtRow.label?.en ?? vtRow.id ?? `Row ${r + 1}`;
            const cellLabelTextFr = vtCell.label?.fr ?? vtCell.key ?? `Col ${c + 1}`;
            const cellLabelTextEn = vtCell.label?.en ?? vtCell.key ?? `Col ${c + 1}`;
            const titleFr = table.vt.title?.fr ?? field.label.fr;
            const titleEn = table.vt.title?.en ?? field.label.en;
            cellLabelFr = `${titleFr} — ${rowLabelFr} — ${cellLabelTextFr}`;
            cellLabelEn = `${titleEn} — ${rowLabelEn} — ${cellLabelTextEn}`;

            if (vtCell.kind === 'text') {
              spssDataType = 'A';
              spssWidth = 120;
              measurementLevel = 'NOMINAL';
            } else if (vtCell.kind === 'boolean') {
              spssDataType = 'NUMERIC';
              spssWidth = 1;
              measurementLevel = 'NOMINAL';
              valueLabels = { '0': 'Non / No', '1': 'Oui / Yes' };
            } else if (vtCell.kind === 'radioCode') {
              spssDataType = 'A';
              spssWidth = 20;
              measurementLevel = 'NOMINAL';
              if (vtCell.options && vtCell.options.length > 0) {
                valueLabels = {};
                for (const opt of vtCell.options) {
                  valueLabels[opt.value] = opt.label?.fr ?? opt.value;
                }
              }
            }
          }
        }

        vars.push({
          variableName: varName,
          paperCode: field.paperCode ?? field.id,
          labelFr: cellLabelFr.slice(0, 256),
          labelEn: cellLabelEn.slice(0, 256),
          sectionId: sec.id,
          entityApplicability: applicability,
          spssDataType,
          spssWidth,
          measurementLevel,
          valueLabels,
          sourcePath: `matrix.${field.id}.${cellId}`,
          orderIndex: order++,
        });
      }
    }
    return vars;
  }

  private expandTable(
    field: SchemaField,
    sec: SchemaSection,
    applicability: string[],
    usedNames: Set<string>,
    startOrder: number,
  ): AnalyticalVariableDefinition[] {
    const table = field.table!;
    const vars: AnalyticalVariableDefinition[] = [];
    let order = startOrder;

    // A. Matrix tables with explicit matrix grid
    if (table.matrix && table.matrix.length > 0) {
      for (let r = 0; r < table.matrix.length; r++) {
        const row = table.matrix[r];
        for (let c = 0; c < row.length; c++) {
          const cellId = row[c];
          const varName = this.generateSpssVariableName(cellId, usedNames);

          let cellLabelFr = `${field.label.fr} [${cellId}]`;
          let cellLabelEn = `${field.label.en} [${cellId}]`;

          let spssDataType: SpssDataType = 'NUMERIC';
          let spssWidth = 10;
          let measurementLevel: MeasurementLevel = 'SCALE';
          let valueLabels: Record<string, string> | undefined = undefined;

          // If rich VT metadata is available, build exact bilingual row/column labels
          if (table.vt && table.vt.rows && table.vt.cells) {
            const vtRow = table.vt.rows[r];
            const vtCell = table.vt.cells[c];
            if (vtRow && vtCell) {
              const rowLabelFr = vtRow.label?.fr ?? vtRow.id ?? `Ligne ${r + 1}`;
              const rowLabelEn = vtRow.label?.en ?? vtRow.id ?? `Row ${r + 1}`;
              const cellLabelTextFr = vtCell.label?.fr ?? vtCell.key ?? `Col ${c + 1}`;
              const cellLabelTextEn = vtCell.label?.en ?? vtCell.key ?? `Col ${c + 1}`;
              const titleFr = table.vt.title?.fr ?? field.label.fr;
              const titleEn = table.vt.title?.en ?? field.label.en;
              cellLabelFr = `${titleFr} — ${rowLabelFr} — ${cellLabelTextFr}`;
              cellLabelEn = `${titleEn} — ${rowLabelEn} — ${cellLabelTextEn}`;

              if (vtCell.kind === 'text') {
                spssDataType = 'A';
                spssWidth = 120;
                measurementLevel = 'NOMINAL';
              } else if (vtCell.kind === 'boolean') {
                spssDataType = 'NUMERIC';
                spssWidth = 1;
                measurementLevel = 'NOMINAL';
                valueLabels = { '0': 'Non / No', '1': 'Oui / Yes' };
              } else if (vtCell.kind === 'radioCode') {
                spssDataType = 'A';
                spssWidth = 20;
                measurementLevel = 'NOMINAL';
                if (vtCell.options && vtCell.options.length > 0) {
                  valueLabels = {};
                  for (const opt of vtCell.options) {
                    valueLabels[opt.value] = opt.label?.fr ?? opt.value;
                  }
                }
              }
            }
          }

          vars.push({
            variableName: varName,
            paperCode: field.paperCode ?? field.id,
            labelFr: cellLabelFr.slice(0, 256),
            labelEn: cellLabelEn.slice(0, 256),
            sectionId: sec.id,
            entityApplicability: applicability,
            spssDataType,
            spssWidth,
            measurementLevel,
            valueLabels,
            sourcePath: `matrix.${field.id}.${cellId}`,
            orderIndex: order++,
          });
        }
      }
      return vars;
    }

    // B. Fixed indexed tables (reasons, skills, training needs) with rowCapacity
    if (table.rowCapacity && ['reasons_table', 'skills_table', 'training_table'].includes(table.template)) {
      for (let slot = 1; slot <= table.rowCapacity; slot++) {
        // Description
        vars.push({
          variableName: this.generateSpssVariableName(`${field.id}_SLOT${slot}_DESC`, usedNames),
          paperCode: field.paperCode ?? field.id,
          labelFr: `${field.label.fr} — N° ${slot} (Description)`,
          labelEn: `${field.label.en} — N° ${slot} (Description)`,
          sectionId: sec.id,
          entityApplicability: applicability,
          spssDataType: 'A',
          spssWidth: 254,
          measurementLevel: 'NOMINAL',
          sourcePath: `indexed.${table.template}.${slot}.desc`,
          orderIndex: order++,
        });
        // Hommes
        vars.push({
          variableName: this.generateSpssVariableName(`${field.id}_SLOT${slot}_H`, usedNames),
          paperCode: field.paperCode ?? field.id,
          labelFr: `${field.label.fr} — N° ${slot} (Hommes)`,
          labelEn: `${field.label.en} — N° ${slot} (Men)`,
          sectionId: sec.id,
          entityApplicability: applicability,
          spssDataType: 'NUMERIC',
          spssWidth: 10,
          measurementLevel: 'SCALE',
          sourcePath: `indexed.${table.template}.${slot}.male`,
          orderIndex: order++,
        });
        // Femmes
        vars.push({
          variableName: this.generateSpssVariableName(`${field.id}_SLOT${slot}_F`, usedNames),
          paperCode: field.paperCode ?? field.id,
          labelFr: `${field.label.fr} — N° ${slot} (Femmes)`,
          labelEn: `${field.label.en} — N° ${slot} (Women)`,
          sectionId: sec.id,
          entityApplicability: applicability,
          spssDataType: 'NUMERIC',
          spssWidth: 10,
          measurementLevel: 'SCALE',
          sourcePath: `indexed.${table.template}.${slot}.female`,
          orderIndex: order++,
        });
        // Total
        vars.push({
          variableName: this.generateSpssVariableName(`${field.id}_SLOT${slot}_TOTAL`, usedNames),
          paperCode: field.paperCode ?? field.id,
          labelFr: `${field.label.fr} — N° ${slot} (Total)`,
          labelEn: `${field.label.en} — N° ${slot} (Total)`,
          sectionId: sec.id,
          entityApplicability: applicability,
          spssDataType: 'NUMERIC',
          spssWidth: 10,
          measurementLevel: 'SCALE',
          sourcePath: `indexed.${table.template}.${slot}.total`,
          orderIndex: order++,
        });
      }
      return vars;
    }

    // C. PP_S2_ACTIVITIES (activities_table) — bounded repeating table, max 13 rows.
    // Wide-pivoted into the main .sav: one block of 6 columns per slot (01–13).
    // System-missing for all non-PROJECT_PROGRAM submissions.
    if (table.rowCapacity && table.template === 'activities_table') {
      const ACTIVITY_FIELDS: Array<{ suffix: string; labelFr: string; labelEn: string; slot_field: string }> = [
        { suffix: 'DESC',    labelFr: 'Description',        labelEn: 'Description',       slot_field: 'desc' },
        { suffix: 'TARGET',  labelFr: 'Population cible',   labelEn: 'Target population', slot_field: 'target' },
        { suffix: 'SUPPORT', labelFr: "Nature de l'appui",  labelEn: 'Support type',      slot_field: 'support' },
        { suffix: 'SCOPE',   labelFr: "Rayon d'action",     labelEn: 'Scope',             slot_field: 'scope' },
        { suffix: 'DATE',    labelFr: 'Date de début',      labelEn: 'Start date',        slot_field: 'date' },
        { suffix: 'DUR',     labelFr: 'Durée',              labelEn: 'Duration',          slot_field: 'duration' },
      ];
      for (let slot = 1; slot <= table.rowCapacity; slot++) {
        const slotStr = String(slot).padStart(2, '0');
        for (const af of ACTIVITY_FIELDS) {
          vars.push({
            variableName: this.generateSpssVariableName(`PP_S2_ACT_${slotStr}_${af.suffix}`, usedNames),
            paperCode: field.paperCode ?? field.id,
            labelFr: `${field.label.fr} — Prestation ${slot} — ${af.labelFr}`,
            labelEn: `${field.label.en} — Activity ${slot} — ${af.labelEn}`,
            sectionId: sec.id,
            entityApplicability: applicability,
            spssDataType: 'A',
            spssWidth: 254,
            measurementLevel: 'NOMINAL',
            sourcePath: `indexed.activities_table.${slot}.${af.slot_field}`,
            orderIndex: order++,
          });
        }
      }
      return vars;
    }

    // D. Truly variable-length repeating structures with no fixed row ceiling are
    // excluded from the wide export (no fixed column set can represent them).
    return vars;
  }

  private findFieldApplicability(fieldId: string, root: OnefopSchemaRoot): string[] {
    const matchingEntities: string[] = [];
    for (const [entityName, entity] of Object.entries(root.entities)) {
      for (const sec of entity.sections) {
        if (sec.fields.some((f) => f.id === fieldId)) {
          matchingEntities.push(entityName);
          break;
        }
      }
    }
    return matchingEntities.length > 0 ? matchingEntities : ['ALL'];
  }

  private findMatrixCellApplicability(fieldId: string, cellId: string, root: OnefopSchemaRoot): string[] {
    const matchingEntities: string[] = [];
    for (const [entityName, entity] of Object.entries(root.entities)) {
      for (const sec of entity.sections) {
        const f = sec.fields.find((field) => field.id === fieldId);
        if (f?.table?.matrix) {
          const hasCell = f.table.matrix.some((row) => row.includes(cellId));
          if (hasCell) {
            matchingEntities.push(entityName);
            break;
          }
        }
      }
    }
    return matchingEntities.length > 0 ? matchingEntities : ['ALL'];
  }

  private determineMeasurementLevel(field: SchemaField): MeasurementLevel {
    const idLower = field.id.toLowerCase();
    const pathLower = field.path.toLowerCase();

    // 1. Explicit Ordinal Whitelist
    if (ORDINAL_WHITELIST_KEYWORDS.some((kw) => idLower.includes(kw) || pathLower.includes(kw))) {
      return 'ORDINAL';
    }

    // 2. Dates
    if (field.type === 'date' || idLower.endsWith('_date') || pathLower.includes('date')) {
      return 'DATE';
    }

    // 3. Numeric Counts/Scales
    if (field.type === 'number') {
      return 'SCALE';
    }

    // 4. Default Categoricals / Identifiers
    return 'NOMINAL';
  }

  private extractValueLabels(options?: SchemaOption[] | null): Record<string, string> | undefined {
    if (!options || options.length === 0) return undefined;
    const map: Record<string, string> = {};
    for (const opt of options) {
      map[opt.value] = opt.label.fr;
    }
    return map;
  }

  private extractMatrixValueFromRelations(tableId: string, cellId: string, submission: any): unknown {
    // Administration S21Q02–S21Q04 (chronological renumbering of 2026-09-28).
    // S21Q02 recruitment rows are stored under the 's22q01' tableName (the
    // recruitment discriminator its predecessor used); S21Q03/S21Q04 have no
    // status dimension and are stored with status TOTAL.
    if (cellId.startsWith('s21q02_')) {
      const items = submission.cspGenderAge as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const csp = parts[1]?.toUpperCase();
      const gender = parts[2]?.toUpperCase();
      const ageBand = this.mapAgeBandToEnum(parts.slice(3).join('_'));
      const match = items.find((i) =>
        i.tableName?.toLowerCase() === 's22q01' &&
        i.cspCategory === csp &&
        i.gender === gender &&
        (i.ageBand === ageBand || (!i.ageBand && ageBand === 'TOTAL')),
      );
      return match ? match.value : undefined;
    }
    if (cellId.startsWith('s21q03_')) {
      const items = submission.disabilityData as any[] | undefined;
      if (!items) return undefined;
      const [, csp, gender] = cellId.split('_');
      const match = items.find((i) =>
        i.cspCategory === csp?.toUpperCase() && i.status === 'TOTAL' && i.gender === gender?.toUpperCase());
      return match ? match.value : undefined;
    }
    if (cellId.startsWith('s21q04_')) {
      const items = (submission.vulnerableData ?? submission.onefopVulnerableData) as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const gender = parts[parts.length - 1]?.toUpperCase();
      const rowKey = parts.slice(1, parts.length - 1).join('_').toUpperCase();
      const vulnType = rowKey === 'TOTAL' ? 'TOTAL_VULN' : rowKey;
      const match = items.find((i) =>
        i.gender?.toUpperCase() === gender &&
        i.status?.toUpperCase() === 'TOTAL' &&
        i.vulnerableType?.toUpperCase() === vulnType,
      );
      return match ? match.value : undefined;
    }

    // 1. cspGenderAge
    if (cellId.startsWith('s21q01_') || cellId.startsWith('s22q01_') || cellId.startsWith('s22q02_') || cellId.startsWith('s23q01_') || cellId.startsWith('pp_s4q01_') || cellId.startsWith('pp_s4q02_') || cellId.startsWith('pp_s4q03_') || cellId.startsWith('pp_s4q04_')) {
      const items = submission.cspGenderAge as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const isPp = cellId.startsWith('pp_');
      const tableName = isPp ? `${parts[0]}_${parts[1]}` : parts[0];
      const csp = isPp ? parts[2]?.toUpperCase() : parts[1]?.toUpperCase();
      const gender = isPp ? parts[3]?.toUpperCase() : parts[2]?.toUpperCase();
      const ageBand = this.mapAgeBandToEnum(isPp ? parts.slice(4).join('_') : parts.slice(3).join('_'));

      const match = items.find((i) =>
        i.tableName?.toLowerCase() === tableName.toLowerCase() &&
        i.cspCategory === csp &&
        i.gender === gender &&
        (i.ageBand === ageBand || (!i.ageBand && ageBand === 'TOTAL')),
      );
      return match ? match.value : undefined;
    }

    // 2. diplomaData
    if (cellId.startsWith('s22q03_')) {
      const items = submission.diplomaData as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i) => {
        const dipKey = i.cspCategory
          ? `s22q03_${i.cspCategory.toLowerCase()}_${i.diploma.toLowerCase()}_${i.gender.toLowerCase()}_${i.ageBand?.toLowerCase()}`
          : `s22q03_${i.diploma.toLowerCase()}_${i.gender.toLowerCase()}_${i.ageBand?.toLowerCase()}`;
        return cellId.toLowerCase() === dipKey;
      });
      return match ? match.value : undefined;
    }

    // 3. disabilityData
    if (cellId.startsWith('s22q04_') || cellId.startsWith('pp_s4q05_')) {
      const items = submission.disabilityData as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const isPp = cellId.startsWith('pp_');
      const csp = isPp ? parts[2]?.toUpperCase() : parts[1]?.toUpperCase();
      const status = isPp ? parts[3]?.toUpperCase() : parts[2]?.toUpperCase();
      const gender = isPp ? parts[4]?.toUpperCase() : parts[3]?.toUpperCase();
      const match = items.find((i) => i.cspCategory === csp && i.status === status && i.gender === gender);
      return match ? match.value : undefined;
    }

    // 4. departureData
    if (cellId.startsWith('s3q01_')) {
      const items = submission.departureData as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const csp = parts[1]?.toUpperCase();
      const depType = parts[2]?.toUpperCase();
      const gender = parts[3]?.toUpperCase();
      const match = items.find((i) => i.cspCategory === csp && i.departureType === depType && i.gender === gender);
      return match ? match.value : undefined;
    }

    // 5. dismissalUnemployment
    if (cellId.startsWith('s3q03_')) {
      const items = submission.dismissalUnemployment as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const csp = parts[1]?.toUpperCase();
      const type = parts[2]?.toUpperCase();
      const gender = parts[3]?.toUpperCase();
      const match = items.find((i) => i.cspCategory === csp && i.type === type && i.gender === gender);
      return match ? match.value : undefined;
    }

    // 6. internshipData
    if (cellId.startsWith('s4q01_')) {
      const items = submission.internshipData as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const type = parts[1]?.toUpperCase();
      const gender = parts[2]?.toUpperCase();
      const match = items.find((i) => i.internshipType?.toUpperCase() === type && i.gender === gender);
      return match ? match.value : undefined;
    }

    // 7. vulnerableData (S22Q05 and PP_S4Q06)
    if (cellId.startsWith('s22q05_ent_') || cellId.startsWith('s22q05_oth_')) {
      const items = (submission.vulnerableData ?? submission.onefopVulnerableData) as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const gender = parts[parts.length - 1]?.toUpperCase();
      const status = parts[parts.length - 2]?.toUpperCase();
      const vulnType = parts.slice(2, parts.length - 2).join('_').toUpperCase();

      const match = items.find((i) =>
        i.gender?.toUpperCase() === gender &&
        i.status?.toUpperCase() === status &&
        (i.vulnerableType?.toUpperCase() === vulnType || i.type?.toUpperCase() === vulnType),
      );
      return match ? match.value : undefined;
    }

    if (cellId.startsWith('pp_s4q06_')) {
      const items = (submission.vulnerableData ?? submission.onefopVulnerableData) as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const csp = parts[2]?.toLowerCase();
      const status = parts[3]?.toUpperCase();
      const gender = parts[4]?.toUpperCase();
      const vulnTypeMap: Record<string, string> = {
        cadres: 'CADRES_VULN',
        foremen: 'FOREMEN_VULN',
        workers: 'WORKERS_VULN',
        total: 'TOTAL_VULN',
      };
      const vulnType = vulnTypeMap[csp];
      const match = items.find((i) =>
        i.gender?.toUpperCase() === gender &&
        i.status?.toUpperCase() === status &&
        (i.vulnerableType?.toUpperCase() === vulnType || i.type?.toUpperCase() === vulnType),
      );
      return match ? match.value : undefined;
    }

    // 8. projectProgramDetail KPI outcomes (PP_S3_OUTCOMES)
    if (cellId.startsWith('s3kpi_')) {
      const pp = submission.projectProgramDetail;
      if (pp) {
        const map: Record<string, string> = {
          s3kpi_employed_current: 'employedCurrent',
          s3kpi_employed_outlook_dec: 'employedOutlookDec',
          s3kpi_employed_outlook_june: 'employedOutlookJune',
          s3kpi_self_employed_current: 'selfEmployedCurrent',
          s3kpi_self_employed_outlook_dec: 'selfEmployedOutlookDec',
          s3kpi_self_employed_outlook_june: 'selfEmployedOutlookJune',
          s3kpi_jobs_created_current: 'jobsCreatedCurrent',
          s3kpi_jobs_created_outlook_dec: 'jobsCreatedOutlookDec',
          s3kpi_jobs_created_outlook_june: 'jobsCreatedOutlookJune',
          s3kpi_trained_current: 'trainedCurrent',
          s3kpi_trained_outlook_dec: 'trainedOutlookDec',
          s3kpi_trained_outlook_june: 'trainedOutlookJune',
        };
        const prop = map[cellId.toLowerCase()];
        if (prop && pp[prop] !== undefined) return pp[prop];
      }
      return undefined;
    }

    // 9. firstTimeWorkers — S23Q02 "Primo-recrutements"
    //    Cell pattern: s23q02_{contract}_{csp}_{gender}_{ageBand}
    //    'subtotal' in the CSP position is stored as cspCategory='TOTAL'.
    if (cellId.startsWith('s23q02_')) {
      const items = submission.firstTimeWorkers as any[] | undefined;
      if (!items) return undefined;
      const parts = cellId.split('_');
      const contract = parts[1]?.toUpperCase();          // PERMANENT | TEMPORARY
      const cspRaw = parts[2];                           // cadres | foremen | workers | subtotal
      const csp = cspRaw === 'subtotal' ? 'TOTAL' : cspRaw?.toUpperCase();
      const gender = parts[3]?.toUpperCase();
      const ageBand = this.mapAgeBandToEnum(parts.slice(4).join('_'));
      const match = items.find((i: any) =>
        i.contractType === contract &&
        i.cspCategory === csp &&
        i.gender === gender &&
        (i.ageBand === ageBand || (!i.ageBand && ageBand === 'TOTAL')),
      );
      return match?.value;
    }

    // ── VT (Formation Professionnelle) matrix tables ─────────────────────────
    //
    // Cell IDs are lowercase with underscores; DB enum values are UPPER_CASE.
    // Each extractor reconstructs the expected cell key from the DB row and
    // does an exact equality check — no substring/fuzzy matching.

    // 9. VT Diploma data (s4q1 trainee-academic, s4q2 trainee-professional,
    //    s8q1 trainer-academic, s8q2 trainer-professional)
    if (cellId.startsWith('s4q1_') || cellId.startsWith('s4q2_') ||
        cellId.startsWith('s8q1_') || cellId.startsWith('s8q2_')) {
      const items = submission.vtDiplomaData as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const prefix = i.personType === 'TRAINEE'
          ? (i.diplomaKind === 'ACADEMIC' ? 's4q1' : 's4q2')
          : (i.diplomaKind === 'ACADEMIC' ? 's8q1' : 's8q2');
        const key = `${prefix}_${i.diploma.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 10. VT Trainee age flow (s4q7)
    if (cellId.startsWith('s4q7_')) {
      const items = submission.vtTraineeAgeFlow as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s4q7_${i.ageBand.toLowerCase()}_${i.flowStatus.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 11. VT Education level flow (s4q8)
    if (cellId.startsWith('s4q8_')) {
      const items = submission.vtEducationLevelFlow as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s4q8_${i.educationLevel.toLowerCase()}_${i.flowStatus.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 12. VT Trainee vulnerable (s4q9)
    if (cellId.startsWith('s4q9_')) {
      const items = submission.vtTraineeVulnerable as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s4q9_${i.category.toLowerCase()}_${i.flowStatus.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 13. VT Scholarship (s4q11)
    if (cellId.startsWith('s4q11_')) {
      const items = submission.vtScholarship as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s4q11_${i.category.toLowerCase()}_${i.status.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 14. VT Trainer age (s8q3)
    if (cellId.startsWith('s8q3_')) {
      const items = submission.vtTrainerAge as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s8q3_${i.ageBand.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 15. VT Trainer disability (s8q6)
    if (cellId.startsWith('s8q6_')) {
      const items = submission.vtTrainerDisability as any[] | undefined;
      if (!items) return undefined;
      const match = items.find((i: any) => {
        const key = `s8q6_${i.category.toLowerCase()}_${i.gender.toLowerCase()}`;
        return key === cellId.toLowerCase();
      });
      return match?.value;
    }

    // 16. VT Specialty rows (s4q3–s4q6, s4q10, s6q3, s8q4, s8q7)
    //     Cell pattern: {tableCode}_row{rowIndex}_{fieldName}
    {
      const SPECIALTY_ROW_PREFIXES = ['s4q3', 's4q4', 's4q5', 's4q6', 's4q10', 's6q3', 's8q4', 's8q7'];
      const srPrefix = SPECIALTY_ROW_PREFIXES.find((p) => cellId.startsWith(`${p}_row`));
      if (srPrefix) {
        const items = submission.vtSpecialtyRows as any[] | undefined;
        if (!items) return undefined;
        const rest = cellId.slice(`${srPrefix}_row`.length);
        const underPos = rest.indexOf('_');
        if (underPos === -1) return undefined;
        const rowIndex = parseInt(rest.slice(0, underPos), 10);
        const field = rest.slice(underPos + 1);
        if (isNaN(rowIndex)) return undefined;
        const item = items.find((i: any) => i.tableCode?.toLowerCase() === srPrefix && i.rowIndex === rowIndex);
        if (!item) return undefined;
        const v = item[field];
        // hasCurriculum / isApproved coercion for any boolean-typed fields that may
        // land here via specialty-row variants.
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v;
      }
    }

    // 17. VT Curricula (s5q2) — cell: s5q2_row{rowIndex}_{fieldName}
    if (cellId.startsWith('s5q2_row')) {
      const items = submission.vtCurricula as any[] | undefined;
      if (!items) return undefined;
      const rest = cellId.slice('s5q2_row'.length);
      const underPos = rest.indexOf('_');
      if (underPos === -1) return undefined;
      const rowIndex = parseInt(rest.slice(0, underPos), 10);
      const field = rest.slice(underPos + 1);
      if (isNaN(rowIndex)) return undefined;
      const item = items.find((i: any) => i.rowIndex === rowIndex);
      if (!item) return undefined;
      const v = item[field];
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    }

    // 18. VT Infrastructure (s5q3) — cell: s5q3_{infraType}_{fieldName}
    //     fieldNames: totalCount, permanentGoodCount, permanentBadCount, temporaryCount
    if (cellId.startsWith('s5q3_')) {
      const items = submission.vtInfrastructure as any[] | undefined;
      if (!items) return undefined;
      const rest = cellId.slice('s5q3_'.length);
      for (const field of ['totalCount', 'permanentGoodCount', 'permanentBadCount', 'temporaryCount']) {
        if (rest.endsWith(`_${field}`)) {
          const infraType = rest.slice(0, rest.length - field.length - 1).toUpperCase();
          const item = items.find((i: any) => i.infrastructureType === infraType);
          return item?.[field];
        }
      }
      return undefined;
    }

    // 19. VT Furniture (s5q4) — cell: s5q4_{furnitureType}_{fieldName}
    //     fieldNames: goodCount, badCount
    if (cellId.startsWith('s5q4_')) {
      const items = submission.vtFurniture as any[] | undefined;
      if (!items) return undefined;
      const rest = cellId.slice('s5q4_'.length);
      for (const field of ['goodCount', 'badCount']) {
        if (rest.endsWith(`_${field}`)) {
          const furnType = rest.slice(0, rest.length - field.length - 1).toUpperCase();
          const item = items.find((i: any) => i.furnitureType === furnType);
          return item?.[field];
        }
      }
      return undefined;
    }

    return undefined;
  }

  private extractIndexedValueFromRelations(template: string, slot: number, field: string, submission: any): unknown {
    if (template === 'reasons_table') {
      const items = submission.dismissalReasons as any[] | undefined;
      const item = items?.find((r) => r.reasonIndex === slot);
      if (item) {
        if (field === 'desc') return item.reasonText;
        if (field === 'male') return item.maleCount;
        if (field === 'female') return item.femaleCount;
        if (field === 'total') return item.totalCount;
      }
      if (submission.rawData) {
        const raw = submission.rawData;
        if (field === 'desc') {
          return raw[`s3q02_slot${slot}_desc`] ?? raw[`s3q02_reason_${slot}_text`] ?? raw[`s3q02_slot${slot}_text`] ?? raw[`S3Q02_SLOT${slot}_DESC`];
        }
        if (field === 'male') {
          return raw[`s3q02_slot${slot}_male`] ?? raw[`s3q02_reason_${slot}_male`] ?? raw[`S3Q02_SLOT${slot}_H`];
        }
        if (field === 'female') {
          return raw[`s3q02_slot${slot}_female`] ?? raw[`s3q02_reason_${slot}_female`] ?? raw[`S3Q02_SLOT${slot}_F`];
        }
        if (field === 'total') {
          return raw[`s3q02_slot${slot}_total`] ?? raw[`s3q02_reason_${slot}_total`] ?? raw[`S3Q02_SLOT${slot}_TOTAL`];
        }
      }
    }

    if (template === 'skills_table') {
      const items = submission.skillNeeds as any[] | undefined;
      const item = items?.find((r) => r.skillIndex === slot);
      if (item) {
        if (field === 'desc') return item.skillDescription;
        if (field === 'male') return item.maleCount;
        if (field === 'female') return item.femaleCount;
        if (field === 'total') return item.totalCount;
      }
      if (submission.rawData) {
        const raw = submission.rawData;
        if (field === 'desc') {
          return raw[`s4q02_slot${slot}_desc`] ?? raw[`s4q02_skill_${slot}_desc`] ?? raw[`s4q02_besoin_${slot}_desc`] ?? raw[`S4Q02_SLOT${slot}_DESC`];
        }
        if (field === 'male') {
          return raw[`s4q02_slot${slot}_male`] ?? raw[`s4q02_skill_${slot}_male`] ?? raw[`S4Q02_SLOT${slot}_H`];
        }
        if (field === 'female') {
          return raw[`s4q02_slot${slot}_female`] ?? raw[`s4q02_skill_${slot}_female`] ?? raw[`S4Q02_SLOT${slot}_F`];
        }
        if (field === 'total') {
          return raw[`s4q02_slot${slot}_total`] ?? raw[`s4q02_skill_${slot}_total`] ?? raw[`S4Q02_SLOT${slot}_TOTAL`];
        }
      }
    }

    if (template === 'training_table') {
      const items = submission.trainingNeeds as any[] | undefined;
      const item = items?.find((r) => r.domainIndex === slot);
      if (item) {
        if (field === 'desc') return item.trainingDomain;
        if (field === 'male') return item.maleCount;
        if (field === 'female') return item.femaleCount;
        if (field === 'total') return item.totalCount;
      }
      if (submission.rawData) {
        const raw = submission.rawData;
        if (field === 'desc') {
          return raw[`s4q03_slot${slot}_desc`] ?? raw[`s4q03_training_${slot}_domain`] ?? raw[`s4q03_domain_${slot}_text`] ?? raw[`S4Q03_SLOT${slot}_DESC`];
        }
        if (field === 'male') {
          return raw[`s4q03_slot${slot}_male`] ?? raw[`s4q03_training_${slot}_male`] ?? raw[`S4Q03_SLOT${slot}_H`];
        }
        if (field === 'female') {
          return raw[`s4q03_slot${slot}_female`] ?? raw[`s4q03_training_${slot}_female`] ?? raw[`S4Q03_SLOT${slot}_F`];
        }
        if (field === 'total') {
          return raw[`s4q03_slot${slot}_total`] ?? raw[`s4q03_training_${slot}_total`] ?? raw[`S4Q03_SLOT${slot}_TOTAL`];
        }
      }
    }

    // PP Section 2 activities — wide-pivoted into the main .sav (slot 1–13)
    if (template === 'activities_table') {
      const items = submission.projectProgramActivities as any[] | undefined;
      const item = items?.find((r: any) => r.rowIndex === slot);
      if (!item) return undefined;
      if (field === 'desc')     return item.description;
      if (field === 'target')   return item.targetPopulation;
      if (field === 'support')  return item.supportType;
      if (field === 'scope')    return item.scope;
      if (field === 'date')     return item.startDate;
      if (field === 'duration') return item.duration;
    }

    return undefined;
  }

  private mapAgeBandToEnum(ageKey: string): string {
    const map: Record<string, string> = {
      '15_24': 'AGE_15_24',
      '25_34': 'AGE_25_34',
      '35_plus': 'AGE_35_PLUS',
      total: 'TOTAL',
    };
    return map[ageKey] || ageKey.toUpperCase();
  }

  private spssQuote(value: string): string {
    return value.replace(/'/g, "''");
  }

  private chunkList<T>(list: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < list.length; i += size) {
      chunks.push(list.slice(i, i + size));
    }
    return chunks;
  }
}
