import { Module } from '@nestjs/common';
import { QuestionnairesController } from './questionnaires.controller';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';
import { OnefopSchemaValidationModule } from '../onefop-schema-validation/onefop-schema-validation.module';

import { EligibilityEngineService } from './eligibility-engine.service';

@Module({
  imports: [OnefopSchemaValidationModule],
  controllers: [QuestionnairesController, AdminQuestionnairesController],
  providers: [
    QuestionnairesService,
    EligibilityEngineService,
    OnefopPuppeteerService,
  ],
  exports: [QuestionnairesService, EligibilityEngineService],
})
export class QuestionnairesModule { }