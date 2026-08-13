import { ForbiddenException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';

// Mirrors exactly what JwtStrategy.validate() puts on req.user in
// production — { id, email, role, region, department }. No `sub`, no
// `features`. Using anything else here would let this test pass while the
// real request path (through Passport) still 403s.
function realUserShapedReq(userId: string) {
  return {
    user: {
      id: userId,
      email: 'company@example.com',
      role: 'COMPANY',
      region: 'Centre',
      department: 'Mfoundi',
    },
  } as any;
}

function buildController(opts: {
  companyId: string | null;
  submissions: Array<{ status: string; surveyYear: number; submissionDate: Date }>;
}) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue(opts.companyId ? { id: opts.companyId } : null),
    },
    onefopSubmission: {
      findMany: jest.fn().mockResolvedValue(opts.submissions),
    },
  } as any;

  const analyticsService = {
    getCompanyBenchmarks: jest.fn().mockResolvedValue({ available: true }),
  } as any;

  const controller = new AnalyticsController(analyticsService, prisma);
  return { controller, prisma, analyticsService };
}

describe('AnalyticsController — company-scoped endpoints', () => {
  describe('getCompanyBenchmarks', () => {
    it('succeeds for a company with an APPROVED ONEFOP submission', async () => {
      const { controller, analyticsService } = buildController({
        companyId: 'company-1',
        submissions: [
          { status: 'APPROVED', surveyYear: 2026, submissionDate: new Date('2026-01-01') },
        ],
      });

      const result = await controller.getCompanyBenchmarks(
        2026,
        'sector',
        realUserShapedReq('user-1'),
      );

      expect(result).toEqual({ available: true });
      expect(analyticsService.getCompanyBenchmarks).toHaveBeenCalledWith('company-1', 2026, 'sector');
    });

    it('also succeeds when the ONEFOP submission is merely PENDING_REVIEW — benchmarking now unlocks on submission, not full approval', async () => {
      const { controller, analyticsService } = buildController({
        companyId: 'company-1',
        submissions: [
          { status: 'PENDING_REVIEW', surveyYear: 2026, submissionDate: new Date('2026-01-01') },
        ],
      });

      const result = await controller.getCompanyBenchmarks(
        2026,
        'sector',
        realUserShapedReq('user-1'),
      );

      expect(result).toEqual({ available: true });
      expect(analyticsService.getCompanyBenchmarks).toHaveBeenCalledWith('company-1', 2026, 'sector');
    });

    it('throws ForbiddenException (403) for a company with no ONEFOP submission at all', async () => {
      const { controller, analyticsService } = buildController({
        companyId: 'company-1',
        submissions: [],
      });

      await expect(
        controller.getCompanyBenchmarks(2026, 'sector', realUserShapedReq('user-1')),
      ).rejects.toThrow(ForbiddenException);
      expect(analyticsService.getCompanyBenchmarks).not.toHaveBeenCalled();
    });

    it('never reads req.user.sub or req.user.features — resolves the user via req.user.id', async () => {
      const { controller, prisma } = buildController({
        companyId: 'company-1',
        submissions: [
          { status: 'APPROVED', surveyYear: 2026, submissionDate: new Date('2026-01-01') },
        ],
      });

      await controller.getCompanyBenchmarks(2026, 'sector', realUserShapedReq('user-1'));

      expect(prisma.company.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
