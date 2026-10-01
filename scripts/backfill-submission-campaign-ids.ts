/**
 * scripts/backfill-submission-campaign-ids.ts
 *
 * STEP 2 of 0.3: Backfill campaignId on existing OnefopSubmission records.
 *
 * Matching rule:
 *  - OnefopSubmission.quarterCode -> SubmissionRound(quarterCode, module: ONEFOP) -> campaignId
 *  - Legacy "2025-T1" rows and rounds without a campaign stay null.
 *
 * Requirements:
 *  - Requires --actor-email=<email> to validate actor and write AuditLog in apply mode.
 *  - Actor must be an ACTIVE user with role SUPER_ADMIN, SUPER_ADMIN_ONEFOP, or CENTRAL.
 *
 * Modes:
 *  - Default (no --apply): DRY-RUN mode. Validates actor, inspects all OnefopSubmission rows,
 *    prints matched campaigns and explanations for rows staying null. Modifies nothing.
 *  - With --apply: Runs in a single Prisma transaction:
 *    - Updates campaignId on matched OnefopSubmission rows
 *    - Writes an AuditLog record summarizing the backfill operation
 */

import { PrismaClient } from '@prisma/client';

const ALLOWED_ACTOR_ROLES = ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL'] as const;

interface BackfillMatch {
  submissionDbId: string;
  submissionFormId: string;
  quarterCode: string | null;
  roundId: string;
  roundQuarterCode: string;
  campaignId: string;
  campaignCode: string;
  campaignStatus: string;
  alreadyLinked: boolean;
}

interface BackfillSkip {
  submissionDbId: string;
  submissionFormId: string;
  quarterCode: string | null;
  reason: string;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const actorEmailArg = process.argv.find((arg) => arg.startsWith('--actor-email='));
  const actorEmail = actorEmailArg ? actorEmailArg.split('=')[1]?.trim() : null;

  console.log('===============================================================');
  console.log('  0.3 STEP 2: Backfill Submission Campaign IDs');
  console.log(`  Mode: ${isApply ? '>>> APPLY (TRANSACTIONAL WRITE) <<<' : 'DRY-RUN (READ-ONLY)'}`);
  console.log('===============================================================\n');

  if (!actorEmail) {
    console.error('ERROR: Missing required argument --actor-email=<email>');
    console.error('The script requires a valid actor email to assign AuditLog records.');
    console.error('Example:');
    console.error('  node --env-file=.env -r ts-node/register scripts/backfill-submission-campaign-ids.ts --actor-email=admin@example.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 1. Resolve and validate actor
    const actor = await prisma.user.findFirst({
      where: {
        email: { equals: actorEmail, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!actor) {
      console.error(`ERROR: User with email "${actorEmail}" was not found in the database.`);
      process.exit(1);
    }

    if (!actor.isActive) {
      console.error(`ERROR: User "${actor.email}" is not ACTIVE.`);
      process.exit(1);
    }

    if (!ALLOWED_ACTOR_ROLES.includes(actor.role as any)) {
      console.error(
        `ERROR: User "${actor.email}" has role "${actor.role}". Must be one of: ${ALLOWED_ACTOR_ROLES.join(', ')}.`,
      );
      process.exit(1);
    }

    const actorFullName = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
    console.log(`Resolved Actor: ${actorFullName ? `${actorFullName} ` : ''}<${actor.email}>`);
    console.log(`  ID:   ${actor.id}`);
    console.log(`  Role: ${actor.role} (Active: ${actor.isActive})\n`);

    // 2. Fetch all SubmissionRounds with module ONEFOP and linked campaigns
    const rounds = await prisma.submissionRound.findMany({
      where: {
        module: 'ONEFOP',
      },
      include: {
        campaign: {
          select: {
            id: true,
            code: true,
            status: true,
            collectionType: true,
          },
        },
      },
    });

    const roundByQuarterCode = new Map<string, (typeof rounds)[0]>();
    for (const r of rounds) {
      roundByQuarterCode.set(r.quarterCode, r);
    }

    // 3. Fetch all OnefopSubmissions
    const submissions = await prisma.onefopSubmission.findMany({
      select: {
        id: true,
        submissionId: true,
        quarterCode: true,
        campaignId: true,
        status: true,
        companyId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total OnefopSubmission records inspected: ${submissions.length}\n`);

    const matches: BackfillMatch[] = [];
    const skips: BackfillSkip[] = [];

    for (const sub of submissions) {
      const qc = sub.quarterCode?.trim() ?? null;

      if (!qc) {
        skips.push({
          submissionDbId: sub.id,
          submissionFormId: sub.submissionId,
          quarterCode: null,
          reason: 'No quarterCode stored on submission (null/empty)',
        });
        continue;
      }

      if (qc === '2025-T1') {
        skips.push({
          submissionDbId: sub.id,
          submissionFormId: sub.submissionId,
          quarterCode: qc,
          reason: 'Legacy default quarterCode "2025-T1" has no campaign',
        });
        continue;
      }

      const matchedRound = roundByQuarterCode.get(qc);
      if (!matchedRound) {
        skips.push({
          submissionDbId: sub.id,
          submissionFormId: sub.submissionId,
          quarterCode: qc,
          reason: `No ONEFOP SubmissionRound found for quarterCode "${qc}"`,
        });
        continue;
      }

      if (!matchedRound.campaignId || !matchedRound.campaign) {
        skips.push({
          submissionDbId: sub.id,
          submissionFormId: sub.submissionId,
          quarterCode: qc,
          reason: `Round "${matchedRound.quarterCode}" (${matchedRound.id}) has no linked campaign (campaignId is null)`,
        });
        continue;
      }

      const alreadyLinked = sub.campaignId === matchedRound.campaign.id;
      matches.push({
        submissionDbId: sub.id,
        submissionFormId: sub.submissionId,
        quarterCode: qc,
        roundId: matchedRound.id,
        roundQuarterCode: matchedRound.quarterCode,
        campaignId: matchedRound.campaign.id,
        campaignCode: matchedRound.campaign.code,
        campaignStatus: matchedRound.campaign.status,
        alreadyLinked,
      });
    }

    // Print Matches
    console.log('---------------------------------------------------------------');
    console.log(`MATCHED SUBMISSIONS: ${matches.length}`);
    console.log('---------------------------------------------------------------');
    if (matches.length === 0) {
      console.log('  None.');
    } else {
      for (const m of matches) {
        const linkStatus = m.alreadyLinked ? '[ALREADY LINKED]' : '[WILL LINK]';
        console.log(`  * ${linkStatus} Sub: ${m.submissionFormId} (${m.submissionDbId})`);
        console.log(`      quarterCode: "${m.quarterCode}"`);
        console.log(`      Matched Round:    ${m.roundQuarterCode} (${m.roundId})`);
        console.log(`      Target Campaign:  ${m.campaignCode} (${m.campaignId}) [Status: ${m.campaignStatus}]`);
      }
    }
    console.log('');

    // Print Skips
    console.log('---------------------------------------------------------------');
    console.log(`UNLINKED / SKIPPED SUBMISSIONS (STAY NULL): ${skips.length}`);
    console.log('---------------------------------------------------------------');
    if (skips.length === 0) {
      console.log('  None.');
    } else {
      // Group skips by reason for concise readability, then show individual items
      const countByReason: Record<string, number> = {};
      for (const s of skips) {
        countByReason[s.reason] = (countByReason[s.reason] ?? 0) + 1;
      }
      console.log('Summary by reason:');
      for (const [reason, count] of Object.entries(countByReason)) {
        console.log(`  - ${reason}: ${count} submission(s)`);
      }
      console.log('\nDetails:');
      for (const s of skips) {
        console.log(`  * Sub: ${s.submissionFormId} (${s.submissionDbId}) | quarterCode: ${s.quarterCode ?? 'NULL'}`);
        console.log(`      Reason: ${s.reason}`);
      }
    }
    console.log('');

    const toUpdate = matches.filter((m) => !m.alreadyLinked);

    if (!isApply) {
      console.log('===============================================================');
      console.log('DRY-RUN COMPLETE. No changes were made to the database.');
      console.log(`  Total inspected:      ${submissions.length}`);
      console.log(`  Matches found:        ${matches.length} (${toUpdate.length} pending update, ${matches.length - toUpdate.length} already linked)`);
      console.log(`  Staying null:         ${skips.length}`);
      console.log('\nTo execute this backfill in a transaction, re-run with --apply:');
      console.log(`  node --env-file=.env -r ts-node/register scripts/backfill-submission-campaign-ids.ts --actor-email=${actor.email} --apply`);
      console.log('===============================================================');
      return;
    }

    // 4. APPLY MODE: execute updates and audit log in one transaction
    console.log(`>>> Executing backfill for ${toUpdate.length} submission(s) in a single transaction...`);

    if (toUpdate.length === 0) {
      console.log('All matched submissions are already linked. Nothing to update.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const item of toUpdate) {
        await tx.onefopSubmission.update({
          where: { id: item.submissionDbId },
          data: {
            campaignId: item.campaignId,
          },
        });
        console.log(`  [OK] Sub ${item.submissionFormId} -> Linked to Campaign ${item.campaignCode}`);
      }

      // Write single comprehensive AuditLog entry
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'SUBMISSIONS_CAMPAIGN_BACKFILL',
          resourceType: 'OnefopSubmission',
          resourceId: 'BACKFILL_ONEFOP_CAMPAIGNS',
          details: {
            script: 'backfill-submission-campaign-ids.ts',
            actorEmail: actor.email,
            actorRole: actor.role,
            totalInspected: submissions.length,
            updatedCount: toUpdate.length,
            alreadyLinkedCount: matches.length - toUpdate.length,
            skippedCount: skips.length,
            updatedSubmissions: toUpdate.map((u) => ({
              submissionDbId: u.submissionDbId,
              submissionFormId: u.submissionFormId,
              quarterCode: u.quarterCode,
              campaignCode: u.campaignCode,
              campaignId: u.campaignId,
            })),
            skipReasonsSummary: skips.reduce<Record<string, number>>((acc, s) => {
              acc[s.reason] = (acc[s.reason] ?? 0) + 1;
              return acc;
            }, {}),
            timestamp: new Date().toISOString(),
          },
        },
      });
      console.log(`  [OK] AuditLog entry written (Actor: ${actor.email})`);
    });

    console.log('\n===============================================================');
    console.log(`SUCCESS: ${toUpdate.length} OnefopSubmission record(s) linked to their campaigns.`);
    console.log('===============================================================');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nERROR during script execution:', err);
  process.exit(1);
});
