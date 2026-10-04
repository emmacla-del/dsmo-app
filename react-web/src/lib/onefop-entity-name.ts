// src/lib/onefop-entity-name.ts
//
// GET /admin/questionnaires does NOT return a flat `companyName`. The name
// lives on whichever per-entity detail relation the submission has — see the
// `include` in listForAdmin (src/questionnaires/questionnaires.service.ts),
// and the column names on each Onefop*Detail model in prisma/schema.prisma:
//
//   OnefopEnterpriseDetail         companyName
//   OnefopCooperativeDetail        cooperativeName
//   OnefopOngDetail                ongName
//   OnefopAdministrationDetail     name
//   OnefopProjectProgramDetail     name
//   OnefopVocationalTrainingDetail name
//   OnefopCtdDetail                (no name column — falls through to rawData)
//
// Callers supply their own placeholder for an unresolved name; this returns
// null rather than inventing one, so a missing detail row stays visible as
// missing.

interface EntityDetail {
  companyName?: string | null;
  cooperativeName?: string | null;
  ongName?: string | null;
  name?: string | null;
}

export interface NamedSubmission {
  companyName?: string | null;
  enterpriseDetail?: EntityDetail | null;
  cooperativeDetail?: EntityDetail | null;
  ctdDetail?: EntityDetail | null;
  ongDetail?: EntityDetail | null;
  administrationDetail?: EntityDetail | null;
  projectProgramDetail?: EntityDetail | null;
  vocationalTrainingDetail?: EntityDetail | null;
  rawData?: {
    name?: string | null;
    companyName?: string | null;
    enterprise?: { name?: string | null; companyName?: string | null } | null;
    cooperative?: { name?: string | null } | null;
    ctd?: { name?: string | null } | null;
    respondent?: { companyName?: string | null } | null;
  } | null;
}

/**
 * First non-empty entity name carried by an /admin/questionnaires item,
 * or null when the submission carries none.
 */
export function resolveEntityName(sub: NamedSubmission | null | undefined): string | null {
  if (!sub) return null;
  const name =
    sub.companyName ||
    sub.enterpriseDetail?.companyName ||
    sub.cooperativeDetail?.cooperativeName ||
    sub.ongDetail?.ongName ||
    sub.administrationDetail?.name ||
    sub.projectProgramDetail?.name ||
    sub.vocationalTrainingDetail?.name ||
    sub.rawData?.enterprise?.name ||
    sub.rawData?.enterprise?.companyName ||
    sub.rawData?.cooperative?.name ||
    sub.rawData?.ctd?.name ||
    sub.rawData?.respondent?.companyName ||
    sub.rawData?.companyName ||
    sub.rawData?.name;
  return name || null;
}
