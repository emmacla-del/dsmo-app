// src/questionnaires/eligibility-engine.service.spec.ts
import { EligibilityEngineService } from './eligibility-engine.service';
import { AnomalyResolutionType, AnomalySeverity, AnomalyStatus, OnefopStatus, UserRole } from '@prisma/client';
import { StatisticalExclusionReason } from '../types/eligibility.types';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('EligibilityEngineService', () => {
  let service: EligibilityEngineService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      onefopSubmission: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      onefopAnomaly: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    service = new EligibilityEngineService(prisma);
  });

  describe('evaluateDossier & Statistical Eligibility (Cases A-E)', () => {
    it('throws NotFoundException if submission does not exist', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue(null);
      await expect(service.evaluateDossier('sub-999')).rejects.toThrow(NotFoundException);
    });

    // Case A: APPROVED + no blocking anomalies -> statistically eligible
    it('Case A: returns READY when APPROVED with no anomalies', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-case-a',
        status: OnefopStatus.APPROVED,
        anomalies: [],
      });

      const result = await service.evaluateDossier('sub-case-a');
      expect(result.axis3Eligibility).toBe('READY');
      expect(result.axis1Status).toBe(OnefopStatus.APPROVED);
      expect(result.axis2BlockingCount).toBe(0);
      expect(result.axis2WarningCount).toBe(0);
      expect(result.blockingAnomalies).toEqual([]);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.APPROVED, anomalies: [] })).toBe(true);
    });

    it('a replaced file (SUPERSEDED) is excluded as replaced, not as rejected', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue({ id: 'sub-old', status: OnefopStatus.SUPERSEDED, anomalies: [] });
      const result = await service.evaluateDossier('sub-old');
      expect(result.axis3Eligibility).toBe('EXCLUDED');
      expect(result.exclusionReason).toBe(StatisticalExclusionReason.EXCL_SUPERSEDED);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.SUPERSEDED, anomalies: [] })).toBe(false);
    });

    // Case B: APPROVED + OPEN blocking anomaly -> NOT statistically eligible
    it('Case B: returns EXCLUDED with EXCL_BLOCKING_ANOMALY_OPEN if APPROVED with open blocking anomaly', async () => {
      const blockingAnomaly = {
        id: 'ano-1',
        ruleCode: 'EFF_GENRE',
        ruleFamily: 'ARITHMETIC',
        status: AnomalyStatus.OPEN,
        isBlocking: true,
        severity: AnomalySeverity.CRITICAL,
        description: 'Genre count mismatch',
        observedValue: '10',
        expectedValue: '12',
        detectedAt: new Date(),
      };
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-case-b',
        status: OnefopStatus.APPROVED,
        anomalies: [blockingAnomaly],
      });

      const result = await service.evaluateDossier('sub-case-b');
      expect(result.axis3Eligibility).toBe('EXCLUDED');
      expect(result.exclusionReason).toBe(StatisticalExclusionReason.EXCL_BLOCKING_ANOMALY_OPEN);
      expect(result.axis2BlockingCount).toBe(1);
      expect(result.blockingAnomalies).toHaveLength(1);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.APPROVED, anomalies: [blockingAnomaly] })).toBe(false);
    });

    // Case C: PENDING + no blocking anomaly -> NOT statistically eligible
    it('Case C: returns EXCLUDED with EXCL_WAITING_NAT_VISA when PENDING_REVIEW with 0 anomalies', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-case-c',
        status: OnefopStatus.PENDING_REVIEW,
        anomalies: [],
      });

      const result = await service.evaluateDossier('sub-case-c');
      expect(result.axis3Eligibility).toBe('EXCLUDED');
      expect(result.exclusionReason).toBe(StatisticalExclusionReason.EXCL_WAITING_NAT_VISA);
      expect(result.axis2BlockingCount).toBe(0);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.PENDING_REVIEW, anomalies: [] })).toBe(false);
    });

    // Case D: APPROVED + previously blocking anomaly now resolved -> statistically eligible
    it('Case D: returns READY when APPROVED with a previously blocking anomaly that is now RESOLVED or WAIVED', async () => {
      const resolvedAnomaly = {
        id: 'ano-resolved',
        ruleCode: 'EFF_GENRE',
        ruleFamily: 'ARITHMETIC',
        status: AnomalyStatus.RESOLVED,
        isBlocking: true,
        severity: AnomalySeverity.CRITICAL,
        description: 'Corrected by declarant',
        observedValue: '12',
        expectedValue: '12',
        detectedAt: new Date(),
      };
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-case-d',
        status: OnefopStatus.APPROVED,
        anomalies: [resolvedAnomaly],
      });

      const result = await service.evaluateDossier('sub-case-d');
      expect(result.axis3Eligibility).toBe('READY');
      expect(result.axis2BlockingCount).toBe(0);
      expect(result.blockingAnomalies).toEqual([]);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.APPROVED, anomalies: [resolvedAnomaly] })).toBe(true);
    });

    // Case E: APPROVED + OPEN non-blocking anomaly -> statistically eligible
    it('Case E: returns READY when APPROVED and only non-blocking warning anomalies exist', async () => {
      const warningAnomaly = {
        id: 'ano-warn',
        ruleCode: 'METHODOLOGY_HINT',
        ruleFamily: 'METHODOLOGY',
        status: AnomalyStatus.OPEN,
        isBlocking: false,
        severity: AnomalySeverity.WARNING,
        description: 'Minor variance',
        observedValue: '5',
        expectedValue: '5',
        detectedAt: new Date(),
      };
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-case-e',
        status: OnefopStatus.APPROVED,
        anomalies: [warningAnomaly],
      });

      const result = await service.evaluateDossier('sub-case-e');
      expect(result.axis3Eligibility).toBe('READY');
      expect(result.axis2BlockingCount).toBe(0);
      expect(result.axis2WarningCount).toBe(1);
      expect(result.blockingAnomalies).toEqual([]);
      expect(result.warningAnomalies).toHaveLength(1);
      expect(service.isStatisticallyEligible({ status: OnefopStatus.APPROVED, anomalies: [warningAnomaly] })).toBe(true);
    });
  });

  describe('assertCanApprove (Approval Gate)', () => {
    it('throws BadRequestException if the dossier has any OPEN blocking anomalies', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-blocked',
        status: OnefopStatus.PENDING_REVIEW,
        anomalies: [
          {
            id: 'ano-block',
            ruleCode: 'TOTAL_MISMATCH',
            ruleFamily: 'ARITHMETIC',
            status: AnomalyStatus.OPEN,
            isBlocking: true,
            severity: AnomalySeverity.CRITICAL,
            description: 'Mismatch',
            observedValue: '10',
            expectedValue: '20',
            detectedAt: new Date(),
          },
        ],
      });

      await expect(service.assertCanApprove('sub-blocked')).rejects.toThrow(BadRequestException);
    });

    it('succeeds without error if the dossier has 0 open blocking anomalies', async () => {
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'sub-clean',
        status: OnefopStatus.PENDING_REVIEW,
        anomalies: [
          {
            id: 'ano-warn',
            ruleCode: 'HINT',
            ruleFamily: 'QUALITY',
            status: AnomalyStatus.OPEN,
            isBlocking: false,
            severity: AnomalySeverity.WARNING,
            description: 'Hint only',
            observedValue: '1',
            expectedValue: '1',
            detectedAt: new Date(),
          },
        ],
      });

      const diagnostic = await service.assertCanApprove('sub-clean');
      expect(diagnostic.blockingAnomalies).toEqual([]);
      expect(diagnostic.axis2BlockingCount).toBe(0);
    });
  });

  describe('getStatisticalEligibilityWhere (Canonical Export Gate)', () => {
    it('returns the exact query criteria for Axis 1 Approved + Axis 2 no open blocking anomalies', () => {
      const clause = EligibilityEngineService.getStatisticalEligibilityWhere();
      expect(clause).toEqual({
        status: OnefopStatus.APPROVED,
        anomalies: {
          none: {
            status: AnomalyStatus.OPEN,
            isBlocking: true,
          },
        },
      });
      expect(service.getStatisticalEligibilityWhere()).toEqual(clause);
    });
  });

  describe('resolveAnomaly authorization', () => {
    it('forbids regional user from granting LEGAL_DEROGATION', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1',
        status: AnomalyStatus.OPEN,
        submission: { region: 'Centre' },
      });

      const regionalUser = { id: 'usr-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre' };
      await expect(
        service.resolveAnomaly('ano-1', regionalUser, {
          resolutionType: AnomalyResolutionType.LEGAL_DEROGATION,
          resolutionNote: 'Tentative de dispense locale',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows central superadmin to grant LEGAL_DEROGATION and sets status to WAIVED', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1',
        ruleCode: 'RULE-1',
        submissionId: 'sub-1',
        status: AnomalyStatus.OPEN,
        submission: { region: 'Centre' },
      });
      prisma.onefopAnomaly.update.mockResolvedValue({ id: 'ano-1', status: AnomalyStatus.WAIVED });

      const superAdmin = { id: 'usr-super', role: UserRole.SUPER_ADMIN };
      const res = await service.resolveAnomaly('ano-1', superAdmin, {
        resolutionType: AnomalyResolutionType.LEGAL_DEROGATION,
        resolutionNote: 'Arrêté ministériel dérogatoire N° 2026/04',
      });

      expect(prisma.onefopAnomaly.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AnomalyStatus.WAIVED }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ANOMALY_WAIVED' }),
        })
      );
      expect(res.status).toBe(AnomalyStatus.WAIVED);
    });
  });

  describe('listAnomalies (anomaly register)', () => {
    it('filters by rule family and keeps the caller territory', async () => {
      prisma.onefopSubmission.findMany.mockResolvedValue([]);
      prisma.onefopAnomaly.count.mockResolvedValue(0);
      prisma.onefopAnomaly.findMany.mockResolvedValue([]);

      await service.listAnomalies(
        { ruleFamily: 'VT_COHERENCE' },
        { role: UserRole.REGIONAL_ADMIN, region: 'Centre' } as any,
      );

      const where = prisma.onefopAnomaly.count.mock.calls[0][0].where;
      expect(where.ruleFamily).toBe('VT_COHERENCE');
      expect(where.submission).toBeDefined();
    });

    it('leaves the family unconstrained when none is asked for', async () => {
      prisma.onefopSubmission.findMany.mockResolvedValue([]);
      prisma.onefopAnomaly.count.mockResolvedValue(0);
      prisma.onefopAnomaly.findMany.mockResolvedValue([]);

      await service.listAnomalies({}, { role: UserRole.ADMIN_ONEFOP } as any);

      const where = prisma.onefopAnomaly.count.mock.calls[0][0].where;
      expect(where.ruleFamily).toBeUndefined();
    });
  });

  describe('executeBulkVisa (Atomic Transaction)', () => {
    it('throws BadRequestException if certified checkbox is not checked', async () => {
      await expect(
        service.executeBulkVisa({ id: 'admin-1', role: UserRole.SUPER_ADMIN }, {
          submissionIds: ['sub-1'],
          certified: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dossiers with open blocking anomalies and approves clean ones', async () => {
      const candidates = [
        {
          id: 'clean-1',
          status: OnefopStatus.PENDING_REVIEW,
          anomalies: [],
        },
        {
          id: 'dirty-2',
          status: OnefopStatus.PENDING_REVIEW,
          anomalies: [{ id: 'ano-block', status: AnomalyStatus.OPEN, isBlocking: true }],
        },
      ];
      prisma.onefopSubmission.findMany.mockResolvedValue(candidates);

      const result = await service.executeBulkVisa(
        { id: 'admin-1', role: UserRole.SUPER_ADMIN },
        { submissionIds: ['clean-1', 'dirty-2'], certified: true }
      );

      expect(result.processedCount).toBe(1);
      expect(result.approvedIds).toEqual(['clean-1']);
      expect(result.rejectedCount).toBe(1);
      expect(result.rejectedItems[0].id).toBe('dirty-2');
      expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['clean-1'] }, status: OnefopStatus.PENDING_REVIEW },
        data: expect.objectContaining({ status: OnefopStatus.APPROVED }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AUDIT_BULK_VISA_GRANTED' }),
        })
      );
    });
  });
});

// ── companion fix: executeBulkVisa — territory first, missing IDs, status re-check ───

describe('EligibilityEngineService.executeBulkVisa — companion fixes', () => {
  let engine: EligibilityEngineService;
  let tx: any;

  function buildEngine(candidates: any[]) {
    tx = {
      onefopSubmission: {
        findMany: jest.fn(async () => candidates),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    engine = new EligibilityEngineService(prisma);
    return engine;
  }

  it('reports missing IDs instead of silently dropping them', async () => {
    buildEngine([{
      id: 's1', status: OnefopStatus.PENDING_REVIEW, region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    const result = await engine.executeBulkVisa(
      { id: 'actor', role: UserRole.SUPER_ADMIN, email: 'a@a.cm' },
      { submissionIds: ['s1', 'ghost'], certified: true },
    );
    expect(result.rejectedCount).toBe(1);
    expect(result.rejectedItems[0]).toMatchObject({
      id: 'ghost',
      reason: expect.stringMatching(/introuvable|ressort/i),
    });
  });

  it('territory check runs before status check — out-of-territory reason is generic', async () => {
    // DIVISIONAL in Wouri; sub is in Mfoundi (different department)
    buildEngine([{
      id: 's1', status: OnefopStatus.APPROVED, region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    const divActor = { id: 'a', role: UserRole.DIVISIONAL_ADMIN, region: 'Centre', department: 'Wouri', email: 'a@a.cm' };
    const result = await engine.executeBulkVisa(divActor, { submissionIds: ['s1'], certified: true });
    // Must NOT reveal that the status was APPROVED (territory info-leak)
    expect(result.rejectedItems[0].reason).not.toMatch(/APPROVED/i);
    expect(result.rejectedItems[0].reason).toMatch(/introuvable|ressort/i);
  });

  it('updateMany includes status condition (concurrency guard)', async () => {
    buildEngine([{
      id: 's1', status: OnefopStatus.PENDING_REVIEW, region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    await engine.executeBulkVisa(
      { id: 'a', role: UserRole.SUPER_ADMIN, email: 'a@a.cm' },
      { submissionIds: ['s1'], certified: true },
    );
    const [{ where }] = tx.onefopSubmission.updateMany.mock.calls[0];
    expect(where).toMatchObject({ status: OnefopStatus.PENDING_REVIEW });
  });
});

// ── executeBulkReject ─────────────────────────────────────────────────────────

describe('EligibilityEngineService.executeBulkReject', () => {
  let engine: EligibilityEngineService;
  let tx: any;

  function buildEngine(candidates: any[]) {
    tx = {
      onefopSubmission: {
        findMany: jest.fn(async () => candidates),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    engine = new EligibilityEngineService(prisma);
    return engine;
  }

  const actor = { id: 'actor-1', role: UserRole.SUPER_ADMIN, email: 'agent@onefop.cm' };
  const validDto = {
    submissionIds: ['s1'],
    certified: true,
    reason: 'Motif de rejet suffisamment long pour passer la validation',
  };

  function sub(id: string, status: OnefopStatus, region = 'Centre', department = 'Mfoundi') {
    return { id, status, region, department };
  }

  it('rejects PENDING_REVIEW and writes one audit record', async () => {
    buildEngine([sub('s1', OnefopStatus.PENDING_REVIEW)]);
    const result = await engine.executeBulkReject(actor, validDto);
    expect(result.processedCount).toBe(1);
    expect(result.rejectedIds).toEqual(['s1']);
    expect(result.rejectedCount).toBe(0);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const [{ data }] = tx.auditLog.create.mock.calls[0];
    expect(data.action).toBe('AUDIT_BULK_REJECT');
    expect(data.details.reason).toBe(validDto.reason);
  });

  it('rejects CORRECTION_REQUESTED', async () => {
    buildEngine([sub('s1', OnefopStatus.CORRECTION_REQUESTED)]);
    const result = await engine.executeBulkReject(actor, validDto);
    expect(result.processedCount).toBe(1);
  });

  it('skips APPROVED with a status reason (not a territory reason)', async () => {
    buildEngine([sub('s1', OnefopStatus.APPROVED)]);
    const result = await engine.executeBulkReject(actor, validDto);
    expect(result.processedCount).toBe(0);
    expect(result.rejectedItems[0].reason).toMatch(/APPROVED/i);
    // No audit record if nothing was actually rejected
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('updateMany uses status-in condition (concurrency guard)', async () => {
    buildEngine([sub('s1', OnefopStatus.PENDING_REVIEW)]);
    await engine.executeBulkReject(actor, validDto);
    const [{ where }] = tx.onefopSubmission.updateMany.mock.calls[0];
    expect(where.status).toMatchObject({
      in: expect.arrayContaining([OnefopStatus.PENDING_REVIEW, OnefopStatus.CORRECTION_REQUESTED]),
    });
  });

  it('reports missing IDs with the generic message', async () => {
    buildEngine([]);
    const result = await engine.executeBulkReject(actor, { ...validDto, submissionIds: ['ghost'] });
    expect(result.rejectedItems[0]).toMatchObject({
      id: 'ghost',
      reason: expect.stringMatching(/introuvable|ressort/i),
    });
  });

  it('territory check before status check — out-of-territory reason is generic', async () => {
    const divActor = { id: 'a', role: UserRole.DIVISIONAL_ADMIN, region: 'Centre', department: 'Wouri', email: 'a@a.cm' };
    buildEngine([sub('s1', OnefopStatus.APPROVED, 'Centre', 'Mfoundi')]);
    const result = await engine.executeBulkReject(divActor, validDto);
    expect(result.rejectedItems[0].reason).not.toMatch(/APPROVED/i);
    expect(result.rejectedItems[0].reason).toMatch(/introuvable|ressort/i);
  });

  it('throws 400 when certified is false', async () => {
    buildEngine([]);
    await expect(
      engine.executeBulkReject(actor, { ...validDto, certified: false }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when submissionIds is empty', async () => {
    buildEngine([]);
    await expect(
      engine.executeBulkReject(actor, { ...validDto, submissionIds: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when reason is under 10 chars', async () => {
    buildEngine([]);
    await expect(
      engine.executeBulkReject(actor, { ...validDto, reason: 'court' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('response shape matches the contract', async () => {
    buildEngine([sub('s1', OnefopStatus.PENDING_REVIEW)]);
    const result = await engine.executeBulkReject(actor, validDto);
    expect(result).toMatchObject({
      success: true,
      processedCount: expect.any(Number),
      rejectedCount: expect.any(Number),
      rejectedIds: expect.any(Array),
      rejectedItems: expect.any(Array),
      timestamp: expect.any(String),
    });
  });
});

// ── QuestionnairesService.reject — companion fix tests ────────────────────────

import { QuestionnairesService } from './questionnaires.service';

describe('QuestionnairesService.reject — companion fixes', () => {
  function buildService(existingStatus: string) {
    const submission = { id: 's1', status: existingStatus, updatedAt: new Date('2026-01-01T00:00:00.000Z'), region: 'Centre', department: 'Mfoundi' };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      onefopSubmission: {
        findFirst: jest.fn(async () => submission),
        update: jest.fn(async (args: any) => ({ ...submission, ...args.data })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(async () => submission),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    return { service: new QuestionnairesService(prisma), prisma };
  }

  it('throws 400 when reason is too short', async () => {
    const { service } = buildService('PENDING_REVIEW');
    await expect(service.reject('s1', 'court')).rejects.toThrow(BadRequestException);
    await expect(service.reject('s1', '')).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when status is APPROVED', async () => {
    const { service } = buildService('APPROVED');
    await expect(
      service.reject('s1', 'Justification valide et suffisamment longue'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when status is DRAFT', async () => {
    const { service } = buildService('DRAFT');
    await expect(
      service.reject('s1', 'Justification valide et suffisamment longue'),
    ).rejects.toThrow(BadRequestException);
  });

  it('succeeds for PENDING_REVIEW and writes AUDIT_REJECT', async () => {
    const { service, prisma } = buildService('PENDING_REVIEW');
    await service.reject('s1', 'Justification valide et suffisamment longue', 'actor-1');
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const [{ data }] = prisma.auditLog.create.mock.calls[0];
    expect(data.action).toBe('AUDIT_REJECT');
    expect(data.userId).toBe('actor-1');
  });

  it('succeeds for CORRECTION_REQUESTED', async () => {
    const { service } = buildService('CORRECTION_REQUESTED');
    await expect(
      service.reject('s1', 'Justification valide et suffisamment longue', 'actor-1'),
    ).resolves.not.toThrow();
  });
});

describe('EligibilityEngineService.getPilotageQueues — dashboard aggregates', () => {
  it('computes status and region counts server-side over the whole territory', async () => {
    const prisma: any = {
      onefopSubmission: {
        count: jest.fn(async () => 650),
        groupBy: jest.fn(async ({ by }: any) =>
          by[0] === 'status'
            ? [
                { status: 'APPROVED', _count: { _all: 700 } },
                { status: 'PENDING_REVIEW', _count: { _all: 400 } },
                { status: 'REJECTED', _count: { _all: 100 } },
              ]
            : [
                { region: 'Littoral', _count: { _all: 800 } },
                { region: null, _count: { _all: 400 } },
              ],
        ),
      },
      onefopAnomaly: { count: jest.fn(async () => 3) },
      auditLog: reviewDelayMocks().auditLog,
    };
    Object.assign(prisma.onefopSubmission, reviewDelayMocks().onefopSubmission);
    const engine = new EligibilityEngineService(prisma);

    const queues = await engine.getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Littoral' });

    expect(queues.statusCounts).toEqual({ PENDING_REVIEW: 400, APPROVED: 700, CORRECTION_REQUESTED: 0, REJECTED: 100, SUPERSEDED: 0 });
    expect(queues.approvedCount).toBe(700);
    expect(queues.regionCounts).toEqual([{ region: 'Littoral', count: 800 }, { region: null, count: 400 }]);
    // Aggregates use the same territory filter as the other queue counts,
    // and never count drafts (unsubmitted work).
    const scoped = { AND: [{ region: { equals: 'Littoral', mode: 'insensitive' } }, { status: { notIn: ['DRAFT', 'SUPERSEDED'] } }, { archivedAt: null }] };
    for (const call of prisma.onefopSubmission.groupBy.mock.calls) {
      expect(call[0]).toMatchObject({ where: scoped, _count: { _all: true } });
    }
  });

  // The per-status queue counts are derived from the status groupBy rather than
  // issued as their own queries, to keep the endpoint's connection high-water
  // mark low against Supabase's session-mode pool. These assertions pin both
  // halves of that: the figures stay correct, and the extra queries stay gone.
  it('derives the total and per-status queue counts from the status groupBy', async () => {
    const prisma: any = {
      onefopSubmission: {
        count: jest.fn(async () => 650),
        aggregate: jest.fn(async () => ({ _min: { submissionDate: null } })),
        // The only rows read are the two dates of each recent decision.
        findMany: jest.fn(async (args: any) => {
          if (JSON.stringify(args.select) !== JSON.stringify({ id: true, submissionDate: true, reviewedAt: true })) {
            throw new Error('getPilotageQueues must not fetch whole submission rows');
          }
          return [];
        }),
        groupBy: jest.fn(async ({ by }: any) =>
          by[0] === 'status'
            ? [
                { status: 'APPROVED', _count: { _all: 700 } },
                { status: 'PENDING_REVIEW', _count: { _all: 400 } },
                { status: 'CORRECTION_REQUESTED', _count: { _all: 80 } },
                { status: 'REJECTED', _count: { _all: 100 } },
              ]
            : [{ region: 'Littoral', _count: { _all: 1280 } }],
        ),
      },
      onefopAnomaly: { count: jest.fn(async () => 3) },
      auditLog: { findMany: jest.fn(async () => []) },
    };
    const engine = new EligibilityEngineService(prisma);

    const queues = await engine.getPilotageQueues();

    // DRAFT and SUPERSEDED are excluded, so the four
    // remaining buckets partition the result set and the total is their sum.
    expect(queues.totalSubmissionsCount).toBe(1280);
    expect(queues.pendingNationalVisasCount).toBe(400);
    expect(queues.correctionsUnderReviewCount).toBe(80);
    expect(prisma.onefopSubmission.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.onefopSubmission.findMany).toHaveBeenCalledTimes(1);
    // Two submission counts: the statistically-ready figure, computed in the
    // database with a `none` anomaly filter, and the overdue review count.
    expect(prisma.onefopSubmission.count).toHaveBeenCalledTimes(2);
    expect(prisma.onefopSubmission.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'APPROVED',
        anomalies: { none: { status: 'OPEN', isBlocking: true } },
      }),
    });
    expect(queues.statisticallyReadyCount).toBe(650);
  });
});

// ── Connection high-water mark (EMAXCONNSESSION) ────────────────────────────
// Prisma opens one pooled connection per concurrent query, and the production
// pooler runs in session mode with a tenant pool of 15. These cases pin the
// peak number of queries each dashboard aggregate keeps in flight.

/** Wraps every mock so it resolves after a tick, tracking the peak in flight. */
function trackConcurrency(prisma: any) {
  const state = { inFlight: 0, peak: 0, calls: 0 };
  for (const model of Object.values(prisma) as any[]) {
    for (const [name, fn] of Object.entries(model) as Array<[string, any]>) {
      if (!jest.isMockFunction(fn)) continue;
      const impl = fn.getMockImplementation();
      model[name] = jest.fn(async (...args: any[]) => {
        state.inFlight += 1;
        state.calls += 1;
        state.peak = Math.max(state.peak, state.inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        state.inFlight -= 1;
        return impl ? impl(...args) : undefined;
      });
    }
  }
  return state;
}

describe('EligibilityEngineService.getPilotageQueues — bounded concurrency', () => {
  it('keeps at most two queries in flight and returns the same figures', async () => {
    const prisma: any = {
      onefopSubmission: {
        count: jest.fn(async () => 650),
        groupBy: jest.fn(async ({ by }: any) =>
          by[0] === 'status'
            ? [
                { status: 'APPROVED', _count: { _all: 700 } },
                { status: 'PENDING_REVIEW', _count: { _all: 400 } },
              ]
            : [{ region: 'Littoral', _count: { _all: 1100 } }],
        ),
        aggregate: jest.fn(async () => ({ _min: { submissionDate: null } })),
        findMany: jest.fn(async () => []),
      },
      onefopAnomaly: { count: jest.fn(async () => 3) },
      auditLog: { findMany: jest.fn(async () => []) },
    };
    const state = trackConcurrency(prisma);
    const engine = new EligibilityEngineService(prisma);

    const queues = await engine.getPilotageQueues({ role: 'SUPER_ADMIN' });

    expect(state.calls).toBe(8);
    expect(state.peak).toBeLessThanOrEqual(2);
    expect(queues).toEqual({
      totalSubmissionsCount: 1100,
      blockingAnomaliesCount: 3,
      pendingNationalVisasCount: 400,
      correctionsUnderReviewCount: 0,
      statisticallyReadyCount: 650,
      countsView: 'all',
      statusCounts: { PENDING_REVIEW: 400, APPROVED: 700, CORRECTION_REQUESTED: 0, REJECTED: 0, SUPERSEDED: 0 },
      approvedCount: 700,
      regionCounts: [{ region: 'Littoral', count: 1100 }],
      reviewDelay: {
        thresholdDays: 7,
        oldestPendingSubmittedAt: null,
        pendingOverThresholdCount: 650,
        windowDays: 90,
        decidedMedianDays: null,
        decidedCount: 0,
      },
    });
  });
});

/** Review-delay queries returning nothing: no file waits, none was decided. */
function reviewDelayMocks() {
  return {
    onefopSubmission: {
      aggregate: jest.fn(async () => ({ _min: { submissionDate: null } })),
      findMany: jest.fn(async () => []),
    },
    auditLog: { findMany: jest.fn(async () => []) },
  };
}

describe('EligibilityEngineService.getPilotageQueues — review delay', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * DAY);

  function makePrisma(decided: Array<{ id: string; submittedDaysAgo: number; decidedDaysAgo: number }>, reopenedIds: string[] = []) {
    return {
      onefopSubmission: {
        groupBy: jest.fn(async () => []),
        count: jest.fn(async ({ where }: any) => (where.AND?.some((c: any) => c.submissionDate) ? 3 : 0)),
        aggregate: jest.fn(async () => ({ _min: { submissionDate: daysAgo(12) } })),
        findMany: jest.fn(async () =>
          decided.map((d) => ({ id: d.id, submissionDate: daysAgo(d.submittedDaysAgo), reviewedAt: daysAgo(d.decidedDaysAgo) })),
        ),
      },
      onefopAnomaly: { count: jest.fn(async () => 0) },
      auditLog: { findMany: jest.fn(async () => reopenedIds.map((resourceId) => ({ resourceId }))) },
    };
  }

  it('reports the oldest waiting file, the overdue count and the decision median', async () => {
    // Waits of 1, 3, 4 and 10 days: median 3.5.
    const prisma: any = makePrisma([
      { id: 'a', submittedDaysAgo: 2, decidedDaysAgo: 1 },
      { id: 'b', submittedDaysAgo: 5, decidedDaysAgo: 2 },
      { id: 'c', submittedDaysAgo: 6, decidedDaysAgo: 2 },
      { id: 'd', submittedDaysAgo: 20, decidedDaysAgo: 10 },
    ]);
    const { reviewDelay } = await new EligibilityEngineService(prisma).getPilotageQueues({ role: 'SUPER_ADMIN' });

    expect(reviewDelay.thresholdDays).toBe(7);
    expect(reviewDelay.windowDays).toBe(90);
    expect(new Date(reviewDelay.oldestPendingSubmittedAt!).getTime()).toBe(daysAgo(12).getTime());
    expect(reviewDelay.pendingOverThresholdCount).toBe(3);
    expect(reviewDelay.decidedMedianDays).toBe(3.5);
    expect(reviewDelay.decidedCount).toBe(4);
  });

  it('measures PENDING_REVIEW only, scoped like the queue counts, with a 7-day threshold', async () => {
    const prisma: any = makePrisma([]);
    await new EligibilityEngineService(prisma).getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Littoral' });

    const territory = { region: { equals: 'Littoral', mode: 'insensitive' } };
    const [{ where: oldestWhere }] = prisma.onefopSubmission.aggregate.mock.calls[0];
    expect(oldestWhere).toEqual({ AND: [territory, { status: 'PENDING_REVIEW' }, { archivedAt: null }] });

    const overdue = prisma.onefopSubmission.count.mock.calls
      .map(([args]: any) => args.where)
      .find((w: any) => w.AND?.some((c: any) => c.submissionDate));
    expect(overdue.AND.slice(0, 3)).toEqual([territory, { status: 'PENDING_REVIEW' }, { archivedAt: null }]);
    const cutoff = overdue.AND[3].submissionDate.lt.getTime();
    expect(Math.abs(cutoff - daysAgo(7).getTime())).toBeLessThan(5000);

    const [{ where: decidedWhere, select }] = prisma.onefopSubmission.findMany.mock.calls[0];
    expect(select).toEqual({ id: true, submissionDate: true, reviewedAt: true });
    expect(decidedWhere.AND[0]).toEqual(territory);
    expect(decidedWhere.AND[1]).toEqual({ status: { in: ['APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'SUPERSEDED'] } });
    expect(decidedWhere.AND.some((c: any) => c.archivedAt === null)).toBe(true);
    expect(Math.abs(decidedWhere.AND[2].reviewedAt.gte.getTime() - daysAgo(90).getTime())).toBeLessThan(5000);
  });

  it('fails closed for a territorial account without a territory', async () => {
    const prisma: any = makePrisma([]);
    await new EligibilityEngineService(prisma).getPilotageQueues({ role: 'REGIONAL_ADMIN' });
    expect(prisma.onefopSubmission.aggregate.mock.calls[0][0].where.AND[0]).toEqual({ id: { in: [] } });
    expect(prisma.onefopSubmission.findMany.mock.calls[0][0].where.AND[0]).toEqual({ id: { in: [] } });
  });

  it('leaves reopened files out of the median: their reviewedAt is the reopening', async () => {
    const prisma: any = makePrisma(
      [
        { id: 'a', submittedDaysAgo: 3, decidedDaysAgo: 1 },
        { id: 'reopened', submittedDaysAgo: 80, decidedDaysAgo: 1 },
      ],
      ['reopened'],
    );
    const { reviewDelay } = await new EligibilityEngineService(prisma).getPilotageQueues({ role: 'SUPER_ADMIN' });
    expect(reviewDelay.decidedMedianDays).toBe(2);
    expect(reviewDelay.decidedCount).toBe(1);
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toMatchObject({ action: 'AUDIT_REOPEN', resourceType: 'OnefopSubmission' });
  });

  it('returns null, not zero, when nothing waits and nothing was decided', async () => {
    const prisma: any = makePrisma([]);
    prisma.onefopSubmission.aggregate = jest.fn(async () => ({ _min: { submissionDate: null } }));
    const { reviewDelay } = await new EligibilityEngineService(prisma).getPilotageQueues({ role: 'SUPER_ADMIN' });
    expect(reviewDelay.oldestPendingSubmittedAt).toBeNull();
    expect(reviewDelay.decidedMedianDays).toBeNull();
    expect(reviewDelay.decidedCount).toBe(0);
  });
});

describe('EligibilityEngineService.getQualitySummary — aggregates', () => {
  const scoped = {
    AND: [
      { region: { equals: 'Littoral', mode: 'insensitive' } },
      { archivedAt: null },
      { status: { notIn: ['DRAFT', 'SUPERSEDED'] } },
      { campaignId: 'camp-1' },
    ],
  };

  function makePrisma() {
    return {
      onefopSubmission: {
        groupBy: jest.fn(async () => [
          { status: 'APPROVED', _count: { _all: 60 } },
          { status: 'PENDING_REVIEW', _count: { _all: 25 } },
          { status: 'CORRECTION_REQUESTED', _count: { _all: 10 } },
          { status: 'REJECTED', _count: { _all: 5 } },
        ]),
        count: jest.fn(async ({ where }: any) => {
          if (where.status === 'APPROVED') return 50; // statistically ready
          const some = where.anomalies?.some;
          if (some?.ruleFamily) return 8; // coherence
          if (some?.isBlocking === true) return 12;
          if (some?.isBlocking === false) return 30;
          throw new Error(`unexpected count ${JSON.stringify(where)}`);
        }),
      },
      onefopAnomaly: {
        groupBy: jest.fn(async ({ by }: any) =>
          by[0] === 'isBlocking'
            ? [
                { isBlocking: true, _count: { _all: 14 } },
                { isBlocking: false, _count: { _all: 41 } },
              ]
            : [
                { ruleFamily: 'COHERENCE', _count: { _all: 33 } },
                { ruleFamily: 'COMPLETENESS', _count: { _all: 22 } },
              ],
        ),
        findMany: jest.fn(async () => [
          { submission: { region: 'Littoral' } },
          { submission: { region: 'Littoral' } },
          { submission: { region: null } },
        ]),
      },
    };
  }

  it('returns the same indicators, derived from the folded groupBys', async () => {
    const prisma: any = makePrisma();
    const engine = new EligibilityEngineService(prisma);

    const summary = await engine.getQualitySummary({ role: 'REGIONAL_ADMIN', region: 'Littoral' }, 'camp-1');

    // total 100, 10 in correction, 8 with coherence anomalies, 12 with
    // blocking, 30 with warnings, 50 statistically ready.
    expect(summary).toEqual({
      completenessRate: 90,
      coherenceRate: 92,
      anomalyRate: 12,
      warningRate: 30,
      statisticalEligibilityRate: 50,
      totalSubmissions: 100,
      blockingAnomaliesCount: 14,
      warningsCount: 41,
      statisticallyReadyCount: 50,
      byRuleFamily: [
        { ruleFamily: 'COHERENCE', count: 33 },
        { ruleFamily: 'COMPLETENESS', count: 22 },
      ],
      byRegion: [
        { region: 'Littoral', count: 2 },
        { region: 'Non assigné', count: 1 },
      ],
    });
  });

  it('applies the territory, draft and campaign filters to every query', async () => {
    const prisma: any = makePrisma();
    const engine = new EligibilityEngineService(prisma);
    await engine.getQualitySummary({ role: 'REGIONAL_ADMIN', region: 'Littoral' }, 'camp-1');

    for (const [args] of prisma.onefopSubmission.groupBy.mock.calls) expect(args.where).toEqual(scoped);
    for (const [args] of prisma.onefopSubmission.count.mock.calls) {
      expect(args.where.AND).toEqual(scoped.AND);
    }
    for (const [args] of [...prisma.onefopAnomaly.groupBy.mock.calls, ...prisma.onefopAnomaly.findMany.mock.calls]) {
      expect(args.where).toEqual({ status: 'OPEN', submission: scoped });
    }
  });

  it('reports null rates and zero counts when nothing is in scope', async () => {
    const prisma: any = makePrisma();
    prisma.onefopSubmission.groupBy.mockResolvedValue([]);
    prisma.onefopSubmission.count.mockResolvedValue(0);
    prisma.onefopAnomaly.groupBy.mockResolvedValue([]);
    prisma.onefopAnomaly.findMany.mockResolvedValue([]);
    const engine = new EligibilityEngineService(prisma);

    const summary = await engine.getQualitySummary({ role: 'REGIONAL_ADMIN' });

    expect(summary).toMatchObject({
      completenessRate: null,
      coherenceRate: null,
      anomalyRate: null,
      warningRate: null,
      statisticalEligibilityRate: null,
      totalSubmissions: 0,
      blockingAnomaliesCount: 0,
      warningsCount: 0,
      statisticallyReadyCount: 0,
      byRuleFamily: [],
      byRegion: [],
    });
  });

  it('keeps at most three queries in flight (was ten)', async () => {
    const prisma: any = makePrisma();
    const state = trackConcurrency(prisma);
    const engine = new EligibilityEngineService(prisma);
    await engine.getQualitySummary({ role: 'SUPER_ADMIN' });
    expect(state.calls).toBe(8);
    expect(state.peak).toBeLessThanOrEqual(3);
  });
});

// ── Campaign progress B4: bulk review transitions ────────────────────────────

describe('EligibilityEngineService — campaign progress on bulk review (B4)', () => {
  const actor = { id: 'actor-1', role: UserRole.SUPER_ADMIN, email: 'agent@onefop.cm' };
  let tx: any;
  let prisma: any;
  let engine: EligibilityEngineService;

  function build(candidates: any[]) {
    tx = {
      onefopSubmission: {
        findMany: jest.fn(async () => candidates),
        updateMany: jest.fn(async () => ({ count: candidates.length })),
      },
      auditLog: { create: jest.fn(async () => ({})) },
      campaignSubmission: { updateMany: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((fn: any) => fn(tx)),
      campaignSubmission: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    engine = new EligibilityEngineService(prisma);
  }

  function dossier(
    id: string,
    campaignId: string | null,
    companyId: string | null,
    status: OnefopStatus = OnefopStatus.PENDING_REVIEW,
    establishmentId: string | null = 'est-' + id,
  ) {
    return { id, status, region: 'Centre', department: 'Mfoundi', anomalies: [], campaignId, companyId, establishmentId };
  }

  const rejectDto = (ids: string[]) => ({
    submissionIds: ids,
    certified: true,
    reason: 'Motif de rejet suffisamment long pour passer la validation',
  });

  it('bulk visa: each approved dossier CampaignSubmission -> VALIDATED, after commit', async () => {
    build([dossier('s1', 'camp-1', 'co-1'), dossier('s2', 'camp-1', 'co-2')]);
    const result = await engine.executeBulkVisa(actor, { submissionIds: ['s1', 's2'], certified: true });

    expect(result.approvedIds).toEqual(['s1', 's2']);
    expect(prisma.campaignSubmission.updateMany.mock.calls).toEqual([
      [{ where: { campaignId: 'camp-1', establishmentId: 'est-s1' }, data: { status: 'VALIDATED' } }],
      [{ where: { campaignId: 'camp-1', establishmentId: 'est-s2' }, data: { status: 'VALIDATED' } }],
    ]);
    // Not written through the transaction client.
    expect(tx.campaignSubmission.updateMany).not.toHaveBeenCalled();
    expect(tx.onefopSubmission.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.campaignSubmission.updateMany.mock.invocationCallOrder[0]);
  });

  it('bulk visa: dossiers not approved (wrong status) are not synced', async () => {
    build([dossier('s1', 'camp-1', 'co-1'), dossier('s2', 'camp-1', 'co-2', OnefopStatus.APPROVED)]);
    await engine.executeBulkVisa(actor, { submissionIds: ['s1', 's2'], certified: true });

    expect(prisma.campaignSubmission.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.campaignSubmission.updateMany.mock.calls[0][0].where).toEqual({ campaignId: 'camp-1', establishmentId: 'est-s1' });
  });

  it('bulk reject: each rejected dossier CampaignSubmission -> NOT_STARTED, submittedAt = null', async () => {
    build([dossier('s1', 'camp-1', 'co-1'), dossier('s2', 'camp-2', 'co-2', OnefopStatus.CORRECTION_REQUESTED)]);
    const result = await engine.executeBulkReject(actor, rejectDto(['s1', 's2']));

    expect(result.rejectedIds).toEqual(['s1', 's2']);
    expect(prisma.campaignSubmission.updateMany.mock.calls).toEqual([
      [{ where: { campaignId: 'camp-1', establishmentId: 'est-s1' }, data: { status: 'NOT_STARTED', submittedAt: null } }],
      [{ where: { campaignId: 'camp-2', establishmentId: 'est-s2' }, data: { status: 'NOT_STARTED', submittedAt: null } }],
    ]);
    expect(tx.campaignSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('bulk reject: loads campaignId, companyId and establishmentId in the candidate select', async () => {
    build([dossier('s1', 'camp-1', 'co-1')]);
    await engine.executeBulkReject(actor, rejectDto(['s1']));
    const [{ select }] = tx.onefopSubmission.findMany.mock.calls[0];
    expect(select).toMatchObject({ campaignId: true, companyId: true, establishmentId: true });
  });

  it('campaignId null: no update, no error', async () => {
    build([dossier('s1', null, 'co-1')]);
    const errorSpy = jest.spyOn((engine as any).logger, 'error').mockImplementation(() => undefined);

    await expect(engine.executeBulkVisa(actor, { submissionIds: ['s1'], certified: true }))
      .resolves.toMatchObject({ success: true, processedCount: 1 });
    await expect(engine.executeBulkReject(actor, rejectDto(['s1'])))
      .resolves.toMatchObject({ success: true, processedCount: 1 });

    expect(prisma.campaignSubmission.updateMany).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('establishmentId null: no update, no error', async () => {
    build([dossier('s1', 'camp-1', 'co-1', OnefopStatus.PENDING_REVIEW, null)]);
    const errorSpy = jest.spyOn((engine as any).logger, 'error').mockImplementation(() => undefined);

    await expect(engine.executeBulkVisa(actor, { submissionIds: ['s1'], certified: true }))
      .resolves.toMatchObject({ success: true, processedCount: 1 });
    await expect(engine.executeBulkReject(actor, rejectDto(['s1'])))
      .resolves.toMatchObject({ success: true, processedCount: 1 });

    expect(prisma.campaignSubmission.updateMany).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a failing update is logged per dossier and does not fail the bulk action', async () => {
    build([dossier('s1', 'camp-1', 'co-1'), dossier('s2', 'camp-1', 'co-2')]);
    const boom = new Error('campaign_submissions unavailable');
    prisma.campaignSubmission.updateMany
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce({ count: 1 });
    const errorSpy = jest.spyOn((engine as any).logger, 'error').mockImplementation(() => undefined);

    const result = await engine.executeBulkVisa(actor, { submissionIds: ['s1', 's2'], certified: true });

    expect(result).toMatchObject({ success: true, processedCount: 2, approvedIds: ['s1', 's2'] });
    // The second dossier is still synced after the first one failed.
    expect(prisma.campaignSubmission.updateMany).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('s1');
    expect(errorSpy.mock.calls[0][1]).toBe(boom.stack);
  });

  it('bulk reject: a failing update does not fail the action', async () => {
    build([dossier('s1', 'camp-1', 'co-1')]);
    prisma.campaignSubmission.updateMany.mockRejectedValue(new Error('down'));
    const errorSpy = jest.spyOn((engine as any).logger, 'error').mockImplementation(() => undefined);

    await expect(engine.executeBulkReject(actor, rejectDto(['s1'])))
      .resolves.toMatchObject({ success: true, processedCount: 1, rejectedIds: ['s1'] });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
