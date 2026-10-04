import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * In-app notification inbox — Phase 3 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * PrismaModule is @Global, so nothing needs importing here. The service is
 * exported because other modules write to the inbox: Phase 4's nudge endpoint
 * lives in ReportModule, and Phase 3-full will notify from AuthModule.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }
