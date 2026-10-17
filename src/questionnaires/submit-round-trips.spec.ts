import { QuestionnairesService } from './questionnaires.service';
import { completeVtAnswers } from './complete-vt-answers.fixture';

/**
 * Defect 12 (2026-10-16 VT run): a final submit took about 25 s on a distant
 * database link, where each query costs a round trip. The code itself takes
 * well under a second (measured here with a database that answers at once),
 * so the cost is the number of round trips. This keeps that number bounded:
 * a complete final VT submit makes these queries, in this order, and no
 * more. The nested create is one call (its child rows are createMany).
 *
 * campaignSubmission.updateMany became campaignSubmission.upsert (fix for
 * the dashboard-coverage bug found 2026-10-17): an establishment that
 * registers after its campaign activates never gets a CampaignSubmission
 * row, so updateMany silently matched nothing. This mock counts one Prisma
 * Client call either way; Prisma's own upsert may cost the pooler one more
 * round trip underneath than updateMany did — a smaller, known trade for
 * no longer losing submissions from the coverage count.
 */
describe('final VT submit — database round trips', () => {
  it('makes a bounded, known list of queries and returns only the ids from create', async () => {
    const calls: string[] = [];
    let createArgs: any;
    const base: any = {
      company: { findFirst: async () => ({ id: 'company-1', establishmentId: 'EST-1' }) },
      submissionRound: {
        findFirst: async () => ({ id: 'round-1', status: 'OPEN', quarterCode: 'QUARTERLY_2026_T4_001', deadline: new Date(Date.now() + 86400000) }),
        findMany: async () => [{ id: 'round-1', campaignId: 'camp-1', campaign: { id: 'camp-1', deadline: new Date(Date.now() + 86400000), extendedDeadline: null } }],
      },
      onefopSubmission: {
        findUnique: async () => null,
        findFirst: async () => null,
        findMany: async () => [],
        create: async (args: any) => {
          createArgs = args;
          return { id: 'db-1', submissionId: args.data.submissionId };
        },
      },
      subdivision: { findFirst: async () => null },
      department: { findFirst: async () => null },
      region: { findFirst: async () => null },
      sector: { findFirst: async () => null },
      campaignSubmission: { upsert: async () => ({}) },
      onefopAnomaly: { deleteMany: async () => ({}), createMany: async () => ({}) },
    };
    const prisma = new Proxy(base, {
      get: (t, model: string) =>
        !(model in t)
          ? undefined
          : new Proxy(t[model], {
              get: (m, op: string) => async (...a: any[]) => {
                calls.push(`${model}.${op}`);
                return m[op](...a);
              },
            }),
    });
    const service = new QuestionnairesService(prisma as any);
    const data = {
      ...completeVtAnswers(),
      VT1_15_NAME: 'J', VT1_15_FUNCTION: 'D', VT1_15_TEL1: '699999999', VT1_15_EMAIL: 'j@t.cm', VT1_15_SEX: 'Féminin',
      VT1_2: 'C', VT1_4: 'Centre', VT1_5: 'Mfoundi', VT1_6: 'Yaoundé I', VT1_8: 'N', VT1_9: 'Urbain/ Urban',
      // 4.1 and 4.2 disagree: one advisory coherence flag is stored.
      s4q1_licence_male: '3',
    };

    const t0 = Date.now();
    await service.submitQuestionnaire({ formId: 'f-1', userId: 'u', entityType: 'VOCATIONAL_TRAINING', isDraft: false, quarterCode: 'QUARTERLY_2026_T4_001', data } as any);
    const cpuMs = Date.now() - t0;

    expect(calls.filter((c) => !/^(subdivision|department|region|sector)\./.test(c))).toEqual([
      'onefopSubmission.findUnique', // idempotency (same formId)
      'submissionRound.findFirst', // the period is open
      'company.findFirst', // attribution
      'submissionRound.findMany', // campaign and deadline
      'onefopSubmission.findMany', // one live declaration per period, and the corrections it answers
      'onefopSubmission.create', // the declaration and every child table
      'campaignSubmission.upsert', // campaign progress (upsert: an establishment that registered after campaign activation has no row yet)
      'onefopAnomaly.createMany', // the advisory coherence flags
    ]);
    // Geography is resolved once, at most one lookup per level.
    expect(calls.filter((c) => /^(subdivision|department|region|sector)\./.test(c)).length).toBeLessThanOrEqual(4);
    expect(createArgs.select).toEqual({ id: true, submissionId: true });
    // The code's own work is small next to a database round trip.
    expect(cpuMs).toBeLessThan(3000);
  });
});
