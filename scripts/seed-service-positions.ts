/**
 * Fills service_positions, and nothing else.
 *
 * The organigramme is in the database -- 126 services -- and this is the
 * narrow, repeatable updater for their position catalogue. The full
 * prisma/seed.ts also creates test accounts, sample companies and specimen
 * ONEFOP submissions, so it must not be run against a database with real
 * registrations.
 *
 * This takes only the two position-catalogue steps that matter:
 *
 *   1. the explicit positions, imported from the seed so the two cannot
 *      drift apart;
 *   2. a STAFF position ("Cadre" / "Officer") for every service, so no
 *      service is left with nothing to offer.
 *
 * Idempotent: every write is an upsert keyed on (serviceCode, positionType),
 * so running it twice changes nothing. Nothing is ever deleted.
 *
 *   npm run seed:positions -- --dry-run   count what would change
 *   npm run seed:positions                apply it
 */
import { PrismaClient } from '@prisma/client';
import { servicePositions } from '../prisma/seed';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const services = await prisma.minefopService.findMany({ select: { code: true } });
  const known = new Set(services.map((s) => s.code));
  const before = await prisma.servicePosition.count();

  // A position for a service the organigramme does not have would fail on the
  // foreign key; say so rather than stopping half way through.
  const orphans = servicePositions.filter((p) => !known.has(p.serviceCode));
  const usable = servicePositions.filter((p) => known.has(p.serviceCode));

  console.log(`services in database : ${services.length}`);
  console.log(`positions now        : ${before}`);
  console.log(`explicit to apply    : ${usable.length}`);
  console.log(`STAFF to apply       : ${services.length}`);
  if (orphans.length) {
    console.log(`skipped, no service  : ${orphans.length}`);
    for (const o of orphans.slice(0, 10)) console.log(`   ${o.serviceCode} / ${o.positionType}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  for (const p of usable) {
    await prisma.servicePosition.upsert({
      where: { serviceCode_positionType: { serviceCode: p.serviceCode, positionType: p.positionType } },
      update: { title: p.title, titleEn: p.titleEn, level: p.level, orderIndex: p.orderIndex, isActive: true },
      create: { ...p, isActive: true },
    });
  }

  for (const s of services) {
    await prisma.servicePosition.upsert({
      where: { serviceCode_positionType: { serviceCode: s.code, positionType: 'STAFF' } },
      update: { title: 'Cadre', titleEn: 'Officer', level: 2, orderIndex: 999, isActive: true },
      create: {
        serviceCode: s.code,
        positionType: 'STAFF',
        title: 'Cadre',
        titleEn: 'Officer',
        level: 2,
        orderIndex: 999,
        isActive: true,
      },
    });
  }

  const after = await prisma.servicePosition.count();
  console.log(`\npositions now        : ${after} (${after - before} added)`);
}

main()
  .catch((err) => {
    console.error('failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
