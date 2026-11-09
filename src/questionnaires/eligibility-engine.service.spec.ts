// src/questionnaires/eligibility-engine.service.spec.ts
import { EligibilityEngineService } from './eligibility-engine.service';
import { AnomalyResolutionType, AnomalySeverity, AnomalyStatus, OnefopStatus, UserRole } from '@prisma/client';
import { StatisticalExclusionReason } from '../types/eligibility.types';
import { ForbiddenException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('EligibilityEngineService', () => {
  let service: EligibilityEngineService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      onefopSubmission: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      onefopAnomaly: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn(async () => null),
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
    it('refuses RULE_RECHECK from any person, a national admin included', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1', status: AnomalyStatus.OPEN, isBlocking: false,
        submission: { id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'usr-1', archivedAt: null, revision: 1, region: 'Centre' },
      });
      await expect(service.resolveAnomaly('ano-1', { id: 'usr-1', role: UserRole.SUPER_ADMIN }, {
        resolutionType: AnomalyResolutionType.RULE_RECHECK,
        resolutionNote: 'Tentative de clôture système',
        expectedRevision: 1,
      })).rejects.toThrow(BadRequestException);
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a reviewer explanation on a blocking anomaly and writes nothing', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1', status: AnomalyStatus.OPEN, isBlocking: true,
        submission: {
          id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'usr-1',
          archivedAt: null, revision: 1, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });
      await expect(service.resolveAnomaly('ano-1', { id: 'usr-1', role: UserRole.ADMIN_ONEFOP }, {
        resolutionType: AnomalyResolutionType.REVIEWER_EXPLANATION,
        resolutionNote: 'Chiffres confirmés par téléphone',
        expectedRevision: 1,
      })).rejects.toThrow(BadRequestException);
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    });

    it('closes an advisory warning explained by its claim holder as RESOLVED', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValueOnce({
        id: 'ano-1', ruleCode: 'S22Q04_PERMANENT_EXCEEDS_TOTAL', submissionId: 'sub-1',
        status: AnomalyStatus.OPEN, isBlocking: false,
        submission: {
          id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'usr-1', claimActivityAt: new Date(),
          archivedAt: null, revision: 1, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      }).mockResolvedValueOnce({ id: 'ano-1', status: AnomalyStatus.RESOLVED });
      const res = await service.resolveAnomaly('ano-1', { id: 'usr-1', role: UserRole.ADMIN_ONEFOP }, {
        resolutionType: AnomalyResolutionType.REVIEWER_EXPLANATION,
        resolutionNote: 'Chiffres confirmés par téléphone',
        expectedRevision: 1,
      });
      expect(prisma.onefopAnomaly.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: AnomalyStatus.RESOLVED, resolutionType: AnomalyResolutionType.REVIEWER_EXPLANATION }),
      }));
      expect(res.status).toBe(AnomalyStatus.RESOLVED);
    });

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
          expectedRevision: 1,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows central superadmin to grant LEGAL_DEROGATION and sets status to WAIVED', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValueOnce({
        id: 'ano-1',
        ruleCode: 'RULE-1',
        submissionId: 'sub-1',
        status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-2',
          archivedAt: null, revision: 1, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      }).mockResolvedValueOnce({ id: 'ano-1', status: AnomalyStatus.WAIVED });

      const superAdmin = { id: 'usr-super', role: UserRole.SUPER_ADMIN };
      const res = await service.resolveAnomaly('ano-1', superAdmin, {
        resolutionType: AnomalyResolutionType.LEGAL_DEROGATION,
        resolutionNote: 'Arrêté ministériel dérogatoire N° 2026/04',
        expectedRevision: 1,
      });

      expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'sub-1', revision: 1, assigneeId: 'reviewer-2',
        }),
        data: expect.objectContaining({ revision: { increment: 1 }, updatedAt: expect.any(Date) }),
      }));
      expect(prisma.onefopAnomaly.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'ano-1', status: AnomalyStatus.OPEN }),
        data: expect.objectContaining({ status: AnomalyStatus.WAIVED }),
      }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ANOMALY_WAIVED' }),
        })
      );
      expect(res.status).toBe(AnomalyStatus.WAIVED);
    });

    it('requires a dossier revision for privileged waivers and leaves both rows untouched when it is missing', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1', status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-2',
          archivedAt: null, revision: 1, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });

      await expect(service.resolveAnomaly('ano-1', { id: 'usr-super', role: UserRole.SUPER_ADMIN }, {
        resolutionType: AnomalyResolutionType.LEGAL_DEROGATION,
        resolutionNote: 'Arrêté ministériel dérogatoire N° 2026/04',
      } as any)).rejects.toThrow(BadRequestException);

      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('does not resolve an anomaly when the dossier revision changes before the waiver CAS', async () => {
      const revision = 1;
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-1', status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-2',
          archivedAt: null, revision, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });
      prisma.onefopSubmission.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.resolveAnomaly('ano-1', { id: 'usr-super', role: UserRole.SUPER_ADMIN }, {
        resolutionType: AnomalyResolutionType.LEGAL_DEROGATION,
        resolutionNote: 'Arrêté ministériel dérogatoire N° 2026/04',
        expectedRevision: revision,
      })).rejects.toThrow(ConflictException);

      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects an ordinary resolution with a stale dossier revision before mutation', async () => {
      const currentRevision = 2;
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-stale',
        status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-stale', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-1',
          archivedAt: null, revision: currentRevision, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });

      await expect(service.resolveAnomaly('ano-stale', {
        id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre',
      }, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les pièces justificatives confirment la déclaration.',
        expectedRevision: 1,
      })).rejects.toThrow(ConflictException);

      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('allows only one of two anomaly resolutions to consume the same dossier revision', async () => {
      const revision = 7;
      const submission = {
        id: 'sub-concurrent',
        status: OnefopStatus.PENDING_REVIEW,
        assigneeId: 'reviewer-1',
        archivedAt: null,
        revision,
        claimActivityAt: new Date(Date.now() - 60 * 60 * 1000),
        region: 'Centre',
      };
      const anomalies = new Map<string, { id: string; ruleCode: string; submissionId: string; status: AnomalyStatus }>([
        ['ano-a', { id: 'ano-a', ruleCode: 'RULE-A', submissionId: submission.id, status: AnomalyStatus.OPEN }],
        ['ano-b', { id: 'ano-b', ruleCode: 'RULE-B', submissionId: submission.id, status: AnomalyStatus.OPEN }],
      ]);
      let storedRevision = revision;
      prisma.onefopAnomaly.findUnique.mockImplementation(async ({ where, include }: any) => {
        const anomaly = anomalies.get(where.id);
        if (!anomaly) return null;
        return include ? { ...anomaly, submission: { ...submission, revision: storedRevision } } : { ...anomaly };
      });
      prisma.onefopSubmission.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.revision !== storedRevision) return { count: 0 };
        storedRevision += data.revision.increment;
        submission.revision = storedRevision;
        submission.claimActivityAt = data.claimActivityAt;
        return { count: 1 };
      });
      prisma.onefopAnomaly.updateMany.mockImplementation(async ({ where, data }: any) => {
        const anomaly = anomalies.get(where.id);
        if (!anomaly || anomaly.status !== where.status) return { count: 0 };
        Object.assign(anomaly, data);
        return { count: 1 };
      });

      const actor = { id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre' };
      const resolve = (id: string) => service.resolveAnomaly(id, actor, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les justificatifs confirment cette valeur.',
        expectedRevision: revision,
      });
      const results = await Promise.allSettled([resolve('ano-a'), resolve('ano-b')]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const conflict = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      expect(conflict.reason).toBeInstanceOf(ConflictException);
      expect(storedRevision).toBe(revision + 1);
      expect([...anomalies.values()].filter((anomaly) => anomaly.status === AnomalyStatus.RESOLVED)).toHaveLength(1);
      expect(prisma.onefopAnomaly.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    });

    it('requires active ownership for an ordinary anomaly resolution and records it as review progress', async () => {
      const revision = 1;
      const anomaly = {
        id: 'ano-2', ruleCode: 'RULE-2', submissionId: 'sub-2', status: AnomalyStatus.OPEN,
        submission: { id: 'sub-2', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-1', archivedAt: null, revision, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre' },
      };
      prisma.onefopAnomaly.findUnique.mockResolvedValueOnce(anomaly).mockResolvedValueOnce({ ...anomaly, status: AnomalyStatus.RESOLVED });

      const resolved = await service.resolveAnomaly('ano-2', { id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre' }, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les pièces jointes confirment la valeur déclarée.',
        expectedRevision: revision,
      });

      expect(resolved.status).toBe(AnomalyStatus.RESOLVED);
      expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'sub-2', assigneeId: 'reviewer-1', revision }),
        data: { revision: { increment: 1 }, updatedAt: expect.any(Date) },
      }));
      expect(prisma.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual([
        'ANOMALY_RESOLVED', 'DOSSIER_REVIEW_PROGRESS_SAVED',
      ]);
    });

    it('forbids an ordinary anomaly resolution by a different claim holder', async () => {
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-3', status: AnomalyStatus.OPEN,
        submission: { id: 'sub-3', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-2', archivedAt: null, revision: 1, updatedAt: new Date(), region: 'Centre' },
      });

      await expect(service.resolveAnomaly('ano-3', { id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre' }, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les pièces jointes confirment la valeur déclarée.',
        expectedRevision: 1,
      })).rejects.toThrow(ForbiddenException);
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('clears an expired claim only when its former owner attempts anomaly resolution', async () => {
      const revision = 1;
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-expired', status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-expired', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-1',
          archivedAt: null, revision, claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000), updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });

      await expect(service.resolveAnomaly('ano-expired', {
        id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre',
      }, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les pièces jointes confirment la déclaration.',
        expectedRevision: revision,
      })).rejects.toThrow(ConflictException);

      expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'sub-expired', assigneeId: 'reviewer-1', revision }),
        data: expect.objectContaining({ assigneeId: null, claimActivityAt: null, revision: { increment: 1 } }),
      }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'DOSSIER_CLAIM_EXPIRED', resourceId: 'sub-expired',
          details: expect.objectContaining({ previousAssigneeId: 'reviewer-1', reason: 'DEADLINE' }),
        }),
      }));
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
    });

    it('does not inspect, clear, or expiration-audit an expired claim for another anomaly reviewer', async () => {
      const revision = 1;
      prisma.onefopAnomaly.findUnique.mockResolvedValue({
        id: 'ano-expired', status: AnomalyStatus.OPEN,
        submission: {
          id: 'sub-expired', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'reviewer-2',
          archivedAt: null, revision, claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000), updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre',
        },
      });

      await expect(service.resolveAnomaly('ano-expired', {
        id: 'reviewer-1', role: UserRole.REGIONAL_ADMIN, region: 'Centre',
      }, {
        resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
        resolutionNote: 'Les pièces jointes confirment la déclaration.',
        expectedRevision: revision,
      })).rejects.toThrow(ForbiddenException);

      expect(prisma.auditLog.findFirst).not.toHaveBeenCalled();
      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
      expect(prisma.onefopAnomaly.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
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

    it('returns the monotonic dossier revision in the anomaly registry projection', async () => {
      const updatedAt = new Date('2026-10-29T10:00:00.123Z');
      const revision = 18;
      prisma.onefopSubmission.findMany.mockResolvedValue([]);
      prisma.onefopAnomaly.count.mockResolvedValue(1);
      prisma.onefopAnomaly.findMany.mockResolvedValue([{
        id: 'ano-revision',
        status: AnomalyStatus.OPEN,
        submission: { id: 'sub-revision', updatedAt, revision },
        resolvedBy: null,
      }]);

      const result = await service.listAnomalies({}, { role: UserRole.ADMIN_ONEFOP } as any);

      expect(prisma.onefopAnomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({
          submission: expect.objectContaining({
            select: expect.objectContaining({ updatedAt: true, revision: true }),
          }),
        }),
      }));
      expect(result.items[0].submission.updatedAt).toEqual(updatedAt);
      expect(result.items[0].submission.revision).toBe(revision);
      expect(JSON.parse(JSON.stringify(result)).items[0].submission.updatedAt).toBe(updatedAt.toISOString());
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
          assigneeId: 'admin-1',
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          anomalies: [],
        },
        {
          id: 'dirty-2',
          status: OnefopStatus.PENDING_REVIEW,
          assigneeId: 'admin-1',
          updatedAt: new Date('2026-01-01T00:00:00Z'),
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
      expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'clean-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'admin-1' }),
        data: expect.objectContaining({ status: OnefopStatus.APPROVED, assigneeId: null }),
      }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AUDIT_BULK_VISA_GRANTED' }),
        })
      );
    });

    const warned = (id: string) => ({
      id,
      status: OnefopStatus.PENDING_REVIEW,
      assigneeId: 'admin-1',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      anomalies: [{ id: `w-${id}`, isBlocking: false }, { id: `w2-${id}`, isBlocking: false }],
    });
    const clean = { id: 'clean-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'admin-1', updatedAt: new Date('2026-01-01T00:00:00Z'), anomalies: [] };

    it('refuses a file with open warnings when the batch carries no justification, and endorses the rest', async () => {
      prisma.onefopSubmission.findMany.mockResolvedValue([clean, warned('warned-2')]);
      const result = await service.executeBulkVisa(
        { id: 'admin-1', role: UserRole.SUPER_ADMIN },
        { submissionIds: ['clean-1', 'warned-2'], certified: true, notes: '   ' },
      );
      expect(result.approvedIds).toEqual(['clean-1']);
      expect(result.rejectedItems).toEqual([
        { id: 'warned-2', reason: 'Une justification est requise pour viser ce dossier : 2 avertissement(s) ouvert(s).' },
      ]);
      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'warned-2' }),
      }));
    });

    it('endorses a warned file with the batch justification, recorded on its own decision', async () => {
      prisma.onefopSubmission.findMany.mockResolvedValue([warned('warned-2')]);
      const result = await service.executeBulkVisa(
        { id: 'admin-1', role: UserRole.SUPER_ADMIN },
        { submissionIds: ['warned-2'], certified: true, notes: 'Écarts vérifiés avec les établissements.' },
      );
      expect(result.approvedIds).toEqual(['warned-2']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'AUDIT_APPROVE',
          resourceId: 'warned-2',
          details: expect.objectContaining({ openWarnings: 2, justification: 'Écarts vérifiés avec les établissements.' }),
        }),
      }));
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
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    engine = new EligibilityEngineService(prisma);
    return engine;
  }

  it('reports missing IDs instead of silently dropping them', async () => {
    buildEngine([{
      id: 's1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'actor', updatedAt: new Date(), region: 'Centre', department: 'Mfoundi', anomalies: [],
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
      id: 's1', status: OnefopStatus.APPROVED, assigneeId: 'a', updatedAt: new Date(), region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    const divActor = { id: 'a', role: UserRole.DIVISIONAL_ADMIN, region: 'Centre', department: 'Wouri', email: 'a@a.cm' };
    const result = await engine.executeBulkVisa(divActor, { submissionIds: ['s1'], certified: true });
    // Must NOT reveal that the status was APPROVED (territory info-leak)
    expect(result.rejectedItems[0].reason).not.toMatch(/APPROVED/i);
    expect(result.rejectedItems[0].reason).toMatch(/introuvable|ressort/i);
  });

  it('updateMany includes status condition (concurrency guard)', async () => {
    buildEngine([{
      id: 's1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'a', updatedAt: new Date(), region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    await engine.executeBulkVisa(
      { id: 'a', role: UserRole.SUPER_ADMIN, email: 'a@a.cm' },
      { submissionIds: ['s1'], certified: true },
    );
    const [{ where }] = tx.onefopSubmission.updateMany.mock.calls[0];
    expect(where).toMatchObject({ status: OnefopStatus.PENDING_REVIEW });
  });

  it('does not clear or expiration-audit another reviewer\'s expired claim during bulk visa', async () => {
    buildEngine([{
      id: 's1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'former-owner',
      updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre', department: 'Mfoundi', anomalies: [],
    }]);
    tx.auditLog.findFirst.mockResolvedValue({
      action: 'DOSSIER_ASSIGNED', userId: 'former-owner',
      timestamp: new Date(Date.now() - 13 * 60 * 60 * 1000), details: { assigneeId: 'former-owner' },
    });

    const result = await engine.executeBulkVisa(
      { id: 'actor', role: UserRole.SUPER_ADMIN, email: 'a@a.cm' },
      { submissionIds: ['s1'], certified: true },
    );

    expect(result.rejectedItems[0]).toMatchObject({ id: 's1', reason: expect.stringMatching(/autre agent/i) });
    expect(tx.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.findFirst).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
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
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
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
    return { id, status, assigneeId: 'actor-1', revision: 1, claimActivityAt: null, updatedAt: new Date('2026-01-01T00:00:00Z'), region, department };
  }

  it('rejects PENDING_REVIEW and writes one audit record', async () => {
    buildEngine([sub('s1', OnefopStatus.PENDING_REVIEW)]);
    const result = await engine.executeBulkReject(actor, validDto);
    expect(result.processedCount).toBe(1);
    expect(result.rejectedIds).toEqual(['s1']);
    expect(result.rejectedCount).toBe(0);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual(['AUDIT_REJECT', 'AUDIT_BULK_REJECT']);
    expect(tx.auditLog.create.mock.calls[1][0].data.details.reason).toBe(validDto.reason);
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
    expect(where.status).toBe(OnefopStatus.PENDING_REVIEW);
    expect(where.assigneeId).toBe(actor.id);
    expect(where.revision).toBe(1);
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

  it('bulk decisions skip records not owned by this caller and report the failing record', async () => {
    buildEngine([
      sub('owned', OnefopStatus.PENDING_REVIEW),
      { ...sub('other-owner', OnefopStatus.PENDING_REVIEW), assigneeId: 'agent-2' },
    ]);
    const result = await engine.executeBulkReject(actor, { ...validDto, submissionIds: ['owned', 'other-owner'] });

    expect(result.rejectedIds).toEqual(['owned']);
    expect(result.rejectedCount).toBe(1);
    expect(result.rejectedItems).toEqual([{ id: 'other-owner', reason: 'Dossier réclamé par un autre agent.' }]);
  });

  it('bulk decisions report a concurrent row change instead of counting a stale write', async () => {
    buildEngine([sub('s1', OnefopStatus.PENDING_REVIEW)]);
    tx.onefopSubmission.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await engine.executeBulkReject(actor, validDto);

    expect(result.processedCount).toBe(0);
    expect(result.rejectedItems[0]).toMatchObject({ id: 's1', reason: expect.stringMatching(/simultanément/i) });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

// ── QuestionnairesService.reject — companion fix tests ────────────────────────

import { QuestionnairesService } from './questionnaires.service';

describe('QuestionnairesService.reject — companion fixes', () => {
  function buildService(existingStatus: string, overrides: Record<string, unknown> = {}) {
    const submission = { id: 's1', status: existingStatus, revision: 1, claimActivityAt: null, updatedAt: new Date('2026-01-01T00:00:00.000Z'), assigneeId: 'actor-1', archivedAt: null, region: 'Centre', department: 'Mfoundi', ...overrides };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      onefopSubmission: {
        findFirst: jest.fn(async () => submission),
        update: jest.fn(async (args: any) => ({ ...submission, ...args.data })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(async () => submission),
      },
      auditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
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
    await service.reject('s1', 'Justification valide et suffisamment longue', 'actor-1', undefined, 1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const [{ data }] = prisma.auditLog.create.mock.calls[0];
    expect(data.action).toBe('AUDIT_REJECT');
    expect(data.userId).toBe('actor-1');
    expect(prisma.onefopSubmission.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 's1', status: 'PENDING_REVIEW', assigneeId: 'actor-1' },
      data: { status: 'REJECTED', assigneeId: null },
    });
  });

  it('refuses an ordinary decision by an officer who does not own the active claim', async () => {
    const { service, prisma } = buildService('PENDING_REVIEW');
    await expect(service.reject('s1', 'Justification valide et suffisamment longue', 'different-agent', undefined, 1))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not clear or audit an expired claim when a different reviewer attempts the same decision', async () => {
    const { service, prisma } = buildService('PENDING_REVIEW', {
      claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    });

    await expect(service.reject('s1', 'Justification valide et suffisamment longue', 'different-agent', undefined, 1))
      .rejects.toThrow(ForbiddenException);

    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('clears and refuses a decision when the caller claim has expired', async () => {
    const { service, prisma } = buildService('PENDING_REVIEW', {
      claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    });
    await expect(service.reject('s1', 'Justification valide et suffisamment longue', 'actor-1', undefined, 1))
      .rejects.toThrow(/réclamation a expiré/i);
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assigneeId: 'actor-1' }),
      data: expect.objectContaining({ assigneeId: null }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DOSSIER_CLAIM_EXPIRED',
        resourceId: 's1',
        details: expect.objectContaining({ previousAssigneeId: 'actor-1', reason: 'DEADLINE' }),
      }),
    });
  });

  it('succeeds for CORRECTION_REQUESTED', async () => {
    const { service } = buildService('CORRECTION_REQUESTED');
    await expect(
      service.reject('s1', 'Justification valide et suffisamment longue', 'actor-1', undefined, 1),
    ).resolves.not.toThrow();
  });
});

/** The two statements of getPilotageQueues, told apart by what they select. */
function queueReads(rows: any[], pace: any = { oldestPending: null, overdue: 0, decidedDays: null }) {
  return jest.fn(async (query: any) => (query.sql.includes('"blockingAnomalies"') ? rows : [pace]));
}
const countRow = (status: string, region: string | null, files: number, blockingAnomalies = 0, statisticallyReady = 0) =>
  ({ status, region, files, blockingAnomalies, statisticallyReady });

describe('EligibilityEngineService.getPilotageQueues — dashboard aggregates', () => {
  it('computes status and region counts server-side over the whole territory', async () => {
    const $queryRaw = queueReads([
      countRow('APPROVED', 'Littoral', 700),
      countRow('PENDING_REVIEW', 'Littoral', 100),
      countRow('PENDING_REVIEW', null, 300),
      countRow('REJECTED', null, 100),
    ]);
    const engine = new EligibilityEngineService({ $queryRaw } as any);

    const queues = await engine.getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Littoral' });

    expect(queues.statusCounts).toEqual({ PENDING_REVIEW: 400, APPROVED: 700, CORRECTION_REQUESTED: 0, REJECTED: 100, SUPERSEDED: 0 });
    expect(queues.approvedCount).toBe(700);
    expect(queues.regionCounts).toEqual([{ region: 'Littoral', count: 800 }, { region: null, count: 400 }]);
    // Aggregates use the same territory filter as the other queue counts,
    // and never count drafts (unsubmitted work).
    const [counts] = $queryRaw.mock.calls[0];
    expect(counts.sql).toContain('LOWER(s.region) = LOWER(');
    expect(counts.values).toEqual(['Littoral']);
    expect(counts.sql).toContain(`NOT IN ('DRAFT', 'SUPERSEDED')`);
    expect(counts.sql).toContain('s."archivedAt" IS NULL');
  });

  it('derives the total, per-status and quality counts from the same rows', async () => {
    const engine = new EligibilityEngineService({
      $queryRaw: queueReads([
        countRow('APPROVED', 'Littoral', 700, 2, 650),
        countRow('PENDING_REVIEW', 'Littoral', 400, 1),
        countRow('CORRECTION_REQUESTED', 'Littoral', 80),
        countRow('REJECTED', 'Littoral', 100),
      ]),
    } as any);

    const queues = await engine.getPilotageQueues();

    expect(queues.totalSubmissionsCount).toBe(1280);
    expect(queues.pendingNationalVisasCount).toBe(400);
    expect(queues.correctionsUnderReviewCount).toBe(80);
    expect(queues.blockingAnomaliesCount).toBe(3);
    expect(queues.statisticallyReadyCount).toBe(650);
  });

  it('counts as ready only approved files with no open blocking anomaly', async () => {
    const $queryRaw = queueReads([]);
    await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues();
    const [counts] = $queryRaw.mock.calls[0];
    expect(counts.sql).toContain(`s.status::text = 'APPROVED' AND open.blocking = 0`);
    expect(counts.sql).toContain(`a.status::text = 'OPEN' AND a."isBlocking"`);
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
    const reads = queueReads(
      [countRow('APPROVED', 'Littoral', 700, 3, 650), countRow('PENDING_REVIEW', 'Littoral', 400)],
      { oldestPending: null, overdue: 650, decidedDays: null },
    );
    const state = { inFlight: 0, peak: 0, calls: 0 };
    const $queryRaw = async (query: any) => {
      state.calls += 1;
      state.inFlight += 1;
      state.peak = Math.max(state.peak, state.inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      state.inFlight -= 1;
      return reads(query);
    };
    const engine = new EligibilityEngineService({ $queryRaw } as any);

    const queues = await engine.getPilotageQueues({ role: 'SUPER_ADMIN' });

    expect(state.calls).toBe(2);
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

describe('EligibilityEngineService.getPilotageQueues — review delay', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * DAY);
  const paceQuery = ($queryRaw: jest.Mock) => $queryRaw.mock.calls[1][0];
  /** The parameter of a `::text::timestamp`, as a time. */
  const times = (query: any) => query.values.filter((v: unknown) => typeof v === 'string' && /^\d{4}-/.test(v as string)).map((v: string) => new Date(v).getTime());

  it('reports the oldest waiting file, the overdue count and the decision median', async () => {
    // Waits of 1, 3, 4 and 10 days: median 3.5.
    const $queryRaw = queueReads([], { oldestPending: daysAgo(12), overdue: 3, decidedDays: [1, 3, 4, 10] });
    const { reviewDelay } = await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues({ role: 'SUPER_ADMIN' });

    expect(reviewDelay.thresholdDays).toBe(7);
    expect(reviewDelay.windowDays).toBe(90);
    expect(new Date(reviewDelay.oldestPendingSubmittedAt!).getTime()).toBe(daysAgo(12).getTime());
    expect(reviewDelay.pendingOverThresholdCount).toBe(3);
    expect(reviewDelay.decidedMedianDays).toBe(3.5);
    expect(reviewDelay.decidedCount).toBe(4);
  });

  it('measures PENDING_REVIEW only, scoped like the queue counts, with a 7-day threshold', async () => {
    const $queryRaw = queueReads([]);
    await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Littoral' });

    const query = paceQuery($queryRaw);
    expect(query.sql).toContain(`s.status::text = 'PENDING_REVIEW' AND s."archivedAt" IS NULL`);
    expect(query.sql).toContain(`IN ('APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'SUPERSEDED')`);
    // Both halves are scoped: a territory in each of the two subqueries.
    expect(query.sql.match(/LOWER\(s\.region\) = LOWER\(/g)).toHaveLength(2);
    expect(query.values.filter((v: unknown) => v === 'Littoral')).toHaveLength(2);
    const [overdue, windowStart] = times(query);
    expect(Math.abs(overdue - daysAgo(7).getTime())).toBeLessThan(5000);
    expect(Math.abs(windowStart - daysAgo(90).getTime())).toBeLessThan(5000);
  });

  it('fails closed for a territorial account without a territory', async () => {
    const $queryRaw = queueReads([]);
    await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues({ role: 'REGIONAL_ADMIN' });
    expect($queryRaw.mock.calls[0][0].sql).toMatch(/WHERE FALSE AND/);
    expect(paceQuery($queryRaw).sql.split('WHERE FALSE')).toHaveLength(3);
  });

  it('leaves reopened files out of the median: their reviewedAt is the reopening', async () => {
    const $queryRaw = queueReads([]);
    await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues({ role: 'SUPER_ADMIN' });
    const query = paceQuery($queryRaw);
    expect(query.sql).toContain('NOT EXISTS');
    expect(query.sql).toContain(`reopening.action = 'AUDIT_REOPEN'`);
    expect(query.sql).toContain(`reopening."resourceType" = 'OnefopSubmission'`);
  });

  it('returns null, not zero, when nothing waits and nothing was decided', async () => {
    const $queryRaw = queueReads([]);
    const { reviewDelay } = await new EligibilityEngineService({ $queryRaw } as any).getPilotageQueues({ role: 'SUPER_ADMIN' });
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
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
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
    return { id, status, assigneeId: actor.id, updatedAt: new Date('2026-01-01T00:00:00Z'), region: 'Centre', department: 'Mfoundi', anomalies: [], campaignId, companyId, establishmentId };
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
