// src/system-settings/system-settings.controller.ts
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SystemSettingsService, SystemSettingsUpdate } from './system-settings.service';

@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SystemSettingsController {
  constructor(private readonly systemSettings: SystemSettingsService) { }

  @Get()
  async getSettings() {
    return this.systemSettings.getSettings();
  }

  @Patch()
  async updateSettings(@Body() body: SystemSettingsUpdate, @Req() req: any) {
    return this.systemSettings.updateSettings(body, req.user.id);
  }
}
