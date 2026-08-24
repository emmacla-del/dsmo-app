// src/landing-config/landing-config.module.ts
import { Module } from '@nestjs/common';
import { PublicLandingConfigController } from './public-landing-config.controller';
import { AdminLandingConfigController } from './admin-landing-config.controller';
import { LandingConfigService } from './landing-config.service';

// Not @Global() — unlike SystemSettingsModule, nothing outside this module
// needs LandingConfigService; both controllers that use it live here.
@Module({
  controllers: [PublicLandingConfigController, AdminLandingConfigController],
  providers: [LandingConfigService],
})
export class LandingConfigModule { }
