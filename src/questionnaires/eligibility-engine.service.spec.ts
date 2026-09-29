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

      const regionalUser = { id: 'usr-1', role: UserRole.REGIONAL, region: 'Centre' };
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
        where: { id: { in: ['clean-1'] } },
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

    const queues = await engine.getPilotageQueues({ role: 'REGIONAL', region: 'Littoral' });

    expect(queues.statusCounts).toEqual({ PENDING_REVIEW: 400, APPROVED: 700, CORRECTION_REQUESTED: 0, REJECTED: 100 });
    expect(queues.approvedCount).toBe(700);
    expect(queues.regionCounts).toEqual([{ region: 'Littoral', count: 800 }, { region: null, count: 400 }]);
    // Aggregates use the same territory filter as the other queue counts.
    const scoped = { region: { equals: 'Littoral', mode: 'insensitive' } };
    for (const call of prisma.onefopSubmission.groupBy.mock.calls) {
      expect(call[0]).toMatchObject({ where: scoped, _count: { _all: true } });
    }
  });
});
