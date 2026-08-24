// src/landing-config/public-landing-config.controller.ts
import { Controller, Get } from '@nestjs/common';
import { LandingConfigService } from './landing-config.service';

// No @UseGuards — public/unauthenticated by convention in this app (see
// LocationsController). Consumed by the Flutter landing page's
// landingConfigProvider before login.
@Controller('public/landing-config')
export class PublicLandingConfigController {
  constructor(private readonly landingConfig: LandingConfigService) { }

  @Get()
  async getConfig() {
    return this.landingConfig.getConfig();
  }
}
