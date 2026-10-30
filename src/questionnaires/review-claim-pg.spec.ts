/**
 * Postgres-level test for the review claim compare-and-swap.
 *
 * WHY THIS FILE EXISTS. The unit test in phase5-team-workflow.spec.ts
 * simulates two claims with an in-memory row and audit ledger. That proves
 * the service issues the conditional update, not that Postgres applies it:
 * a mocked updateMany has no isolation, no unique constraint and no stale
 * read. This file drives the real assignSubmission against real Postgres,
 * with two callers reading the same row before either writes, which is the
 * race the claim is meant to lose for one of them.
 *
 * THE RACE. The first version of this file ran both claims through one
 * interactive transaction, so the second caller saw the first caller's
 * uncommitted write: it was a sequential rejection, not two independent
 * transactions racing on the same row. This version gives each caller its
 * own client and transaction, and holds both after their initial read until
 * both have seen the unassigned row. The winner then commits; the loser's
 * conditional update must match no row.
 *
 * SAFETY. The users and the file must be visible to two independent
 * transactions, so they are committed before the race and removed in a
 * finally block, including when an assertion fails. afterAll retries any
 * cleanup left by a failed test; the test then re-counts the rows it created
 * to prove nothing survived. Every address written carries the sentinel
 * domain.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1, because the default `npm test`
 * must not reach for a database. Run it with `npm run test:pg`.
 */
import { ConflictException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { QuestionnairesService } from './questionnaires.service';
import type { PrismaService } from '../prisma/prisma.service';

const ENABLED = process.env.PG_INTEGRATION === '1';
const SENTINEL = 'ROLLBACK_SENTINEL';
const EMAIL_DOMAIN = 'pg-claim-rollback-sentinel.invalid';
const RUN = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CONFLICT_MESSAGE = 'vient d\u2019\u00eatre r\u00e9clam\u00e9 ou modifi\u00e9';

(ENABLED ? describe : describe.skip)('review claims against Postgres', () => {
  let prisma: PrismaClient;
  let peer: PrismaClient;
  const tracked = { submissions: new Set<string>(), agents: new Set<string>() };

  interface Barrier {
    wait(): Promise<void>;
  }

  /** Releases both callers only after each has read the unassigned row. */
  function createBarrier(parties = 2, timeoutMs = 15_000): Barrier {
    let arrived = 0;
    let timeoutError: Error | null = null;
    let release!: () => void;
    let fail!: (error: Error) => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const failed = new Promise<never>((_, reject) => {
      fail = reject;
    });
    failed.catch(() => {});
    const timer = setTimeout(() => {
      timeoutError = new Error('claim barrier timed out');
      fail(timeoutError);
    }, timeoutMs);
    timer.unref?.();
    return {
      async wait() {
        if (timeoutError) throw timeoutError;
        arrived += 1;
        if (arrived === parties) {
          clearTimeout(timer);
          release();
        }
        await Promise.race([released, failed]);
      },
    };
  }

  /**
   * The service, running its transaction on `client`. The transaction is
   * wrapped so the first submission read waits at the barrier; both callers
   * therefore hold the same unassigned row before either attempts its update.
   */
  function serviceWithBarrier(client: PrismaClient, barrier: Barrier): QuestionnairesService {
    let firstRead = true;
    const prismaLike = {
      $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        client.$transaction(
          async (tx) => {
            const wrapped = new Proxy(tx as any, {
              get(target, prop) {
                if (prop !== 'onefopSubmission') {
                  const value = target[prop];
                  return typeof value === 'function' ? value.bind(target) : value;
                }
                return new Proxy(target.onefopSubmission, {
                  get(model, modelProp) {
                    if (modelProp === 'findFirst') {
                      return async (...args: unknown[]) => {
                        const result = await model.findFirst(...args);
                        if (firstRead) {
                          firstRead = false;
                          await barrier.wait();
                        }
                        return result;
                      };
                    }
                    const value = model[modelProp];
                    return typeof value === 'function' ? value.bind(model) : value;
                  },
                });
              },
            });
            return fn(wrapped as Prisma.TransactionClient);
          },
          { timeout: 90_000 },
        ),
    } as unknown as PrismaService;
    return new QuestionnairesService(prismaLike);
  }

  async function createAgent(suffix: string) {
    const created = await prisma.user.create({
      data: {
        email: `pg-claim-${SENTINEL}-${RUN}-${suffix}@${EMAIL_DOMAIN}`,
        passwordHash: 'rollback-sentinel',
        firstName: 'Essai',
        lastName: 'Rollback',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
      },
      select: { id: true },
    });
    tracked.agents.add(created.id);
    return created;
  }

  async function cleanupTracked(): Promise<void> {
    const submissionIds = [...tracked.submissions];
    const agentIds = [...tracked.agents];
    if (submissionIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { resourceType: 'OnefopSubmission', resourceId: { in: submissionIds } },
      });
      await prisma.onefopSubmission.deleteMany({ where: { id: { in: submissionIds } } });
    }
    if (agentIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: agentIds } } });
    }
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    peer = new PrismaClient();
    await Promise.all([prisma.$connect(), peer.$connect()]);
  });

  afterAll(async () => {
    try {
      if (prisma) await cleanupTracked();
    } finally {
      await Promise.allSettled([
        prisma ? prisma.$disconnect() : Promise.resolve(),
        peer ? peer.$disconnect() : Promise.resolve(),
      ]);
    }
  });

  it('lets exactly one of two independent claims win, and records it once', async () => {
    const [agentA, agentB] = await Promise.all([createAgent('a'), createAgent('b')]);
    const establishment = await prisma.establishment.findFirst({ select: { id: true } });
    if (!establishment) throw new Error('this database has no establishment to attach a file to');
    const submission = await prisma.onefopSubmission.create({
      data: {
        formType: 'ENTREPRISE',
        rawData: {},
        surveyYear: 2026,
        establishmentId: establishment.id,
      },
    });
    tracked.submissions.add(submission.id);

    const barrier = createBarrier();
    const serviceA = serviceWithBarrier(prisma, barrier);
    const serviceB = serviceWithBarrier(peer, barrier);
    const territory = { role: 'SUPER_ADMIN' } as any;

    let claims: Promise<unknown>[] = [];
    try {
      claims.push(serviceA.assignSubmission(submission.id, agentA.id, agentA.id, territory));
      claims.push(serviceB.assignSubmission(submission.id, agentB.id, agentB.id, territory));
      const outcomes = await Promise.allSettled(claims);

      const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const rejection = (rejected[0] as PromiseRejectedResult).reason as Error;
      expect(rejection).toBeInstanceOf(ConflictException);
      expect(rejection.message).toContain(CONFLICT_MESSAGE);

      const row = await prisma.onefopSubmission.findUnique({
        where: { id: submission.id },
        select: { assigneeId: true },
      });
      const winner = (fulfilled[0] as PromiseFulfilledResult<{ assigneeId: string }>).value;
      expect(row?.assigneeId).toBe(winner.assigneeId);
      expect([agentA.id, agentB.id]).toContain(row?.assigneeId);

      const assignments = await prisma.auditLog.findMany({
        where: { resourceType: 'OnefopSubmission', resourceId: submission.id, action: 'DOSSIER_ASSIGNED' },
        select: { userId: true, details: true },
      });
      expect(assignments).toHaveLength(1);
      expect(assignments[0].userId).toBe(row?.assigneeId);
      expect((assignments[0].details as any).assigneeId).toBe(row?.assigneeId);
    } finally {
      await Promise.allSettled(claims);
      await cleanupTracked();
    }

    // Cleanup is part of the safety proof: neither the file nor the agents remain.
    expect(await prisma.onefopSubmission.findUnique({ where: { id: submission.id } })).toBeNull();
    expect(await prisma.user.count({ where: { id: { in: [agentA.id, agentB.id] } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { resourceId: submission.id } })).toBe(0);
  }, 90_000);
});
