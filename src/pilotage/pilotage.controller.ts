import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '../types/prisma.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { territoryFromUser } from '../auth/territory';
import { PilotageService } from './pilotage.service';

export const PILOTAGE_WRITE_ROLES = [
  UserRole.CENTRAL,
  UserRole.SUPER_ADMIN,
  UserRole.SUPER_ADMIN_ONEFOP,
] as const;

export const PILOTAGE_READ_ROLES = [
  UserRole.CENTRAL,
  UserRole.SUPER_ADMIN,
  UserRole.SUPER_ADMIN_ONEFOP,
  UserRole.REGIONAL,
  UserRole.DIVISIONAL,
] as const;

@Controller('admin/pilotage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PilotageController {
  constructor(private readonly pilotage: PilotageService) {}

  @Get('targets/inscriptions')
  @Roles(...PILOTAGE_READ_ROLES)
  getInscriptionTargets(@Query('year') year: string, @Req() req: any) {
    return this.pilotage.getInscriptionTargets(territoryFromUser(req.user), year);
  }

  @Put('targets/inscriptions')
  @Roles(...PILOTAGE_WRITE_ROLES)
  putInscriptionTargets(@Query('year') year: string, @Body() body: unknown, @Req() req: any) {
    return this.pilotage.putInscriptionTargets(req.user.id, territoryFromUser(req.user), year, body);
  }

  @Get('campaigns/:id/quotas')
  @Roles(...PILOTAGE_READ_ROLES)
  getCampaignQuotas(@Param('id') id: string, @Req() req: any) {
    return this.pilotage.getCampaignQuotas(territoryFromUser(req.user), id);
  }

  @Put('campaigns/:id/quotas')
  @Roles(...PILOTAGE_WRITE_ROLES)
  putCampaignQuotas(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.pilotage.putCampaignQuotas(req.user.id, territoryFromUser(req.user), id, body);
  }
}
