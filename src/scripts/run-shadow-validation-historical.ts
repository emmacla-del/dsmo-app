// src/scripts/run-shadow-validation-historical.ts
//
// Phase 2.7 of the migration plan: runs the new schema-driven shadow
// validator (src/onefop-schema-validation/) against REAL historical
// OnefopSubmission rows, so discrepancies can be triaged as "validator
// defect" vs. "legitimate legacy payload" vs. "actual invalid data" before
// any enforcement is ever considered. Read-only against the database —
// never writes back to OnefopSubmission, never mutates anything. Output is
// a local JSON report file; per-submission detail in that report is
// field-id + category only, never raw field values, since rawData can
// carry respondent PII (names/phones/emails).
//
// This deliberately was NOT run by the assistant that wrote it — reading
// production submissions, even read-only, is a "Production Reads" action
// the harness's own auto-mode classifier blocks outright. Run it yourself:
//
//   npx ts-node src/scripts/run-shadow-validation-historical.ts [limit]
//
// `limit` (optional, default 200) caps how many of the most recent
// non-draft submissions are pulled.
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import { OnefopShadowValidatorService } from '../onefop-schema-validation/onefop-shadow-validator.service';
import type { DiscrepancyCategory } from '../onefop-schema-validation/onefop-shadow-validator.types';

const prisma = new PrismaClient();
const validator = new OnefopShadowValidatorService(new OnefopSchemaLoaderService());

// Mirrors questionnaires.service.ts's private toLowerEntityType() — not
// exported there, so duplicated here rather than reaching into that
// module's internals (same posture as backfill-normalized-tables.ts's own
// comment: "Copy these private methods ... since we can't inject the
// service in a script").
function toLowerEntityType(formType: string): string {
  if (formType === 'PROJECT_PROGRAM') return 'projectProgram';
  if (formType === 'VOCATIONAL_TRAINING') return 'vocationalTraining';
  return formType.toLowerCase();
}

interface SubmissionSummary {
  submissionId: string;
  entityType: string;
  fieldsChecked: number;
  discrepancyCount: number;
  byCategory: Partial<Record<DiscrepancyCategory, number>>;
  // Field ids + categories only — never the raw value, since rawData can
  // carry respondent PII.
  sampleDiscrepancies: { category: DiscrepancyCategory; fieldId: string }[];
}

async function main() {
  const limit = Number(process.argv[2]) || 200;

  const submissions = await prisma.onefopSubmission.findMany({
    where: { status: { not: 'DRAFT' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { submissionId: true, formType: true, rawData: true, createdAt: true },
  });

  const perSubmission: SubmissionSummary[] = [];
  const totalsByCategory: Partial<Record<DiscrepancyCategory, number>> = {};
  const totalsByEntityType: Record<string, { submissions: number; discrepancies: number }> = {};
  let crashed = 0;

  for (const submission of submissions) {
    const entityType = toLowerEntityType(submission.formType);
    const schemaEntityType = OnefopShadowValidatorService.toSchemaEntityType(entityType);
    if (!schemaEntityType) continue;

    try {
      const normalized = normalizeFlatKeys(
        submission.rawData as Record<string, unknown>,
        entityType,
      );
      const result = validator.validate(schemaEntityType, normalized as Record<string, unknown>);

      const byCategory: Partial<Record<DiscrepancyCategory, number>> = {};
      for (const d of result.discrepancies) {
        byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
        totalsByCategory[d.category] = (totalsByCategory[d.category] ?? 0) + 1;
      }

      totalsByEntityType[entityType] ??= { submissions: 0, discrepancies: 0 };
      totalsByEntityType[entityType].submissions += 1;
      totalsByEntityType[entityType].discrepancies += result.discrepancies.length;

      perSubmission.push({
        submissionId: submission.submissionId,
        entityType,
        fieldsChecked: result.fieldsChecked,
        discrepancyCount: result.discrepancies.length,
        byCategory,
        sampleDiscrepancies: result.discrepancies
          .slice(0, 10)
          .map((d) => ({ category: d.category, fieldId: d.fieldId })),
      });
    } catch (e) {
      crashed += 1;
      console.error(`Validator crashed on submission ${submission.submissionId}: ${(e as Error).message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    submissionsChecked: perSubmission.length,
    submissionsSkippedUnknownEntityType: submissions.length - perSubmission.length - crashed,
    validatorCrashes: crashed,
    totalsByCategory,
    totalsByEntityType,
    submissionsWithZeroDiscrepancies: perSubmission.filter((s) => s.discrepancyCount === 0).length,
    perSubmission,
  };

  const outPath = join(process.cwd(), `shadow-validation-report-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`Checked ${report.submissionsChecked} submissions.`);
  console.log(`Zero-discrepancy: ${report.submissionsWithZeroDiscrepancies}`);
  console.log(`Totals by category:`, report.totalsByCategory);
  console.log(`Totals by entity type:`, report.totalsByEntityType);
  console.log(`Full report written to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
