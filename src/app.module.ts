import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DsmoModule } from './dsmo/dsmo.module';
import { PrismaModule } from './prisma/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { SectorsModule } from './sectors/sectors.module';
import { MinefopServicesModule } from './minefop-services/minefop-services.module';
import { QuestionnairesModule } from './questionnaires/questionnaires.module';
import { OnefopAnalyticsModule } from './analytics/onefop-analytics.module';
import { PdfModule } from './pdf/pdf.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OnefopModule } from './onefop/onefop.module';
import { CampaignModule } from './campaign/campaign.module';
import { ReportModule } from './report/report.module';
import { DataManagementModule } from './data-management/data-management.module';

@Module({
  imports: [
    AuthModule,
    DsmoModule,
    PrismaModule,
    LocationsModule,
    SectorsModule,
    MinefopServicesModule,
    QuestionnairesModule,
    OnefopAnalyticsModule,
    PdfModule,
    AnalyticsModule,
    OnefopModule,
    CampaignModule,
    ReportModule,
    DataManagementModule,
  ],
})
export class AppModule { }