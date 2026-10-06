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
 *    the same EstablishmentIdGenerator path as registration and approval:
 *    the (prefix, year) Postgres sequence, so a concurrent registration
 *    cannot receive a colliding serial. nextval() does not roll back, so a
 *    rolled-back --apply leaves gaps in the serials. One AuditLog row per
 *    company.
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
  regionId: string | null;
  departmentId: string | null;
  subdivisionId: string;
  subdivisionCode: string;
  region: string | null;
  department: string | null;
  subdivision: string | null;
  address: string | null;
  phone: string | null;
  userId: string;
  email: string;
};

type Skip = {
  id: string;
  name: string;
  reason: string;
};

export type BackfillOptions = {
  actorEmail: string;
  isApply?: boolean;
};

export type BackfillResult = {
  candidates: Candidate[];
  skips: Skip[];
  issued: Array<{ companyId: string; name: string; establishmentId: string }>;
};

export async function runBackfill(
  prisma: PrismaClient,
  options: BackfillOptions,
): Promise<BackfillResult> {
  const { actorEmail, isApply = false } = options;

  console.log('===============================================================');
  console.log('  R.1: Backfill establishment IDs for ACTIVE companies');
  console.log(`  Mode: ${isApply ? '>>> APPLY (TRANSACTIONAL WRITE) <<<' : 'DRY-RUN (READ-ONLY)'}`);
  console.log('===============================================================\n');

  if (!actorEmail) {
    throw new Error('Missing required argument --actor-email=<email>');
  }

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
    throw new Error(`User with email "${actorEmail}" was not found in the database.`);
  }
  if (!actor.isActive || actor.status !== 'ACTIVE') {
    throw new Error(
      `User "${actor.email}" is not ACTIVE (isActive: ${actor.isActive}, status: ${actor.status}).`,
    );
  }
  if (!ALLOWED_ACTOR_ROLES.includes(actor.role as any)) {
    throw new Error(
      `User "${actor.email}" has role "${actor.role}". Must be one of: ${ALLOWED_ACTOR_ROLES.join(', ')}.`,
    );
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
      regionId: true,
      departmentId: true,
      subdivisionId: true,
      region: true,
      department: true,
      subdivision: true,
      address: true,
      phone: true,
      userId: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (rows.length === 0) {
    console.log('No ACTIVE company is missing an establishment ID. Nothing to do.');
    return { candidates: [], skips: [], issued: [] };
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
      regionId: row.regionId,
      departmentId: row.departmentId,
      subdivisionId: row.subdivisionId,
      subdivisionCode: subdivision.code.slice(-2),
      region: row.region,
      department: row.department,
      subdivision: row.subdivision,
      address: row.address,
      phone: row.phone,
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
    return { candidates: [], skips, issued: [] };
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
    return { candidates, skips, issued: [] };
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

      await tx.establishment.create({
        data: {
          code: `${establishmentId}-01`,
          name: candidate.name || 'Siège Principal',
          isPrincipal: true,
          status: 'ACTIVE',
          companyId: candidate.id,
          regionId: candidate.regionId || '',
          departmentId: candidate.departmentId || '',
          subdivisionId: candidate.subdivisionId || '',
          region: candidate.region || '',
          department: candidate.department || '',
          subdivision: candidate.subdivision || '',
          address: candidate.address || '',
          phone: candidate.phone || null,
          email: candidate.email || null,
        },
      });
      console.log(`  [OK] ${candidate.name} -> ${establishmentId} (principal: ${establishmentId}-01)`);

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
            establishmentCode: `${establishmentId}-01`,
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

  return { candidates, skips, issued };
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const actorEmailArg = process.argv.find((arg) => arg.startsWith('--actor-email='));
  const actorEmail = actorEmailArg ? actorEmailArg.split('=')[1]?.trim() : null;

  if (!actorEmail) {
    console.error('ERROR: Missing required argument --actor-email=<email>');
    console.error('The script requires a valid actor email to attribute the AuditLog records.');
    console.error('Example:');
    console.error('  npx ts-node scripts/backfill-company-establishment-ids.ts --actor-email=admin@example.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    await runBackfill(prisma, { actorEmail, isApply });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nERROR during script execution:', err);
    process.exit(1);
  });
}
