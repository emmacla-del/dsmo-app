// src/report/report.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DsmoModule } from '../dsmo/dsmo.module';
import { ReportController } from './report.controller';
import { AuditController } from './audit.controller';
import { DistributionController } from './distribution.controller';
import { ReportService } from './report.service';
import { ReportPdfService } from './report-pdf.service';
import { ActorSummaryService } from './actor-summary.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PilotageService } from '../pilotage/pilotage.service';
import { OnefopAnalyticsService } from '../analytics/onefop-analytics.service';

@Module({
  imports: [PrismaModule, DsmoModule, NotificationsModule],
  controllers: [ReportController, AuditController, DistributionController],
  providers: [
    ReportService,
    ReportPdfService,
    ActorSummaryService,
    // Phase 4 reuses getCoverage so the dashboard's coverage figures are the
    // /admin/cibles figures. PilotageModule does not export the service, and it
    // depends only on the global PrismaService, so it is provided here.
    PilotageService,
    // Required so ReportService can inject OnefopAnalyticsService.
    // This ensures reports use the same correct flat-key aggregation
    // (BUG-3 fix) as the live analytics screen, and the numbers in
    // the frozen snapshot match what analysts see on the dashboard.
    OnefopAnalyticsService,
  ],
  exports: [ReportService],
})
export class ReportModule { }