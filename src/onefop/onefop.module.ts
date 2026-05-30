// src/onefop/onefop.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnefopController } from './onefop.controller';
import { OnefopService } from './onefop.service';

@Module({
    imports: [PrismaModule],
    controllers: [OnefopController],
    providers: [OnefopService],
    exports: [OnefopService],
})
export class OnefopModule { }