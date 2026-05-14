// src/analytics/onefop-analytics.module.ts
import { Module } from '@nestjs/common';
import { OnefopAnalyticsController } from './onefop-analytics.controller';
import { OnefopAnalyticsService } from './onefop-analytics.service';

@Module({
  controllers: [OnefopAnalyticsController],
  providers: [OnefopAnalyticsService],
})
export class OnefopAnalyticsModule { }