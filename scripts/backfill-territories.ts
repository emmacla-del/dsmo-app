import { PrismaClient } from '@prisma/client';
import { resolveAndValidateTerritory } from '../src/territory/territory-resolver';

interface BackfillResult {
  inspected: number;
  alreadyValid: number;
  matched: Array<{
    id: string;
    identifier: string;
    text: { region?: string | null; department?: string | null; subdivision?: string | null };
    resolved: {
      regionId: string;
      region: string;
      departmentId: string;
      department: string;
      subdivisionId: string | null;
      subdivision: string | null;
    };
    recoveredByRule?: string;
  }>;
  unmatched: Array<{
    id: string;
    identifier: string;
    text: { region?: string | null; department?: string | null; subdivision?: string | null };
    reason: string;
  }>;
}

function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

/**
 * Test data recovery helper ONLY — applies "department wins" to seeded test companies.
 * Derives region from department; keeps subdivision only if it belongs to that department,
 * otherwise uses the first subdivision of that department.
 * NEVER used in production or general resolution logic.
 */
function resolveTestCompanyDepartmentWins(
  company: { name?: string | null; region?: string | null; department?: string | null; subdivision?: string | null },
  allDepartments: Array<{ id: string; name: string; regionId: string }>,
  allRegions: Array<{ id: string; name: string }>,
  allSubdivisions: Array<{ id: string; name: string; departmentId: string }>,
): {
  regionId: string;
  region: string;
  departmentId: string;
  department: string;
  subdivisionId: string | null;
  subdivision: string | null;
  recovered: boolean;
  notes: string;
} | null {
  if (!company.department) return null;

  const deptNorm = normalizeName(company.department);
  const matchedDept = allDepartments.find(d => normalizeName(d.name) === deptNorm);
  if (!matchedDept) return null;

  const matchedRegion = allRegions.find(r => r.id === matchedDept.regionId);
  if (!matchedRegion) return null;

  const deptSubdivs = allSubdivisions.filter(s => s.departmentId === matchedDept.id);
  let resolvedSubdiv: { id: string; name: string } | undefined;

  if (company.subdivision) {
    const subdivNorm = normalizeName(company.subdivision);
    resolvedSubdiv = deptSubdivs.find(s => normalizeName(s.name) === subdivNorm);
  }

  // If subdivision doesn't belong or is missing, use first subdivision of department
  if (!resolvedSubdiv && deptSubdivs.length > 0) {
    resolvedSubdiv = deptSubdivs[0];
  }

  return {
    regionId: matchedRegion.id,
    region: matchedRegion.name,
    departmentId: matchedDept.id,
    department: matchedDept.name,
    subdivisionId: resolvedSubdiv ? resolvedSubdiv.id : null,
    subdivision: resolvedSubdiv ? resolvedSubdiv.name : null,
    recovered: true,
    notes: `Department wins rule: derived region '${matchedRegion.name}' from department '${matchedDept.name}', subdivision '${resolvedSubdiv?.name ?? 'N/A'}'`,
  };
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply || process.argv.includes('--dry-run');
  const fixTestSeedMismatches = process.argv.includes('--fix-test-seed-mismatches');

  console.log('='.repeat(70));
  console.log(`TERRITORY BACKFILL SCRIPT`);
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (No writes)' : 'APPLY (Writing changes)'}`);
  console.log(`  Test seed recovery: ${fixTestSeedMismatches ? 'ENABLED (--fix-test-seed-mismatches)' : 'DISABLED'}`);
  console.log('='.repeat(70));

  const connectionUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasources: {
      db: { url: connectionUrl },
    },
  });

  try {
    console.log('Fetching territory hierarchy from database...');
    const [allRegions, allDepartments, allSubdivisions] = await Promise.all([
      prisma.region.findMany(),
      prisma.department.findMany({ include: { region: true } }),
      prisma.subdivision.findMany({ include: { department: true } }),
    ]);
    console.log(`Loaded ${allRegions.length} regions, ${allDepartments.length} departments, ${allSubdivisions.length} subdivisions into memory.`);

    // High performance in-memory cached adapter conforming to TxOrPrisma
    const cachedPrisma: any = {
      region: {
        findUnique: async ({ where }: any) => allRegions.find(r => r.id === where.id) || null,
        findMany: async () => allRegions,
      },
      department: {
        findUnique: async ({ where }: any) => allDepartments.find(d => d.id === where.id) || null,
        findMany: async ({ where }: any) => allDepartments.filter(d => !where?.regionId || d.regionId === where.regionId),
        findFirst: async ({ where }: any) => {
          const name = where?.name?.equals;
          return allDepartments.find(d => d.name.toLowerCase() === (name?.toLowerCase() || '')) || null;
        },
      },
      subdivision: {
        findUnique: async ({ where }: any) => allSubdivisions.find(s => s.id === where.id) || null,
        findMany: async ({ where }: any) => allSubdivisions.filter(s => !where?.departmentId || s.departmentId === where.departmentId),
        findFirst: async ({ where }: any) => {
          const name = where?.name?.equals;
          return allSubdivisions.find(s => s.name.toLowerCase() === (name?.toLowerCase() || '')) || null;
        },
      },
    };

    // ── 1. Backfill Company Records ──────────────────────────────────────────
    console.log('\n[1/2] Inspecting Company records...');
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        establishmentId: true,
        name: true,
        region: true,
        department: true,
        subdivision: true,
        regionId: true,
        departmentId: true,
        subdivisionId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const companyReport: BackfillResult = {
      inspected: companies.length,
      alreadyValid: 0,
      matched: [],
      unmatched: [],
    };

    for (const c of companies) {
      const identifier = `${c.name || 'Unnamed'} (${c.establishmentId || c.id})`;
      if (c.regionId && c.departmentId) {
        companyReport.alreadyValid++;
        continue;
      }

      // Check missing text territory
      if (!c.region && !c.department) {
        companyReport.unmatched.push({
          id: c.id,
          identifier,
          text: { region: c.region, department: c.department, subdivision: c.subdivision },
          reason: 'Missing both region and department text fields',
        });
        continue;
      }

      try {
        const resolved = await resolveAndValidateTerritory(cachedPrisma, {
          regionId: c.regionId,
          departmentId: c.departmentId,
          subdivisionId: c.subdivisionId,
          region: c.region,
          department: c.department,
          subdivision: c.subdivision,
        });

        companyReport.matched.push({
          id: c.id,
          identifier,
          text: { region: c.region, department: c.department, subdivision: c.subdivision },
          resolved,
        });

        if (!isDryRun) {
          await prisma.company.update({
            where: { id: c.id },
            data: {
              regionId: resolved.regionId,
              departmentId: resolved.departmentId,
              subdivisionId: resolved.subdivisionId,
              region: resolved.region,
              department: resolved.department,
              subdivision: resolved.subdivision ?? c.subdivision,
            },
          });
        }
      } catch (err: any) {
        // If recovery flag is on, attempt "department wins" for seeded test companies
        if (fixTestSeedMismatches) {
          const recovered = resolveTestCompanyDepartmentWins(c, allDepartments, allRegions, allSubdivisions);
          if (recovered) {
            companyReport.matched.push({
              id: c.id,
              identifier,
              text: { region: c.region, department: c.department, subdivision: c.subdivision },
              resolved: {
                regionId: recovered.regionId,
                region: recovered.region,
                departmentId: recovered.departmentId,
                department: recovered.department,
                subdivisionId: recovered.subdivisionId,
                subdivision: recovered.subdivision,
              },
              recoveredByRule: recovered.notes,
            });

            if (!isDryRun) {
              await prisma.company.update({
                where: { id: c.id },
                data: {
                  regionId: recovered.regionId,
                  departmentId: recovered.departmentId,
                  subdivisionId: recovered.subdivisionId,
                  region: recovered.region,
                  department: recovered.department,
                  subdivision: recovered.subdivision ?? c.subdivision,
                },
              });
            }
            continue;
          }
        }

        companyReport.unmatched.push({
          id: c.id,
          identifier,
          text: { region: c.region, department: c.department, subdivision: c.subdivision },
          reason: err.message || String(err),
        });
      }
    }

    // ── 2. Backfill OnefopSubmission Records ──────────────────────────────────
    console.log('\n[2/2] Inspecting OnefopSubmission records...');
    const submissions = await prisma.onefopSubmission.findMany({
      select: {
        id: true,
        submissionId: true,
        formType: true,
        status: true,
        region: true,
        department: true,
        subdivision: true,
        regionId: true,
        departmentId: true,
        subdivisionId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const submissionReport: BackfillResult = {
      inspected: submissions.length,
      alreadyValid: 0,
      matched: [],
      unmatched: [],
    };

    for (const s of submissions) {
      const identifier = `Submission ${s.submissionId || s.id} (${s.formType}, status: ${s.status})`;
      if (s.regionId && s.departmentId) {
        submissionReport.alreadyValid++;
        continue;
      }

      if (!s.region && !s.department) {
        submissionReport.unmatched.push({
          id: s.id,
          identifier,
          text: { region: s.region, department: s.department, subdivision: s.subdivision },
          reason: 'Missing both region and department text fields (retained as is for non-live submissions)',
        });
        continue;
      }

      try {
        const resolved = await resolveAndValidateTerritory(cachedPrisma, {
          regionId: s.regionId,
          departmentId: s.departmentId,
          subdivisionId: s.subdivisionId,
          region: s.region,
          department: s.department,
          subdivision: s.subdivision,
        });

        submissionReport.matched.push({
          id: s.id,
          identifier,
          text: { region: s.region, department: s.department, subdivision: s.subdivision },
          resolved,
        });

        if (!isDryRun) {
          await prisma.onefopSubmission.update({
            where: { id: s.id },
            data: {
              regionId: resolved.regionId,
              departmentId: resolved.departmentId,
              subdivisionId: resolved.subdivisionId,
              region: resolved.region,
              department: resolved.department,
              subdivision: resolved.subdivision ?? s.subdivision,
            },
          });
        }
      } catch (err: any) {
        submissionReport.unmatched.push({
          id: s.id,
          identifier,
          text: { region: s.region, department: s.department, subdivision: s.subdivision },
          reason: err.message || String(err),
        });
      }
    }

    // ── Print Report ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY REPORT');
    console.log('='.repeat(70));

    console.log(`\n--- COMPANY RECORDS (${companyReport.inspected} total) ---`);
    console.log(`Already valid (FKs present): ${companyReport.alreadyValid}`);
    console.log(`Successfully matched to canonical FKs: ${companyReport.matched.length}`);
    console.log(`Unmatched / Inconsistent (Requires manual review): ${companyReport.unmatched.length}`);

    if (companyReport.matched.length > 0) {
      console.log('\n  Matched Companies:');
      for (const m of companyReport.matched) {
        console.log(`    ✓ ${m.identifier}`);
        console.log(`      Original: [${m.text.region} > ${m.text.department} > ${m.text.subdivision || 'N/A'}]`);
        console.log(`      Resolved: [${m.resolved.region} (ID: ${m.resolved.regionId}) > ${m.resolved.department} (ID: ${m.resolved.departmentId}) > ${m.resolved.subdivision || 'N/A'}]`);
        if (m.recoveredByRule) {
          console.log(`      ⚠️  Rule applied: ${m.recoveredByRule}`);
        }
      }
    }

    if (companyReport.unmatched.length > 0) {
      console.log('\n  ⚠️ Unmatched Companies (Manual Review Needed):');
      for (const u of companyReport.unmatched) {
        console.log(`    ✗ ${u.identifier}`);
        console.log(`      Original: [${u.text.region} > ${u.text.department} > ${u.text.subdivision || 'N/A'}]`);
        console.log(`      Reason: ${u.reason}`);
      }
    }

    console.log(`\n--- ONEFOP SUBMISSION RECORDS (${submissionReport.inspected} total) ---`);
    console.log(`Already valid (FKs present): ${submissionReport.alreadyValid}`);
    console.log(`Successfully matched to canonical FKs: ${submissionReport.matched.length}`);
    console.log(`Unmatched / Inconsistent (Requires manual review): ${submissionReport.unmatched.length}`);

    if (submissionReport.matched.length > 0) {
      console.log('\n  Matched Submissions:');
      for (const m of submissionReport.matched) {
        console.log(`    ✓ ${m.identifier}`);
        console.log(`      Original: [${m.text.region} > ${m.text.department} > ${m.text.subdivision || 'N/A'}]`);
        console.log(`      Resolved: [${m.resolved.region} (ID: ${m.resolved.regionId}) > ${m.resolved.department} (ID: ${m.resolved.departmentId}) > ${m.resolved.subdivision || 'N/A'}]`);
      }
    }

    if (submissionReport.unmatched.length > 0) {
      console.log('\n  ⚠️ Unmatched Submissions:');
      for (const u of submissionReport.unmatched) {
        console.log(`    ✗ ${u.identifier}`);
        console.log(`      Original: [${u.text.region} > ${u.text.department} > ${u.text.subdivision || 'N/A'}]`);
        console.log(`      Reason: ${u.reason}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    if (isDryRun) {
      console.log('DRY RUN COMPLETE — Zero records were modified in the database.');
      console.log('Run with --apply to commit valid changes.');
    } else {
      console.log('APPLY COMPLETE — Database updated successfully.');
    }
    console.log('='.repeat(70) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Fatal error during territory backfill:', e);
  process.exit(1);
});
