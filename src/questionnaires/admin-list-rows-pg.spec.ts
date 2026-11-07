/**
 * Postgres-level check of the admin list's display query.
 *
 * WHY THIS FILE EXISTS. loadAdminListDisplay is hand-written SQL: the unit
 * tests mock $queryRaw, so a wrong table or column name, or a join that
 * returns the wrong person, passes them. Here the same values are read a
 * second way, through Prisma's relations as the list used to read them, and
 * the two must agree on every file.
 *
 * SAFETY. Reads only. A mismatch reports file ids and field names, never the
 * values, because this runs against real declarations.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1. Run it with `npm run test:pg`.
 */
import { PrismaClient } from '@prisma/client';
import { ADMIN_LIST_ROW_SELECT, loadAdminListDisplay } from './admin-list-rows';

const ENABLED = process.env.PG_INTEGRATION === '1';
const describePg = ENABLED ? describe : describe.skip;

/** The chain of resolveEntityName (react-web/src/lib/onefop-entity-name.ts). */
function expectedName(row: any): string | null {
  const raw = row.rawData ?? {};
  return row.enterpriseDetail?.companyName
    || row.cooperativeDetail?.cooperativeName
    || row.ongDetail?.ongName
    || row.administrationDetail?.name
    || row.projectProgramDetail?.name
    || row.vocationalTrainingDetail?.name
    || raw.enterprise?.name
    || raw.enterprise?.companyName
    || raw.cooperative?.name
    || raw.ctd?.name
    || raw.respondent?.companyName
    || raw.companyName
    || raw.name
    || null;
}

const findingKey = (finding: { ruleCode: string; status: string; isBlocking: boolean }) =>
  `${finding.ruleCode}|${finding.status}|${finding.isBlocking}`;

describePg('loadAdminListDisplay against Postgres', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it('agrees with the relations on every file, whatever its form', async () => {
    const files: any[] = await prisma.onefopSubmission.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: [{ submissionDate: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        respondent: { select: { respondentName: true } },
        enterpriseDetail: { select: { companyName: true } },
        cooperativeDetail: { select: { cooperativeName: true } },
        ongDetail: { select: { ongName: true } },
        administrationDetail: { select: { name: true } },
        projectProgramDetail: { select: { name: true } },
        vocationalTrainingDetail: { select: { name: true } },
        campaign: { select: { name: true } },
        company: { select: { establishmentId: true, user: { select: { status: true } } } },
        archivedByUser: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        anomalies: { select: { ruleCode: true, status: true, isBlocking: true } },
        supersedes: { select: { id: true, submissionId: true }, orderBy: { submissionDate: 'desc' }, take: 1 },
      },
    });
    expect(files.length).toBeGreaterThan(0);

    const display = await loadAdminListDisplay(prisma as any, files.map((file) => file.id));
    expect(display.size).toBe(files.length);

    const mismatches: string[] = [];
    for (const file of files) {
      const shown = display.get(file.id)!;
      const expected: Record<string, unknown> = {
        entityName: expectedName(file),
        respondentName: file.respondent?.respondentName ?? null,
        campaignName: file.campaign?.name ?? null,
        companyEstablishmentId: file.company?.establishmentId ?? null,
        companyRegistrationStatus: file.company?.user?.status ?? null,
        archivedByUserId: file.archivedByUser?.id ?? null,
        archivedByFirstName: file.archivedByUser?.firstName ?? null,
        archivedByLastName: file.archivedByUser?.lastName ?? null,
        assigneeUserId: file.assignee?.id ?? null,
        assigneeFirstName: file.assignee?.firstName ?? null,
        assigneeLastName: file.assignee?.lastName ?? null,
        assigneeEmail: file.assignee?.email ?? null,
        supersedesId: file.supersedes[0]?.id ?? null,
        supersedesSubmissionId: file.supersedes[0]?.submissionId ?? null,
      };
      for (const [field, value] of Object.entries(expected)) {
        if ((shown as any)[field] !== value) mismatches.push(`${file.id}: ${field}`);
      }
      const stored = file.anomalies.map(findingKey).sort();
      const read = (shown.anomalies ?? []).map(findingKey).sort();
      if (JSON.stringify(stored) !== JSON.stringify(read)) mismatches.push(`${file.id}: anomalies`);
    }
    expect(mismatches).toEqual([]);
  }, 120_000);

  it('selects every column of a submission except the declaration', () => {
    const scalars = Object.values((prisma as any)._runtimeDataModel.models.OnefopSubmission.fields as any[])
      .filter((field) => field.kind !== 'object')
      .map((field) => field.name);
    const expected = scalars.filter((name) => !['rawData', 'flags', 'metaJson'].includes(name)).sort();
    expect(Object.keys(ADMIN_LIST_ROW_SELECT).sort()).toEqual(expected);
  });
});
