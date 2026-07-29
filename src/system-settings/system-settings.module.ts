import { Global, Module } from '@nestjs/common';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

// Global: RolesGuard (used across nearly every feature module) injects
// SystemSettingsService to enforce maintenance mode, so it needs to be
// resolvable everywhere without each module importing this one — same
// reasoning as PrismaModule.
@Global()
@Module({
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule { }
