// src/report/report.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DsmoModule } from '../dsmo/dsmo.module';
import { ReportController } from './report.controller';
import { AuditController } from './audit.controller';
import { DistributionController } from './distribution.controller';
import { ReportService } from './report.service';
import { ReportPdfService } from './report-pdf.service';
import { OnefopAnalyticsService } from '../analytics/onefop-analytics.service';

@Module({
  imports: [PrismaModule, DsmoModule],
  controllers: [ReportController, AuditController, DistributionController],
  providers: [
    ReportService,
    ReportPdfService,
    // Required so ReportService can inject OnefopAnalyticsService.
    // This ensures reports use the same correct flat-key aggregation
    // (BUG-3 fix) as the live analytics screen, and the numbers in
    // the frozen snapshot match what analysts see on the dashboard.
    OnefopAnalyticsService,
  ],
  exports: [ReportService],
})
export class ReportModule { }