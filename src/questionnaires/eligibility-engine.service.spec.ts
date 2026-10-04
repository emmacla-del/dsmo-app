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
    const submission = { id: 's1', status: existingStatus, region: 'Centre', department: 'Mfoundi' };
    const prisma: any = {
      onefopSubmission: {
        findFirst: jest.fn(async () => submission),
        update: jest.fn(async (args: any) => ({ ...submission, ...args.data })),
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
        count: jest.fn(async () => 1200),
        findMany: jest.fn(async () => [{ id: 'a', _count: { anomalies: 0 } }, { id: 'b', _count: { anomalies: 2 } }]),
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
    };
    const engine = new EligibilityEngineService(prisma);

    const queues = await engine.getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Littoral' });

    expect(queues.statusCounts).toEqual({ PENDING_REVIEW: 400, APPROVED: 700, CORRECTION_REQUESTED: 0, REJECTED: 100 });
    expect(queues.approvedCount).toBe(700);
    expect(queues.regionCounts).toEqual([{ region: 'Littoral', count: 800 }, { region: null, count: 400 }]);
    // Aggregates use the same territory filter as the other queue counts,
    // and never count drafts (unsubmitted work).
    const scoped = { AND: [{ region: { equals: 'Littoral', mode: 'insensitive' } }, { status: { not: 'DRAFT' } }] };
    expect(prisma.onefopSubmission.count).toHaveBeenCalledWith({ where: scoped });
    for (const call of prisma.onefopSubmission.groupBy.mock.calls) {
      expect(call[0]).toMatchObject({ where: scoped, _count: { _all: true } });
    }
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
