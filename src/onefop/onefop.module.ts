// src/onefop/onefop.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnefopController } from './onefop.controller';
import { OnefopService } from './onefop.service';
import { SubmissionRoundsController } from './submission-rounds.controller';
import { SubmissionRoundsService } from './submission-rounds.service';

@Module({
    imports: [PrismaModule],
    controllers: [OnefopController, SubmissionRoundsController],
    providers: [OnefopService, SubmissionRoundsService],
    exports: [OnefopService, SubmissionRoundsService],
})
export class OnefopModule { }