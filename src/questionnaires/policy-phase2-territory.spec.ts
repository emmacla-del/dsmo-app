import { NotFoundException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';

function decisionService() {
  const prisma: any = {
    onefopSubmission: {
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  return { prisma, service: new QuestionnairesService(prisma) };
}

async function expectAllDecisionsRefused(service: QuestionnairesService, territory: any) {
  await expect(service.approve('target-in-territory-B', 'actor', territory)).rejects.toThrow(NotFoundException);
  await expect(service.reject('target-in-territory-B', 'Reason long enough', 'actor', territory)).rejects.toThrow(NotFoundException);
  await expect(service.requestCorrection('target-in-territory-B', 'Please correct this file', true, 'actor', territory))
    .rejects.toThrow(NotFoundException);
}

describe('Phase 2 declaration decision territory checks', () => {
  it('P2-20 refuses regional approve/reject/request-correction for a by-id target in another region', async () => {
    const { prisma, service } = decisionService();
    const territory = { role: 'REGIONAL_ADMIN', region: 'Territory A' };
    await expectAllDecisionsRefused(service, territory);
    for (const [query] of prisma.onefopSubmission.findFirst.mock.calls) {
      expect(query.where.AND[1]).toEqual({ region: { equals: 'Territory A', mode: 'insensitive' } });
    }
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('P2-21 refuses divisional approve/reject/request-correction outside region and department', async () => {
    const { prisma, service } = decisionService();
    const territory = { role: 'DIVISIONAL_ADMIN', region: 'Territory A', department: 'Division A' };
    await expectAllDecisionsRefused(service, territory);
    for (const [query] of prisma.onefopSubmission.findFirst.mock.calls) {
      expect(query.where.AND[1]).toEqual({
        region: { equals: 'Territory A', mode: 'insensitive' },
        department: { equals: 'Division A', mode: 'insensitive' },
      });
    }
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('P2-22 cross-territory by-id decisions fail before any write or audit', async () => {
    const { prisma, service } = decisionService();
    await expectAllDecisionsRefused(service, {
      role: 'DIVISIONAL_ADMIN', region: 'Territory A', department: 'Division A',
    });
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
