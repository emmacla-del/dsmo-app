import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DsmoModule } from '../dsmo/dsmo.module';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';

@Module({
  imports: [PrismaModule, DsmoModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignSchedulerService],
  exports: [CampaignService],
})
export class CampaignModule {}
