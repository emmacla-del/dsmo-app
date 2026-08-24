// src/landing-config/admin-landing-config.controller.ts
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LandingConfigDto } from './dto/landing-config.dto';
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
  //
  // Local pipe override: main.ts's global ValidationPipe has
  // skipMissingProperties:true and forbidNonWhitelisted:false, tuned for
  // partial PATCH DTOs elsewhere. This is a full-replace PUT, so it needs
  // the strict opposite. transform:false is kept so @Body() still yields a
  // plain object — Prisma's Json column wants a plain JSON value, not a
  // class instance.
  @Put()
  @UsePipes(new ValidationPipe({
    transform: false,
    whitelist: true,
    forbidNonWhitelisted: true,
    skipMissingProperties: false,
  }))
  async updateConfig(@Body() body: LandingConfigDto, @Req() req: any) {
    return this.landingConfig.updateConfig(body as unknown as Record<string, any>, req.user.id);
  }

  // Last MAX_VERSIONS pre-overwrite snapshots, most recent first — see
  // LandingConfigService.listVersions.
  @Get('history')
  async history() {
    return this.landingConfig.listVersions();
  }

  // Restores a prior snapshot by replaying it through updateConfig, so the
  // restore itself is snapshotted too (undoable, same as any other save).
  @Post('restore/:versionId')
  async restore(@Param('versionId') versionId: string, @Req() req: any) {
    return this.landingConfig.restoreVersion(versionId, req.user.id);
  }
}
