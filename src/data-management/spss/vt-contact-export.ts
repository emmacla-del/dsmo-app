// src/data-management/spss/vt-contact-export.ts
//
// Restricted VT Contact Export (« Fichier restreint des coordonnées et contacts VT »).
//
// The anonymous statistical dataset excludes personal contact fields (canonical-exclusions.ts).
// This restricted file contains contact details for vocational training centres, joined to the
// main dataset by submissionId. Option B under Decision 2 (2026-10-16): SUPER_ADMIN and
// ADMIN_ONEFOP only, every download recorded.

import type { SavVariable } from './sav-writer';

/** Version of the contact file's shape. */
export const VT_CONTACT_DATASET_VERSION = 1;

export const VT_CONTACT_FILE_LABEL = `CONFIDENTIEL - coordonnées et contacts (VT) - CAMLEAP / ONEFOP (contacts v${VT_CONTACT_DATASET_VERSION})`;

/** Context variables copied from the main dataset, same names and values. */
export const VT_CONTACT_CONTEXT_VARIABLES = [
  'submissionId',
  'establishmentId',
  'companyName',
  'region',
  'department',
  'quarterCode',
  'status',
] as const;

export interface VtContactColumn {
  variable: SavVariable;
  value: (row: any) => unknown;
}

export function vtContactColumns(): VtContactColumn[] {
  return [
    {
      variable: { name: 'VT1_15_NAME', label: '1.15 — Répondant: Noms et prénoms', type: 'string', width: 100, measure: 'nominal' },
      value: (s: any) => s.respondent?.respondentName ?? s.rawData?.VT1_15_NAME ?? s.rawData?.respondent?.name ?? '',
    },
    {
      variable: { name: 'VT1_15_TEL1', label: '1.15 — Répondant: Téléphone 1', type: 'string', width: 30, measure: 'nominal' },
      value: (s: any) => s.respondent?.phone1 ?? s.rawData?.VT1_15_TEL1 ?? s.rawData?.respondent?.phone1 ?? '',
    },
    {
      variable: { name: 'VT1_15_TEL2', label: '1.15 — Répondant: Téléphone 2', type: 'string', width: 30, measure: 'nominal' },
      value: (s: any) => s.respondent?.phone2 ?? s.rawData?.VT1_15_TEL2 ?? s.rawData?.respondent?.phone2 ?? '',
    },
    {
      variable: { name: 'VT1_15_EMAIL', label: '1.15 — Répondant: E-mail', type: 'string', width: 100, measure: 'nominal' },
      value: (s: any) => s.respondent?.email ?? s.rawData?.VT1_15_EMAIL ?? s.rawData?.respondent?.email ?? '',
    },
    {
      variable: { name: 'VT1_16_NAME', label: '1.16 — Promoteur/Directeur: Noms et prénoms', type: 'string', width: 100, measure: 'nominal' },
      value: (s: any) => s.vocationalTrainingDetail?.promoterName ?? s.rawData?.VT1_16_NAME ?? '',
    },
    {
      variable: { name: 'VT1_16_TEL1', label: '1.16 — Promoteur/Directeur: Téléphone 1', type: 'string', width: 30, measure: 'nominal' },
      value: (s: any) => s.vocationalTrainingDetail?.promoterPhone1 ?? s.rawData?.VT1_16_TEL1 ?? '',
    },
    {
      variable: { name: 'VT1_16_TEL2', label: '1.16 — Promoteur/Directeur: Téléphone 2', type: 'string', width: 30, measure: 'nominal' },
      value: (s: any) => s.vocationalTrainingDetail?.promoterPhone2 ?? s.rawData?.VT1_16_TEL2 ?? '',
    },
    {
      variable: { name: 'VT1_16_EMAIL', label: '1.16 — Promoteur/Directeur: E-mail', type: 'string', width: 100, measure: 'nominal' },
      value: (s: any) => s.vocationalTrainingDetail?.promoterEmail ?? s.rawData?.VT1_16_EMAIL ?? '',
    },
    {
      variable: { name: 'VT2_12', label: '2.1.12 — Adresse e-mail du centre', type: 'string', width: 100, measure: 'nominal' },
      value: (s: any) => s.vocationalTrainingDetail?.email ?? s.rawData?.VT2_12 ?? '',
    },
  ];
}
