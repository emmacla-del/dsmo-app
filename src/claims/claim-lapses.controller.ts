import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { REGISTRATION_ADMIN_ROLES, SURVEY_ADMIN_ROLES } from '../auth/staff-scope';
import { PrismaService } from '../prisma/prisma.service';
import { OWN_LAPSE_WINDOW_DAYS, countClaimLapses } from './claim-lapses';

/** Every role that can hold a claim, on a registration or a submission. */
const CLAIM_HOLDER_ROLES = [...new Set<string>([...REGISTRATION_ADMIN_ROLES, ...SURVEY_ADMIN_ROLES])];

@Controller('claims')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class ClaimLapsesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's own lapsed claims over the last 30 days. Always the caller:
   * no parameter names another officer (supervisors read the team page).
   */
  @Get('lapses/me')
  @Roles(...CLAIM_HOLDER_ROLES)
  async ownLapses(@Request() req: { user: { id: string } }) {
    const until = new Date();
    const since = new Date(until.getTime() - OWN_LAPSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const counts = await countClaimLapses(this.prisma as any, [req.user.id], since, until);
    const own = counts.get(req.user.id) ?? { registrations: 0, submissions: 0 };
    return { since: since.toISOString(), until: until.toISOString(), days: OWN_LAPSE_WINDOW_DAYS, ...own };
  }
}
