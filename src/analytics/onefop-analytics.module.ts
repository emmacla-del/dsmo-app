// analytics/onefop-analytics.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { OnefopAnalyticsController } from './onefop-analytics.controller';
import { AnalyticsQueryService } from './core/analytics-query.service';
import { EmploymentAnalyticsService } from './domain/employment.analytics.service';
import { RecruitmentAnalyticsService } from './domain/recruitment.analytics.service';
import { MobilityAnalyticsService } from './domain/mobility.analytics.service';
import { InclusionAnalyticsService } from './domain/inclusion.analytics.service';
import { SkillsAnalyticsService } from './domain/skills.analytics.service';
import { EducationAnalyticsService } from './domain/education.analytics.service';  // ← FIXED: import from correct file
import { EnterpriseProfileAnalyticsService } from './domain/enterprise-profile.analytics.service';  // ← ADD THIS
import { JobApplicationsAnalyticsService } from './domain/job-applications.analytics.service';  // ← ADD THIS
import { OnefopAnalyticsFacade } from './facade/onefop-analytics.facade';


const DOMAIN_SERVICES = [
  EmploymentAnalyticsService,
  RecruitmentAnalyticsService,
  MobilityAnalyticsService,
  InclusionAnalyticsService,
  SkillsAnalyticsService,
  EducationAnalyticsService,
  EnterpriseProfileAnalyticsService,    // ← ADD THIS
  JobApplicationsAnalyticsService,       // ← ADD THIS
];

@Module({
  imports: [PrismaModule],
  controllers: [OnefopAnalyticsController],
  providers: [
    AnalyticsQueryService,
    ...DOMAIN_SERVICES,
    OnefopAnalyticsFacade,
  ],
  exports: [
    OnefopAnalyticsFacade,
  ],
})
export class OnefopAnalyticsModule { }