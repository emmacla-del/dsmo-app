// The real ONEFOP schema (public/schemas/onefop.schema.json, generated from
// lib/core/focus/compiler/onefop_ast.dart) for tests that render schema fields.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopEntity, OnefopField, OnefopSchema } from "@/lib/onefop-schema";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
let schema: OnefopSchema | null = null;

export function loadOnefopSchema(): OnefopSchema {
  schema ??= JSON.parse(readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8")) as OnefopSchema;
  return schema;
}

export function schemaEntity(name: string): OnefopEntity {
  const entity = loadOnefopSchema().entities[name];
  if (!entity) throw new Error(`No entity "${name}" in onefop.schema.json`);
  return entity;
}

export function schemaField(entityName: string, fieldId: string): OnefopField {
  const field = schemaEntity(entityName)
    .sections.flatMap((s) => s.fields)
    .find((f) => f.id === fieldId);
  if (!field) throw new Error(`No field "${fieldId}" in entity "${entityName}"`);
  return field;
}
