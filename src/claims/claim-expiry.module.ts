import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module';
import { ClaimExpiryScheduler } from './claim-expiry.scheduler';
import { ClaimLapsesController } from './claim-lapses.controller';

/**
 * Releases review claims past their deadline (claim-expiry.scheduler.ts) and
 * reports each officer's own lapses (claim-lapses.controller.ts).
 */
@Module({
  imports: [AuthModule, QuestionnairesModule],
  controllers: [ClaimLapsesController],
  providers: [ClaimExpiryScheduler],
})
export class ClaimExpiryModule {}
