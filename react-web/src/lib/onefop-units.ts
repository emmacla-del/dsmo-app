// src/lib/onefop-units.ts
//
// Shared unit-chunking model for ONEFOP sections — ported from
// lib/screens/onefop/onefop_section_units.dart (buildTableGroupUnits).
// Splits dense sections (e.g. Section 2, 3, 4 with massive multi-column matrices)
// into discrete, digestible units so the user is not overwhelmed by dozens of
// complex tables stacked in an endless scroll.

import { bilingual, isFieldVisible, type FormData, type OnefopField, type OnefopSection } from "./onefop-schema";

export interface FormUnit {
  key: string;
  sectionId: string;
  subsectionTitle: string | null;
  shortLabel: string;
  title: string;
  fields: OnefopField[];
  isTable: boolean;
  tableField: OnefopField | null;
}

/**
 * Derives a clean short code for a unit (e.g. "S21Q01", "S2.1", "VT1_01", or "Identité").
 */
function deriveUnitShortLabel(fields: OnefopField[], subsectionTitle: string | null, unitIdx: number): string {
  const tableField = fields.find((f) => f.type === "table" || f.type === "repeating_table");
  if (tableField?.paperCode) {
    return tableField.paperCode;
  }
  const firstWithCode = fields.find((f) => !!f.paperCode);
  if (firstWithCode?.paperCode) {
    // If subsection starts with a number like "2.1 EFFECTIFS", use "2.1"
    const match = subsectionTitle?.match(/^(\d+(\.\d+)*)/);
    if (match) return match[1];
    return firstWithCode.paperCode;
  }
  const match = subsectionTitle?.match(/^(\d+(\.\d+)*)/);
  if (match) return match[1];
  return `U${unitIdx + 1}`;
}

/**
 * Decomposes a section's fields into sequential units:
 * - Each table field becomes its own distinct Unit
 * - Runs of simple scalar fields between tables form Simple Units
 */
export function buildSectionUnits(section: OnefopSection): FormUnit[] {
  const units: FormUnit[] = [];
  let currentSimpleFields: OnefopField[] = [];
  let currentSubsection: string | null = null;
  let unitCount = 0;

  // Map each field to its subsection title
  const subsectionByField = new Map<string, string>();
  for (const sub of section.subsections) {
    const title = bilingual(sub.title);
    for (const id of sub.fieldIds) {
      subsectionByField.set(id, title);
    }
  }

  function flushSimpleFields() {
    if (currentSimpleFields.length === 0) return;
    unitCount++;
    const shortLabel = deriveUnitShortLabel(currentSimpleFields, currentSubsection, unitCount);
    const title = currentSubsection || `${bilingual(section.title)} - Partie ${unitCount}`;
    units.push({
      key: `${section.id}_unit_${unitCount}`,
      sectionId: section.id,
      subsectionTitle: currentSubsection,
      shortLabel,
      title,
      fields: currentSimpleFields,
      isTable: false,
      tableField: null,
    });
    currentSimpleFields = [];
  }

  for (const field of section.fields) {
    const fieldSub = subsectionByField.get(field.id) ?? null;
    const isTable = field.type === "table" || field.type === "repeating_table";

    if (isTable) {
      // Flush preceding scalar fields if any
      flushSimpleFields();
      unitCount++;
      const tableTitle = bilingual(field.label) || fieldSub || field.id;
      const shortLabel = field.paperCode || `T${unitCount}`;
      units.push({
        key: `${section.id}_table_${field.id}`,
        sectionId: section.id,
        subsectionTitle: fieldSub,
        shortLabel,
        title: tableTitle,
        fields: [field],
        isTable: true,
        tableField: field,
      });
      currentSubsection = fieldSub;
    } else {
      // If the subsection changed, flush simple fields to keep subsection grouping clean
      if (currentSubsection !== null && fieldSub !== currentSubsection && currentSimpleFields.length > 0) {
        flushSimpleFields();
      }
      currentSubsection = fieldSub;
      currentSimpleFields.push(field);
    }
  }

  flushSimpleFields();
  return units;
}

/**
 * Checks whether a unit has any visible fields given the current form data.
 */
export function isUnitVisible(unit: FormUnit, data: FormData): boolean {
  return unit.fields.some((f) => isFieldVisible(f, data));
}

/**
 * Checks whether a unit has been filled/answered.
 */
export function isUnitFilled(unit: FormUnit, data: FormData): boolean {
  if (unit.isTable && unit.tableField) {
    const prefix = unit.tableField.table?.id ?? unit.tableField.id;
    // Check if any cell starting with prefix has data > 0 or non-empty string
    for (const key of Object.keys(data)) {
      if (key.startsWith(prefix) && data[key] !== "" && data[key] !== undefined && data[key] !== null) {
        return true;
      }
    }
    return false;
  }

  // Simple fields
  const visible = unit.fields.filter((f) => isFieldVisible(f, data));
  if (visible.length === 0) return true;
  return visible.some((f) => {
    const v = data[f.id];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
}
