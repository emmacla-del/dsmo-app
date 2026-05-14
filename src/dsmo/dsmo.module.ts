import { Module } from '@nestjs/common';
import { DsmoController } from './dsmo.controller';
import { AnalyticsController } from './analytics.controller'; // ✅ import
import { DsmoService } from './dsmo.service';
import { PdfService } from './pdf.service';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [DsmoController, AnalyticsController], // ✅ added
  providers: [DsmoService, PdfService, ValidationService, AuditService, NotificationService, AnalyticsService],
  exports: [DsmoService, ValidationService, AuditService, NotificationService, AnalyticsService],
})
export class DsmoModule { }