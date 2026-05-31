import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportPdfService } from './report-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportController],
  providers: [ReportService, ReportPdfService],
  exports: [ReportService],
})
export class ReportModule { }