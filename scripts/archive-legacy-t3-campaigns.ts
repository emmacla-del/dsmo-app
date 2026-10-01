/**
 * scripts/archive-legacy-t3-campaigns.ts
 *
 * STEP 1 of 0.3: Archives duplicate legacy T3 ONEFOP campaigns.
 *
 * Targets ONLY:
 *  - QUARTERLY_2026_T3_001
 *  - QUARTERLY_2026_T3_007
 *  - QUARTERLY_2026_T3_008
 *  - QUARTERLY_2026_T3_009
 *
 * NEVER touches:
 *  - QUARTERLY_2026_T3_010 (kept as the single active/reference T3 ONEFOP campaign)
 *  - QUARTERLY_2026_T3_002 (DSMO campaign)
 *  - Standalone rounds with campaignId = null
 *
 * Requirements:
 *  - Requires --actor-email=<email> to attribute round closure and AuditLog records.
 *  - Actor must be an ACTIVE user with role SUPER_ADMIN, SUPER_ADMIN_ONEFOP, or CENTRAL.
 *
 * Behavior:
 *  - Default (no --apply flag): DRY-RUN mode. Validates actor, prints each campaign status,
 *    linked round, CampaignSubmission count, and OnefopSubmission count. Modifies nothing.
 *  - With --apply: Runs in a single Prisma transaction:
 *    - Updates campaign status to 'ARCHIVED'
 *    - Closes open rounds (status -> 'CLOSED', sets closedAt and closedBy)
 *    - Writes an AuditLog row per campaign referencing actor.id
 */

import { PrismaClient } from '@prisma/client';

const TARGET_CODES = [
  'QUARTERLY_2026_T3_001',
  'QUARTERLY_2026_T3_007',
  'QUARTERLY_2026_T3_008',
  'QUARTERLY_2026_T3_009',
];

const PROTECTED_CODES = [
  'QUARTERLY_2026_T3_010',
  'QUARTERLY_2026_T3_002',
];

const ALLOWED_ACTOR_ROLES = ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL'] as const;

async function main() {
  const isApply = process.argv.includes('--apply');
  const actorEmailArg = process.argv.find((arg) => arg.startsWith('--actor-email='));
  const actorEmail = actorEmailArg ? actorEmailArg.split('=')[1]?.trim() : null;

  console.log('===============================================================');
  console.log('  0.3 STEP 1: Archive Duplicate Legacy T3 ONEFOP Campaigns');
  console.log(`  Mode: ${isApply ? '>>> APPLY (TRANSACTIONAL WRITE) <<<' : 'DRY-RUN (READ-ONLY)'}`);
  console.log('===============================================================\n');

  if (!actorEmail) {
    console.error('ERROR: Missing required argument --actor-email=<email>');
    console.error('The script requires a valid actor email to assign closedBy and AuditLog records.');
    console.error('Example:');
    console.error('  npx ts-node scripts/archive-legacy-t3-campaigns.ts --actor-email=admin@example.com');
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
      console.error(`ERROR: User "${actor.email}" is not ACTIVE (status: inactive).`);
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

    // 2. Fetch targeted campaigns with their round and submission counts
    const campaigns = await prisma.dataCampaign.findMany({
      where: {
        code: { in: TARGET_CODES },
      },
      include: {
        round: true,
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    if (campaigns.length === 0) {
      console.log('No targeted campaigns found in database. Nothing to do.');
      return;
    }

    console.log(`Found ${campaigns.length} targeted campaign(s):\n`);

    const summaryList: Array<{
      id: string;
      code: string;
      name: string;
      collectionType: string;
      currentStatus: string;
      round: { id: string; quarterCode: string; status: string } | null;
      campaignSubmissionsCount: number;
      onefopSubmissionsCount: number;
    }> = [];

    for (const c of campaigns) {
      // Safety check: ensure no protected campaign was somehow queried
      if (PROTECTED_CODES.includes(c.code)) {
        throw new Error(`CRITICAL ABORT: Protected campaign ${c.code} was included in archive target!`);
      }
      if (c.collectionType !== 'ONEFOP') {
        throw new Error(`CRITICAL ABORT: Campaign ${c.code} is not ONEFOP (type: ${c.collectionType})!`);
      }

      let onefopCount = 0;
      if (c.round?.quarterCode) {
        onefopCount = await prisma.onefopSubmission.count({
          where: { quarterCode: c.round.quarterCode },
        });
      }

      summaryList.push({
        id: c.id,
        code: c.code,
        name: c.name,
        collectionType: c.collectionType,
        currentStatus: c.status,
        round: c.round ? { id: c.round.id, quarterCode: c.round.quarterCode, status: c.round.status } : null,
        campaignSubmissionsCount: c._count.submissions,
        onefopSubmissionsCount: onefopCount,
      });
    }

    // Print details for each campaign
    for (const item of summaryList) {
      console.log(`- Campaign: ${item.code} (${item.name})`);
      console.log(`  ID:                         ${item.id}`);
      console.log(`  Collection Type:            ${item.collectionType}`);
      console.log(`  Current Status:             ${item.currentStatus} -> Target: ARCHIVED`);
      console.log(`  CampaignSubmissions:        ${item.campaignSubmissionsCount}`);
      
      if (!item.round) {
        console.log(`  Linked Round:               None`);
      } else {
        const willClose = item.round.status === 'OPEN' || item.round.status === 'EXTENDED';
        console.log(
          `  Linked Round:               [ID: ${item.round.id}] quarterCode: "${item.round.quarterCode}" | status: ${item.round.status}${
            willClose ? ' -> will CLOSE' : ''
          } | OnefopSubmissions: ${item.onefopSubmissionsCount}`,
        );
      }
      console.log('');
    }

    // Check protected campaigns status just to display for peace of mind
    const protectedCampaigns = await prisma.dataCampaign.findMany({
      where: { code: { in: PROTECTED_CODES } },
      select: { code: true, name: true, status: true, collectionType: true },
    });
    console.log('Protected Campaigns (untouched):');
    for (const p of protectedCampaigns) {
      console.log(`  * ${p.code} (${p.collectionType}) status: ${p.status}`);
    }
    console.log('');

    if (!isApply) {
      console.log('---------------------------------------------------------------');
      console.log('DRY-RUN COMPLETE. No changes were made to the database.');
      console.log('To apply these changes in a transaction, re-run with --apply:');
      console.log(`  npx ts-node scripts/archive-legacy-t3-campaigns.ts --actor-email=${actor.email} --apply`);
      console.log('---------------------------------------------------------------');
      return;
    }

    // 3. APPLY MODE: execute in a single transaction
    console.log('>>> Executing archival in a single transaction...');

    await prisma.$transaction(async (tx) => {
      for (const item of summaryList) {
        // A. Archive campaign
        await tx.dataCampaign.update({
          where: { id: item.id },
          data: {
            status: 'ARCHIVED',
            closedAt: new Date(),
          },
        });
        console.log(`  [OK] Campaign ${item.code} status -> ARCHIVED`);

        // B. Close open round if present
        let closedRoundInfo: { id: string; quarterCode: string; prevStatus: string } | null = null;
        if (item.round && (item.round.status === 'OPEN' || item.round.status === 'EXTENDED')) {
          await tx.submissionRound.update({
            where: { id: item.round.id },
            data: {
              status: 'CLOSED',
              closedAt: new Date(),
              closedBy: actor.id,
            },
          });
          closedRoundInfo = { id: item.round.id, quarterCode: item.round.quarterCode, prevStatus: item.round.status };
          console.log(`  [OK] Round ${item.round.quarterCode} (${item.round.id}) status -> CLOSED (by ${actor.email})`);
        }

        // C. Write AuditLog
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'CAMPAIGN_ARCHIVED',
            resourceType: 'DataCampaign',
            resourceId: item.id,
            details: {
              script: 'archive-legacy-t3-campaigns.ts',
              actorEmail: actor.email,
              actorRole: actor.role,
              code: item.code,
              previousStatus: item.currentStatus,
              newStatus: 'ARCHIVED',
              collectionType: item.collectionType,
              roundClosed: closedRoundInfo,
              campaignSubmissionsCount: item.campaignSubmissionsCount,
              onefopSubmissionsCount: item.onefopSubmissionsCount,
              reason: '0.3 migration cleanup: archive duplicate legacy T3 ONEFOP campaigns',
              timestamp: new Date().toISOString(),
            },
          },
        });
        console.log(`  [OK] AuditLog written for campaign ${item.code}`);
      }
    });

    console.log('\n===============================================================');
    console.log('SUCCESS: All 4 campaigns archived, open rounds closed, and audit logs recorded.');
    console.log('===============================================================');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nERROR during script execution:', err);
  process.exit(1);
});
