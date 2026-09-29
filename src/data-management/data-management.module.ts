import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionnairesModule } from '../questionnaires/questionnaires.module';
import { OnefopSchemaValidationModule } from '../onefop-schema-validation/onefop-schema-validation.module';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';
import { CanonicalSchemaAdapterService } from './canonical-schema-adapter.service';

@Module({
  imports: [PrismaModule, QuestionnairesModule, OnefopSchemaValidationModule],
  controllers: [DataManagementController],
  providers: [DataManagementService, CanonicalSchemaAdapterService],
  exports: [DataManagementService, CanonicalSchemaAdapterService],
})
export class DataManagementModule { }

