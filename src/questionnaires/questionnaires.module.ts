import { Module } from '@nestjs/common';
import { QuestionnairesController } from './questionnaires.controller';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';

@Module({
  controllers: [QuestionnairesController, AdminQuestionnairesController],
  providers: [
    QuestionnairesService,
    OnefopPuppeteerService,
  ],
  exports: [QuestionnairesService],
})
export class QuestionnairesModule { }