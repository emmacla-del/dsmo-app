// src/onefop-schema-validation/onefop-schema-loader.service.ts
//
// Loads the generated assets/schemas/onefop.schema.json once and exposes
// flattened per-entity field/table lookups. Read-only, no Prisma
// dependency — this is pure schema data, never a second definition of it
// (see the migration plan's ONEFOP Schema Ownership Rule).
import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  EntitySchema,
  OnefopSchemaRoot,
  SchemaEntityType,
  SchemaField,
} from './onefop-schema.types';

@Injectable()
export class OnefopSchemaLoaderService {
  private readonly logger = new Logger(OnefopSchemaLoaderService.name);
  private root: OnefopSchemaRoot | null = null;
  // entityType -> fieldId -> field, flattened across every section/subsection.
  private flattenedByEntity = new Map<string, Map<string, SchemaField>>();

  private load(): OnefopSchemaRoot {
    if (this.root) return this.root;
    // Same path FormSchemaCompiler's export test writes to — not
    // configurable, matching the exporter's own single, hardcoded output
    // location.
    const path = join(process.cwd(), 'assets', 'schemas', 'onefop.schema.json');
    const raw = readFileSync(path, 'utf-8');
    this.root = JSON.parse(raw) as OnefopSchemaRoot;
    this.logger.log(
      `Loaded ONEFOP schema v${this.root.schemaVersion} ` +
        `(${Object.keys(this.root.entities).length} entity types, source: ${this.root.source})`,
    );
    return this.root;
  }

  getRoot(): OnefopSchemaRoot {
    return this.load();
  }

  getEntitySchema(entityType: SchemaEntityType): EntitySchema {
    const root = this.load();
    const entity = root.entities[entityType];
    if (!entity) {
      throw new Error(`No ONEFOP schema entry for entity type "${entityType}"`);
    }
    return entity;
  }

  /** Every field across every section/subsection for one entity type, keyed by field id. */
  getFlattenedFields(entityType: SchemaEntityType): Map<string, SchemaField> {
    const cached = this.flattenedByEntity.get(entityType);
    if (cached) return cached;

    // Fields live only on `section.fields`, flat, one section level deep.
    // Subsections are a grouping label over a subset of that same array
    // (`{ title, fieldIds }`), not a nested container of their own field
    // objects — see SchemaSubsection's doc comment.
    const entity = this.getEntitySchema(entityType);
    const out = new Map<string, SchemaField>();
    for (const section of entity.sections) {
      for (const field of section.fields) {
        out.set(field.id, field);
      }
    }
    this.flattenedByEntity.set(entityType, out);
    return out;
  }

  getFormulaNames(): string[] {
    return Object.keys(this.load().formulas);
  }
}
