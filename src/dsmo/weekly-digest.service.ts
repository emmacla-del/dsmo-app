import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { DsmoService } from './dsmo.service';
import { UserRole } from '../types/prisma.types';

type DigestUser = {
  id: string;
  email: string;
  role: UserRole;
  region: string | null;
  department: string | null;
};

@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private dsmoService: DsmoService,
  ) {}

  // Monday 7am — matches the "chaque lundi matin" copy on the settings screen.
  @Cron('0 7 * * 1')
  async sendWeeklyDigests() {
    const users = await this.prisma.user.findMany({
      where: { weeklyDigestEnabled: true, isActive: true },
      select: { id: true, email: true, role: true, region: true, department: true },
    });

    let sent = 0;
    let failed = 0;
    for (const user of users) {
      try {
        const summary = await this.buildSummary(user);
        if (!summary) continue;
        await this.notificationService.sendWeeklyDigestEmail(user.email, summary);
        sent++;
      } catch (error) {
        failed++;
        this.logger.warn(
          `Failed to send weekly digest to ${user.email}: ${(error as Error).message}`,
        );
      }
    }
    this.logger.log(`Weekly digest run complete: ${sent} sent, ${failed} failed.`);
    return { sent, failed };
  }

  private async buildSummary(
    user: DigestUser,
  ): Promise<{ newThisWeek: number; pending: number; approved?: number } | null> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (user.role === UserRole.COMPANY) {
      const company = await this.prisma.company.findUnique({ where: { userId: user.id } });
      if (!company) return null;

      const [newThisWeek, pending, approved] = await Promise.all([
        this.prisma.declaration.count({
          where: { companyId: company.id, createdAt: { gte: since } },
        }),
        this.prisma.declaration.count({
          where: {
            companyId: company.id,
            status: { in: ['SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED'] },
          },
        }),
        this.prisma.declaration.count({
          where: { companyId: company.id, status: 'FINAL_APPROVED' },
        }),
      ]);
      return { newThisWeek, pending, approved };
    }

    const STAFF_ROLES: UserRole[] = [
      UserRole.DIVISIONAL,
      UserRole.REGIONAL,
      UserRole.CENTRAL,
      UserRole.SUPER_ADMIN,
      UserRole.SUPER_ADMIN_DSMO,
      UserRole.SUPER_ADMIN_ONEFOP,
    ];
    if (!STAFF_ROLES.includes(user.role)) return null;

    const region = user.role === UserRole.REGIONAL ? user.region ?? undefined : undefined;
    const department = user.role === UserRole.DIVISIONAL ? user.department ?? undefined : undefined;

    const where: any = {};
    if (region) where.region = region;
    if (department) where.division = department;

    const [newThisWeek, stats] = await Promise.all([
      this.prisma.declaration.count({ where: { ...where, createdAt: { gte: since } } }),
      this.dsmoService.getDeclarationStats(new Date().getFullYear(), region, department),
    ]);

    return { newThisWeek, pending: stats.submitted };
  }
}
