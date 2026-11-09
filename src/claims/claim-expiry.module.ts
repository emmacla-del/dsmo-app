import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module';
import { ClaimExpiryScheduler } from './claim-expiry.scheduler';

/** Releases review claims past their deadline (claim-expiry.scheduler.ts). */
@Module({
  imports: [AuthModule, QuestionnairesModule],
  providers: [ClaimExpiryScheduler],
})
export class ClaimExpiryModule {}
