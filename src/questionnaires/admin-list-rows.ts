// src/questionnaires/admin-list-rows.ts
//
// What one row of the admin dossier list reads, in two queries.
//
// The list used to `include` fifteen relations. Prisma runs one query per
// relation, one after another, so a page cost seventeen round trips to the
// database whatever its size (4.4 s for two rows from a local backend), and
// every row carried the whole declaration (rawData, 20-40 KB) to show a name.
//
// Now the rows are read with their own columns only, under the same `where`
// as the count, and what they show from other tables comes from the single
// query below. A list row never carries rawData: the file page is where the
// answers are read, and it applies withoutStaffNames (staff-names.ts) to them.
import { Prisma } from '@prisma/client';

/** Every OnefopSubmission column except the declaration itself: rawData, flags, metaJson. */
export const ADMIN_LIST_ROW_SELECT = {
  id: true,
  submissionId: true,
  formType: true,
  status: true,
  rejectionReason: true,
  reviewedBy: true,
  reviewedAt: true,
  pdfUrl: true,
  surveyYear: true,
  submissionDate: true,
  region: true,
  department: true,
  subdivision: true,
  submittedBy: true,
  assigneeId: true,
  claimActivityAt: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  companyId: true,
  regionId: true,
  departmentId: true,
  subdivisionId: true,
  establishmentId: true,
  quarterCode: true,
  taxNumber: true,
  cnpsNumber: true,
  campaignId: true,
  isLate: true,
  effectiveDeadlineSnapshot: true,
  registrationNumber: true,
  supersededById: true,
  archivedAt: true,
  archivedBy: true,
  archiveReason: true,
} as const;

/** One list row's values from other tables, as the query below returns them. */
export interface AdminListDisplayRow {
  id: string;
  entityName: string | null;
  respondentName: string | null;
  campaignName: string | null;
  companyEstablishmentId: string | null;
  companyRegistrationStatus: string | null;
  archivedByUserId: string | null;
  archivedByFirstName: string | null;
  archivedByLastName: string | null;
  assigneeUserId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  supersedesId: string | null;
  supersedesSubmissionId: string | null;
  anomalies: Array<{ isBlocking: boolean; status: string; ruleCode: string }> | null;
}

type RawReader = { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> };

/**
 * The display values of the given files, keyed by file id.
 *
 * entityName is the first non-empty name: the entity detail tables, then
 * rawData, in the order of resolveEntityName (react-web). CTD has no name
 * column, so its name can only come from rawData; it is extracted here so
 * that the JSON itself stays in the database.
 *
 * No territory or archive condition: `ids` come from the filtered list query,
 * which already applied them, and this only adds columns to those rows. Every
 * join below is on a unique key, so a file yields exactly one row.
 */
export async function loadAdminListDisplay(
  prisma: RawReader,
  ids: string[],
): Promise<Map<string, AdminListDisplayRow>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<AdminListDisplayRow[]>(Prisma.sql`
    SELECT
      s.id,
      COALESCE(
        NULLIF(enterprise."companyName", ''),
        NULLIF(cooperative."cooperativeName", ''),
        NULLIF(ong."ongName", ''),
        NULLIF(administration.name, ''),
        NULLIF(project.name, ''),
        NULLIF(training.name, ''),
        NULLIF(s."rawData" #>> '{enterprise,name}', ''),
        NULLIF(s."rawData" #>> '{enterprise,companyName}', ''),
        NULLIF(s."rawData" #>> '{cooperative,name}', ''),
        NULLIF(s."rawData" #>> '{ctd,name}', ''),
        NULLIF(s."rawData" #>> '{respondent,companyName}', ''),
        NULLIF(s."rawData" #>> '{companyName}', ''),
        NULLIF(s."rawData" #>> '{name}', '')
      ) AS "entityName",
      respondent."respondentName" AS "respondentName",
      campaign.name AS "campaignName",
      company."establishmentId" AS "companyEstablishmentId",
      company_user.status::text AS "companyRegistrationStatus",
      archiver.id AS "archivedByUserId",
      archiver."firstName" AS "archivedByFirstName",
      archiver."lastName" AS "archivedByLastName",
      assignee.id AS "assigneeUserId",
      assignee."firstName" AS "assigneeFirstName",
      assignee."lastName" AS "assigneeLastName",
      assignee.email AS "assigneeEmail",
      replaced.id AS "supersedesId",
      replaced."submissionId" AS "supersedesSubmissionId",
      findings.items AS anomalies
    FROM "onefop_submissions" s
    LEFT JOIN "onefop_enterprise_details" enterprise ON enterprise."submissionId" = s.id
    LEFT JOIN "onefop_cooperative_details" cooperative ON cooperative."submissionId" = s.id
    LEFT JOIN "onefop_ong_details" ong ON ong."submissionId" = s.id
    LEFT JOIN "onefop_administration_details" administration ON administration."submissionId" = s.id
    LEFT JOIN "onefop_project_program_details" project ON project."submissionId" = s.id
    LEFT JOIN "onefop_vocational_training_details" training ON training."submissionId" = s.id
    LEFT JOIN "onefop_respondents" respondent ON respondent."submissionId" = s.id
    LEFT JOIN "data_campaigns" campaign ON campaign.id = s."campaignId"
    LEFT JOIN "companies" company ON company.id = s."companyId"
    LEFT JOIN "users" company_user ON company_user.id = company."userId"
    LEFT JOIN "users" archiver ON archiver.id = s."archivedBy"
    LEFT JOIN "users" assignee ON assignee.id = s."assigneeId"
    -- One resubmission can close several correction requests; name the latest.
    LEFT JOIN LATERAL (
      SELECT older.id, older."submissionId"
      FROM "onefop_submissions" older
      WHERE older."supersededById" = s.id
      ORDER BY older."submissionDate" DESC
      LIMIT 1
    ) replaced ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'isBlocking', finding."isBlocking",
        'status', finding.status,
        'ruleCode', finding."ruleCode"
      )) AS items
      FROM "onefop_anomalies" finding
      WHERE finding."submissionId" = s.id
    ) findings ON TRUE
    WHERE s.id IN (${Prisma.join(ids)})
  `);
  return new Map(rows.map((row) => [row.id, row]));
}
