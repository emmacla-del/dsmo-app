// src/landing-config/admin-landing-config.controller.ts
import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LandingConfigService } from './landing-config.service';

@Controller('admin/landing-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminLandingConfigController {
  constructor(private readonly landingConfig: LandingConfigService) { }

  // PUT, not PATCH: the admin form always submits the whole config as one
  // object (all 4 roadmap items included), so this always replaces the
  // full resource rather than patching individual fields — unlike
  // SystemSettingsController's PATCH, which updates named scalar fields.
  @Put()
  async updateConfig(@Body() body: Record<string, any>, @Req() req: any) {
    return this.landingConfig.updateConfig(body, req.user.id);
  }
}
