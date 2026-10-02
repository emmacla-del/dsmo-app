/**
 * scripts/backfill-company-establishment-ids.ts
 *
 * R.1 follow-up: issues the missing establishment IDs for companies that
 * were activated before registration review existed.
 *
 * Targets ONLY:
 *  - Company rows whose establishmentId is null
 *  - whose owning User has role COMPANY and status ACTIVE
 *
 * NEVER touches:
 *  - companies that already hold an establishmentId (idempotent: a second
 *    run finds nothing to do)
 *  - companies whose user is PENDING_APPROVAL, COMPLEMENTS_REQUESTED,
 *    REJECTED or any other status — those get their ID from the normal
 *    approval path (AuthService.approveUser)
 *  - entityType / subdivision / territory, or any other company column
 *
 * Rows missing the data the ID is derived from (entityType or subdivisionId,
 * or a subdivision with no code) are reported as SKIPPED and left alone.
 * They need a data fix first; the script will not guess a code.
 *
 * Requirements:
 *  - Requires --actor-email=<email> to attribute the AuditLog records.
 *  - Actor must be an ACTIVE user with role SUPER_ADMIN,
 *    SUPER_ADMIN_ONEFOP, or CENTRAL.
 *
 * Behavior:
 *  - Default (no --apply flag): DRY-RUN mode. Validates the actor, lists
 *    every candidate with the ID it would receive, and lists the skips.
 *    Modifies nothing.
 *  - With --apply: runs in a single Prisma transaction, allocating through
 *    the same EstablishmentIdGenerator path as approval — which takes
 *    pg_advisory_xact_lock on (prefix, year), so a concurrent approval
 *    cannot hand out a colliding serial. One AuditLog row per company.
 *
 * Usage:
 *   npx ts-node scripts/backfill-company-establishment-ids.ts --actor-email=admin@example.com
 *   npx ts-node scripts/backfill-company-establishment-ids.ts --actor-email=admin@example.com --apply
 */

import { PrismaClient } from '@prisma/client';
import { EstablishmentIdGenerator } from '../src/common/utils/establishment-id.generator';

const ALLOWED_ACTOR_ROLES = ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL'] as const;

// 29 rows at the time of writing, each needing a handful of queries. The
// Prisma default interactive-transaction timeout (5s) is too tight for that
// over a remote database, and the whole point is that it is one transaction.
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 180_000 };

type Candidate = {
  id: string;
  name: string;
  entityType: string;
  subdivisionId: string;
  subdivisionCode: string;
  userId: string;
  email: string;
};

type Skip = {
  id: string;
  name: string;
  reason: string;
};

async function main() {
  const isApply = process.argv.includes('--apply');
  const actorEmailArg = process.argv.find((arg) => arg.startsWith('--actor-email='));
  const actorEmail = actorEmailArg ? actorEmailArg.split('=')[1]?.trim() : null;

  console.log('===============================================================');
  console.log('  R.1: Backfill establishment IDs for ACTIVE companies');
  console.log(`  Mode: ${isApply ? '>>> APPLY (TRANSACTIONAL WRITE) <<<' : 'DRY-RUN (READ-ONLY)'}`);
  console.log('===============================================================\n');

  if (!actorEmail) {
    console.error('ERROR: Missing required argument --actor-email=<email>');
    console.error('The script requires a valid actor email to attribute the AuditLog records.');
    console.error('Example:');
    console.error('  npx ts-node scripts/backfill-company-establishment-ids.ts --actor-email=admin@example.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 1. Resolve and validate actor
    const actor = await prisma.user.findFirst({
      where: { email: { equals: actorEmail, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        status: true,
      },
    });

    if (!actor) {
      console.error(`ERROR: User with email "${actorEmail}" was not found in the database.`);
      process.exit(1);
    }
    if (!actor.isActive || actor.status !== 'ACTIVE') {
      console.error(
        `ERROR: User "${actor.email}" is not ACTIVE (isActive: ${actor.isActive}, status: ${actor.status}).`,
      );
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
    console.log(`  Role: ${actor.role} (Active: ${actor.isActive}, Status: ${actor.status})\n`);

    // 2. Collect candidates: ACTIVE companies with no establishment ID
    const rows = await prisma.company.findMany({
      where: {
        establishmentId: null,
        user: { role: 'COMPANY', status: 'ACTIVE' },
      },
      select: {
        id: true,
        name: true,
        entityType: true,
        subdivisionId: true,
        userId: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) {
      console.log('No ACTIVE company is missing an establishment ID. Nothing to do.');
      return;
    }

    console.log(`Found ${rows.length} ACTIVE company/companies with no establishment ID.\n`);

    // Resolve subdivision codes in one query rather than per row.
    const subdivisionIds = [
      ...new Set(rows.map((row) => row.subdivisionId).filter((id): id is string => !!id)),
    ];
    const subdivisions = subdivisionIds.length
      ? await prisma.subdivision.findMany({
          where: { id: { in: subdivisionIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const subdivisionById = new Map(subdivisions.map((s) => [s.id, s]));

    const candidates: Candidate[] = [];
    const skips: Skip[] = [];

    for (const row of rows) {
      if (!row.entityType) {
        skips.push({ id: row.id, name: row.name, reason: 'entityType is null' });
        continue;
      }
      if (!row.subdivisionId) {
        skips.push({ id: row.id, name: row.name, reason: 'subdivisionId is null' });
        continue;
      }
      const subdivision = subdivisionById.get(row.subdivisionId);
      if (!subdivision?.code?.trim()) {
        skips.push({
          id: row.id,
          name: row.name,
          reason: `subdivision ${row.subdivisionId} has no code`,
        });
        continue;
      }
      candidates.push({
        id: row.id,
        name: row.name,
        entityType: row.entityType,
        subdivisionId: row.subdivisionId,
        subdivisionCode: subdivision.code.slice(-2),
        userId: row.userId,
        email: row.user.email,
      });
    }

    if (skips.length > 0) {
      console.log(`SKIPPED (${skips.length}) — missing the data the ID is derived from:`);
      for (const skip of skips) {
        console.log(`  ! ${skip.name} [${skip.id}]: ${skip.reason}`);
      }
      console.log('  These need a data fix before they can be given an ID.\n');
    }

    if (candidates.length === 0) {
      console.log('No company has enough data to receive an establishment ID. Nothing to do.');
      return;
    }

    console.log(`ELIGIBLE (${candidates.length}):`);
    for (const candidate of candidates) {
      console.log(`  - ${candidate.name} [${candidate.id}]`);
      console.log(`    User:        <${candidate.email}>`);
      console.log(`    Entity type: ${candidate.entityType}`);
      console.log(`    Subdivision: ${candidate.subdivisionId} (code suffix ${candidate.subdivisionCode})`);
    }
    console.log('');

    if (!isApply) {
      console.log('---------------------------------------------------------------');
      console.log('DRY-RUN COMPLETE. No changes were made to the database.');
      console.log('Serial numbers are allocated inside the write transaction, so the');
      console.log('exact IDs are not predicted here — only which rows would receive one.');
      console.log('To apply these changes in a single transaction, re-run with --apply:');
      console.log(
        `  npx ts-node scripts/backfill-company-establishment-ids.ts --actor-email=${actor.email} --apply`,
      );
      console.log('---------------------------------------------------------------');
      return;
    }

    // 3. APPLY MODE: one transaction, same generator path as approval
    console.log('>>> Allocating establishment IDs in a single transaction...');

    const issued = await prisma.$transaction(async (tx) => {
      const results: Array<{ companyId: string; name: string; establishmentId: string }> = [];

      for (const candidate of candidates) {
        // Re-read inside the transaction: if an approval landed between the
        // read above and this write, the row already has an ID and must be
        // left alone.
        const current = await tx.company.findUnique({
          where: { id: candidate.id },
          select: { establishmentId: true },
        });
        if (current?.establishmentId) {
          console.log(
            `  [SKIP] ${candidate.name} already has ${current.establishmentId} (issued concurrently)`,
          );
          continue;
        }

        const establishmentId = await EstablishmentIdGenerator.generate(
          tx,
          candidate.entityType,
          candidate.subdivisionCode,
        );

        await tx.company.update({
          where: { id: candidate.id },
          data: { establishmentId, establishmentIdGeneratedAt: new Date() },
        });
        console.log(`  [OK] ${candidate.name} -> ${establishmentId}`);

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'COMPANY_ESTABLISHMENT_ID_BACKFILLED',
            resourceType: 'Company',
            resourceId: candidate.id,
            details: {
              script: 'backfill-company-establishment-ids.ts',
              actorEmail: actor.email,
              actorRole: actor.role,
              companyId: candidate.id,
              companyName: candidate.name,
              companyUserId: candidate.userId,
              entityType: candidate.entityType,
              subdivisionId: candidate.subdivisionId,
              establishmentId,
              reason:
                'R.1: establishment IDs are issued at approval; these companies were activated before review existed',
              timestamp: new Date().toISOString(),
            },
          },
        });
        results.push({ companyId: candidate.id, name: candidate.name, establishmentId });
      }

      return results;
    }, TRANSACTION_OPTIONS);

    console.log('\n===============================================================');
    console.log(`SUCCESS: ${issued.length} establishment ID(s) issued and audited.`);
    if (skips.length > 0) {
      console.log(`${skips.length} row(s) skipped — see the SKIPPED list above.`);
    }
    console.log('No attestation PDF is generated and no e-mail is sent: these');
    console.log('accounts are already active and were never told to expect one.');
    console.log('===============================================================');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nERROR during script execution:', err);
  process.exit(1);
});
