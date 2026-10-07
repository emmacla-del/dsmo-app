import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../types/prisma.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { territoryFromUser } from '../auth/territory';
import { PilotageService } from './pilotage.service';
import { parseYear } from './pilotage-validation';

export const PILOTAGE_WRITE_ROLES = [
  UserRole.ADMIN_ONEFOP,
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_ONEFOP,
] as const;

export const PILOTAGE_READ_ROLES = [
  UserRole.ADMIN_ONEFOP,
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_ONEFOP,
  UserRole.REGIONAL_ADMIN,
  UserRole.DIVISIONAL_ADMIN,
  UserRole.CENTRAL_AGENT,
] as const;

@Controller('admin/pilotage')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class PilotageController {
  constructor(private readonly pilotage: PilotageService) {}

  /**
   * RETIRED (Phase 4b). The year-scoped inscription target is replaced by the
   * per-campaign quota, and the coverage roll-ups added in 4a cover the
   * reading side. The route and its @Roles gate stay for one release so an
   * authorized caller gets 410 rather than 404, and an unauthorized one still
   * gets 403 — the retirement does not widen what the path discloses.
   *
   * PilotageService.getInscriptionTargets went with Phase 6a. TerritoryTarget
   * and CentralInscriptionTarget themselves were dropped in 6b.
   */
  @Get('targets/inscriptions')
  @Roles(...PILOTAGE_READ_ROLES)
  getInscriptionTargets() {
    throw new GoneException(
      "Les objectifs d'inscription annuels sont retirés. Utilisez GET /admin/pilotage/coverage/annual ou GET /admin/pilotage/campaigns/:id/quotas.",
    );
  }

  /**
   * RETIRED (Phase 4c). The bare path meant "annual" by convention; the fold
   * it served is now reached by its own name at coverage/annual, added in 4a
   * with the same response shape. Path and @Roles gate stay for one release,
   * on the same terms as the 4b retirements above: an authorized caller gets
   * 410, an unauthorized one still gets 403.
   *
   * PilotageService.getCoverage is untouched — it IS the annual fold, and
   * getAnnualCoverage below still calls it.
   */
  @Get('coverage')
  @Roles(...PILOTAGE_READ_ROLES)
  getCoverage() {
    throw new GoneException(
      'La couverture annuelle a désormais sa propre route. Utilisez GET /admin/pilotage/coverage/annual?year=YYYY.',
    );
  }

  /**
   * SEMESTER coverage roll-up: Q1+Q2 or Q3+Q4 of the requested year.
   *
   * The year is parsed here rather than in the service, because
   * getSemesterCoverage takes an already-parsed number while getCoverage
   * parses its own raw value. It is the service's own parseYear, so both
   * routes reject the same years with the same message.
   */
  @Get('coverage/semester')
  @Roles(...PILOTAGE_READ_ROLES)
  getSemesterCoverage(
    @Query('year') year: string,
    @Query('semester') semester: string,
    @Req() req: any,
  ) {
    return this.pilotage.getSemesterCoverage(
      territoryFromUser(req.user),
      parseYear(year),
      parseSemester(semester),
    );
  }

  /**
   * ANNUAL coverage roll-up — the same handler body as GET coverage, under an
   * explicit path so a client can name the period it wants instead of relying
   * on the bare route meaning "annual".
   */
  @Get('coverage/annual')
  @Roles(...PILOTAGE_READ_ROLES)
  getAnnualCoverage(@Query('year') year: string, @Req() req: any) {
    return this.pilotage.getCoverage(territoryFromUser(req.user), year);
  }

  /** RETIRED (Phase 4b), on the same terms as the GET above. */
  @Put('targets/inscriptions')
  @Roles(...PILOTAGE_WRITE_ROLES)
  putInscriptionTargets() {
    throw new GoneException(
      "Les objectifs d'inscription annuels sont retirés. Utilisez PUT /admin/pilotage/campaigns/:id/quotas.",
    );
  }

  @Get('campaigns/:id/quotas')
  @Roles(...PILOTAGE_READ_ROLES)
  getCampaignQuotas(@Param('id') id: string, @Req() req: any) {
    return this.pilotage.getCampaignQuotas(territoryFromUser(req.user), id);
  }

  @Get('campaigns/:id/returns')
  @Roles(...PILOTAGE_READ_ROLES)
  getCampaignReturns(@Param('id') id: string, @Req() req: any) {
    return this.pilotage.getCampaignReturns(territoryFromUser(req.user), id);
  }

  @Put('campaigns/:id/quotas')
  @Roles(...PILOTAGE_WRITE_ROLES)
  putCampaignQuotas(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.pilotage.putCampaignQuotas(req.user.id, territoryFromUser(req.user), id, body);
  }
}

/**
 * The « semester » query parameter: 1 or 2, nothing else.
 *
 * Validated at the boundary because getSemesterCoverage takes a number it
 * trusts. The service's semesterQuarters raises on a bad value too — this is
 * the outer guard, not a replacement for it, and the wording is kept in the
 * same register so either message reads the same to a client.
 */
function parseSemester(raw: unknown): number {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    throw new BadRequestException('Le paramètre « semester » est obligatoire.');
  }
  const text = String(raw).trim();
  if (text !== '1' && text !== '2') {
    throw new BadRequestException('Le paramètre « semester » doit valoir 1 ou 2.');
  }
  return Number(text);
}
