// analytics/onefop-analytics.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { AnalyticsQueryService } from './core/analytics-query.service';
import { EmploymentAnalyticsService } from './domain/employment.analytics.service';
import { RecruitmentAnalyticsService } from './domain/recruitment.analytics.service';
import { MobilityAnalyticsService } from './domain/mobility.analytics.service';
import { InclusionAnalyticsService } from './domain/inclusion.analytics.service';
import { SkillsAnalyticsService } from './domain/skills.analytics.service';
import { EducationAnalyticsService } from './domain/enterprise-profile.analytics.service';
import { OnefopAnalyticsFacade } from './facade/onefop-analytics.facade';

const DOMAIN_SERVICES = [
  EmploymentAnalyticsService,
  RecruitmentAnalyticsService,
  MobilityAnalyticsService,
  InclusionAnalyticsService,
  SkillsAnalyticsService,
  EducationAnalyticsService,
];

@Module({
  imports: [PrismaModule],
  providers: [
    AnalyticsQueryService,
    ...DOMAIN_SERVICES,
    OnefopAnalyticsFacade,
  ],
  exports: [
    OnefopAnalyticsFacade,
    // Export domain services only if other modules need targeted access.
    // For most cases the facade is sufficient.
  ],
})
export class OnefopAnalyticsModule { }