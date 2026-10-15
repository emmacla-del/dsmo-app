// src/data-management/spss/vt-roster-export.ts
//
// 8.8 named staff list (« Liste nominative du personnel ») export.
//
// The anonymous statistical dataset keeps 8.8 out (canonical-exclusions.ts):
// it names people. This is the separate, labelled file the design note §9
// asks for — one case per staff member, joined to the main dataset by
// submissionId. Approved 2026-10-15 (constitution §21): SUPER_ADMIN and
// ADMIN_ONEFOP only, data-protection review signed off by the owner.
//
// Coded cells are numbered as in the questionnaire: sex and status keep their
// own codes (1/2, 1/2/3); a diploma is its option's 1-based position in the
// schema (options are append-only, so a position keeps its meaning).
import type { OnefopSchemaLoaderService } from '../../onefop-schema-validation/onefop-schema-loader.service';
import type { SchemaOption } from '../../onefop-schema-validation/onefop-schema.types';
import type { SavVariable } from './sav-writer';

/** Version of the roster file's shape, independent of DATASET_SCHEMA_VERSION. */
export const VT_ROSTER_DATASET_VERSION = 1;

export const VT_ROSTER_FILE_LABEL = `CONFIDENTIEL - données nominatives (8.8) - CAM-LEAP / ONEFOP (liste nominative v${VT_ROSTER_DATASET_VERSION})`;

/** Context variables copied from the main dataset, same names and values. */
export const VT_ROSTER_CONTEXT_VARIABLES = [
  'submissionId',
  'establishmentId',
  'companyName',
  'region',
  'department',
  'quarterCode',
  'status',
] as const;

export interface VtRosterRecord {
  rowIndex: number;
  lastName: string;
  firstName: string;
  sex: string | null;
  trainerStatus: string | null;
  isAdminPersonnel: boolean | null;
  academicDiploma: string | null;
  professionalDiploma: string | null;
}

export interface VtRosterColumn {
  variable: SavVariable;
  value: (row: VtRosterRecord) => unknown;
}

function codeLabels(options: SchemaOption[], byPosition: boolean): Record<string, string> {
  return Object.fromEntries(
    options.map((o, i) => [byPosition ? String(i + 1) : o.value, o.label.fr]),
  );
}

function positionOf(options: SchemaOption[], stored: string | null): number | undefined {
  if (!stored) return undefined;
  const i = options.findIndex((o) => o.value.toLowerCase() === stored.toLowerCase());
  return i >= 0 ? i + 1 : undefined;
}

function ownCode(options: SchemaOption[], stored: string | null): number | undefined {
  if (!stored) return undefined;
  return options.some((o) => o.value === stored.trim()) ? Number(stored.trim()) : undefined;
}

/** The roster's own columns (after the context variables), built from the 8.8 schema cells. */
export function vtRosterColumns(schemaLoader: OnefopSchemaLoaderService): VtRosterColumn[] {
  const cells = schemaLoader.getFlattenedFields('vocationalTraining').get('VT8_8')?.table?.vt?.cells ?? [];
  const optionsOf = (key: string): SchemaOption[] => cells.find((c) => c.key === key)?.options ?? [];
  const labelOf = (key: string, fallback: string): string => cells.find((c) => c.key === key)?.label.fr ?? fallback;
  const sex = optionsOf('sex');
  const status = optionsOf('trainerStatus');
  const academic = optionsOf('academicDiploma');
  const professional = optionsOf('professionalDiploma');
  const nominal = (name: string, label: string, valueLabels?: Record<string, string>): SavVariable => ({
    name, label, type: 'numeric', width: 2, valueLabels, measure: 'nominal',
  });

  return [
    { variable: nominal('rowIndex', 'Numéro de ligne (8.8)'), value: (r) => r.rowIndex },
    {
      variable: { name: 'lastName', label: labelOf('lastName', 'Nom'), type: 'string', width: 100, measure: 'nominal' },
      value: (r) => r.lastName,
    },
    {
      variable: { name: 'firstName', label: labelOf('firstName', 'Prénom'), type: 'string', width: 100, measure: 'nominal' },
      value: (r) => r.firstName,
    },
    { variable: nominal('sex', labelOf('sex', 'Sexe'), codeLabels(sex, false)), value: (r) => ownCode(sex, r.sex) },
    {
      variable: nominal('trainerStatus', labelOf('trainerStatus', 'Statut'), codeLabels(status, false)),
      value: (r) => ownCode(status, r.trainerStatus),
    },
    {
      variable: nominal('isAdminPersonnel', labelOf('isAdminPersonnel', 'Personnel administratif'), { '0': 'Non', '1': 'Oui' }),
      value: (r) => (r.isAdminPersonnel === null || r.isAdminPersonnel === undefined ? undefined : r.isAdminPersonnel ? 1 : 0),
    },
    {
      variable: nominal('academicDiploma', labelOf('academicDiploma', 'Diplôme académique'), codeLabels(academic, true)),
      value: (r) => positionOf(academic, r.academicDiploma),
    },
    {
      variable: nominal('professionalDiploma', labelOf('professionalDiploma', 'Diplôme professionnel'), codeLabels(professional, true)),
      value: (r) => positionOf(professional, r.professionalDiploma),
    },
  ];
}
