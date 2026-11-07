// src/questionnaires/admin-file-read.ts
//
// What the admin file page reads besides the file's own row.
//
// getById used to `include` twelve relations. Prisma runs one query per
// relation, one after another, so opening a file cost sixteen round trips to
// the database, seven of them looking for entity details the file cannot have:
// submission creates exactly one, chosen by entity type. Now the detail is read
// from its form's table, and the small values come from one query.
import { Prisma } from '@prisma/client';

/** The response key of each form's detail, and the Prisma delegate that reads it. */
const FORM_DETAILS: Record<string, { key: string; delegate: string }> = {
  ENTREPRISE: { key: 'enterpriseDetail', delegate: 'onefopEnterpriseDetail' },
  COOPERATIVE: { key: 'cooperativeDetail', delegate: 'onefopCooperativeDetail' },
  CTD: { key: 'ctdDetail', delegate: 'onefopCtdDetail' },
  ONG: { key: 'ongDetail', delegate: 'onefopOngDetail' },
  ADMINISTRATION: { key: 'administrationDetail', delegate: 'onefopAdministrationDetail' },
  PROJECT_PROGRAM: { key: 'projectProgramDetail', delegate: 'onefopProjectProgramDetail' },
  VOCATIONAL_TRAINING: { key: 'vocationalTrainingDetail', delegate: 'onefopVocationalTrainingDetail' },
};

/**
 * The file's entity detail, under its own key, with the other forms' keys
 * null: the response always carries all seven, as the page expects. A form
 * with no detail table has every key null.
 */
export async function loadFileDetail(
  prisma: any,
  file: { id: string; formType?: string | null },
): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = {};
  for (const { key } of Object.values(FORM_DETAILS)) details[key] = null;
  const form = file.formType ? FORM_DETAILS[file.formType] : undefined;
  if (form) details[form.key] = await prisma[form.delegate].findUnique({ where: { submissionId: file.id } });
  return details;
}

/** One file's values from other tables, as the query below returns them. */
export interface FileContextRow {
  yearOfCreation: string | null;
  assigneeUserId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  supersedesId: string | null;
  supersedesSubmissionId: string | null;
}

type RawReader = { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> };

/**
 * The registered founding year, the assignee and the file this one corrects.
 * No territory or archive condition: `id` comes from the file read, which
 * already applied them, and the file it replaced is named even if archived,
 * as it always was.
 */
export async function loadFileContext(prisma: RawReader, id: string): Promise<FileContextRow | null> {
  const rows = await prisma.$queryRaw<FileContextRow[]>(Prisma.sql`
    SELECT
      company."yearOfCreation" AS "yearOfCreation",
      assignee.id AS "assigneeUserId",
      assignee."firstName" AS "assigneeFirstName",
      assignee."lastName" AS "assigneeLastName",
      assignee.email AS "assigneeEmail",
      replaced.id AS "supersedesId",
      replaced."submissionId" AS "supersedesSubmissionId"
    FROM "onefop_submissions" s
    LEFT JOIN "establishments" establishment ON establishment.id = s."establishmentId"
    LEFT JOIN "companies" company ON company.id = establishment."companyId"
    LEFT JOIN "users" assignee ON assignee.id = s."assigneeId"
    -- One resubmission can close several correction requests; name the latest.
    LEFT JOIN LATERAL (
      SELECT older.id, older."submissionId"
      FROM "onefop_submissions" older
      WHERE older."supersededById" = s.id
      ORDER BY older."submissionDate" DESC
      LIMIT 1
    ) replaced ON TRUE
    WHERE s.id = ${id}
  `);
  return rows[0] ?? null;
}
