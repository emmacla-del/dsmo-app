import { QuestionnairesService } from './questionnaires.service';
import { completeVtAnswers } from './complete-vt-answers.fixture';

/**
 * Item 8 of the 2026-10-16 re-test (owner, CLAUDE.md §21): a correction
 * request answered by a new submission for the same company and period is
 * closed as SUPERSEDED, pointing at the new file, with an audit entry.
 * Before, it stayed CORRECTION_REQUESTED forever next to its replacement.
 */
describe('a resubmission closes the correction requests it answers', () => {
  function setup(periodFiles: Array<{ id: string; status: string }>, closable = true) {
    const updates: any[] = [];
    const audits: any[] = [];
    const findManyArgs: any[] = [];
    const prisma: any = {
      company: { findFirst: async () => ({ id: 'company-1', establishmentId: 'EST-1' }) },
      submissionRound: {
        findFirst: async () => ({ id: 'round-1', status: 'OPEN', quarterCode: 'QUARTERLY_2026_T4_001', deadline: new Date(Date.now() + 86400000) }),
        findMany: async () => [{ id: 'round-1', campaignId: 'camp-1', campaign: { id: 'camp-1', deadline: new Date(Date.now() + 86400000), extendedDeadline: null } }],
      },
      onefopSubmission: {
        findUnique: async () => null,
        findFirst: async () => null,
        findMany: async (args: any) => {
          findManyArgs.push(args);
          return periodFiles;
        },
        create: async (args: any) => ({ id: 'new-file', submissionId: args.data.submissionId }),
        updateMany: async (args: any) => {
          updates.push(args);
          return { count: closable ? 1 : 0 };
        },
      },
      subdivision: { findFirst: async () => null },
      department: { findFirst: async () => null },
      region: { findFirst: async () => null },
      sector: { findFirst: async () => null },
      campaignSubmission: { upsert: async () => ({}) },
      onefopAnomaly: { createMany: async () => ({}) },
      auditLog: { createMany: async (args: any) => audits.push(args) },
    };
    const service = new QuestionnairesService(prisma);
    const data = {
      ...completeVtAnswers(),
      VT1_15_NAME: 'J', VT1_15_FUNCTION: 'D', VT1_15_TEL1: '699999999', VT1_15_EMAIL: 'j@t.cm', VT1_15_SEX: 'Féminin',
      VT1_2: 'C', VT1_4: 'Centre', VT1_5: 'Mfoundi', VT1_6: 'Yaoundé I', VT1_8: 'N', VT1_9: 'Urbain/ Urban',
    };
    const submit = (isDraft = false) =>
      service.submitQuestionnaire({ formId: 'f-2', userId: 'respondent-1', entityType: 'VOCATIONAL_TRAINING', isDraft, quarterCode: 'QUARTERLY_2026_T4_001', data } as any);
    return { submit, updates, audits, findManyArgs };
  }

  it('closes the open correction request as SUPERSEDED by the new file, with an audit entry', async () => {
    const { submit, updates, audits, findManyArgs } = setup([{ id: 'old-file', status: 'CORRECTION_REQUESTED' }]);
    const res = await submit();
    expect(res.success).toBe(true);
    expect(findManyArgs[0].where).toMatchObject({
      companyId: 'company-1',
      quarterCode: 'QUARTERLY_2026_T4_001',
      status: { in: ['PENDING_REVIEW', 'APPROVED', 'CORRECTION_REQUESTED'] },
    });
    expect(updates).toEqual([
      { where: { id: 'old-file', status: 'CORRECTION_REQUESTED' }, data: { status: 'SUPERSEDED', supersededById: 'new-file' } },
    ]);
    expect(audits).toHaveLength(1);
    expect(audits[0].data).toEqual([
      expect.objectContaining({
        userId: 'respondent-1',
        action: 'AUDIT_SUPERSEDED',
        resourceType: 'OnefopSubmission',
        resourceId: 'old-file',
        details: { previousStatus: 'CORRECTION_REQUESTED', newStatus: 'SUPERSEDED', supersededById: 'new-file' },
      }),
    ]);
  });

  it('a file a reviewer changed in the meantime is left alone, and not audited', async () => {
    const { submit, updates, audits } = setup([{ id: 'old-file', status: 'CORRECTION_REQUESTED' }], false);
    await submit();
    expect(updates).toHaveLength(1);
    expect(audits).toHaveLength(0);
  });

  it('a draft closes nothing', async () => {
    const { submit, updates, findManyArgs } = setup([{ id: 'old-file', status: 'CORRECTION_REQUESTED' }]);
    await submit(true);
    expect(findManyArgs).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('a live file for the period is still a conflict, and nothing is closed', async () => {
    const { submit, updates } = setup([
      { id: 'old-file', status: 'CORRECTION_REQUESTED' },
      { id: 'live-file', status: 'PENDING_REVIEW' },
    ]);
    await expect(submit()).rejects.toThrow(/déjà en cours/);
    expect(updates).toHaveLength(0);
  });

  it('a first submission, with no correction request, writes nothing more', async () => {
    const { submit, updates, audits } = setup([]);
    await submit();
    expect(updates).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });
});
