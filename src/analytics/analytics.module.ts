import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BilanController } from './bilan.controller';
import { BilanService } from './bilan.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AnalyticsController, BilanController],
    providers: [AnalyticsService, BilanService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }