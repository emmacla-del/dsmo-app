/**
 * Postgres-level check of the admin file page's reads.
 *
 * WHY THIS FILE EXISTS. loadFileContext is hand-written SQL and loadFileDetail
 * trusts that a file's detail belongs to its form: the unit tests mock both.
 * Here the values are read a second way, through Prisma's relations as getById
 * used to read them, and the two must agree on every file.
 *
 * SAFETY. Reads only. A mismatch reports file ids and field names, never the
 * values, because this runs against real declarations.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1. Run it with `npm run test:pg`.
 */
import { PrismaClient } from '@prisma/client';
import { loadFileContext, loadFileDetail } from './admin-file-read';

const ENABLED = process.env.PG_INTEGRATION === '1';
const describePg = ENABLED ? describe : describe.skip;

const DETAIL_KEYS = [
  'enterpriseDetail', 'cooperativeDetail', 'ctdDetail', 'ongDetail',
  'administrationDetail', 'projectProgramDetail', 'vocationalTrainingDetail',
];

describePg('admin file reads against Postgres', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it('agree with the relations on every file, whatever its form', async () => {
    const files: any[] = await prisma.onefopSubmission.findMany({
      where: { OR: [{ archivedAt: null }, { archivedAt: { not: null } }] },
      orderBy: [{ submissionDate: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        enterpriseDetail: true,
        cooperativeDetail: true,
        ctdDetail: true,
        ongDetail: true,
        administrationDetail: true,
        projectProgramDetail: true,
        vocationalTrainingDetail: true,
        establishment: { include: { company: { select: { yearOfCreation: true } } } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        supersedes: { select: { id: true, submissionId: true }, orderBy: { submissionDate: 'desc' }, take: 1 },
      },
    });
    expect(files.length).toBeGreaterThan(0);

    const mismatches: string[] = [];
    for (const file of files) {
      const detail = await loadFileDetail(prisma, file);
      for (const key of DETAIL_KEYS) {
        if (JSON.stringify(detail[key] ?? null) !== JSON.stringify(file[key] ?? null)) mismatches.push(`${file.id}: ${key}`);
      }
      const context = await loadFileContext(prisma as any, file.id);
      const expected: Record<string, unknown> = {
        yearOfCreation: file.establishment?.company?.yearOfCreation ?? null,
        assigneeUserId: file.assignee?.id ?? null,
        assigneeFirstName: file.assignee?.firstName ?? null,
        assigneeLastName: file.assignee?.lastName ?? null,
        assigneeEmail: file.assignee?.email ?? null,
        supersedesId: file.supersedes[0]?.id ?? null,
        supersedesSubmissionId: file.supersedes[0]?.submissionId ?? null,
      };
      for (const [field, value] of Object.entries(expected)) {
        if ((context as any)?.[field] !== value) mismatches.push(`${file.id}: ${field}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 180_000);
});
