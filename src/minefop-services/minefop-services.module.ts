// src/minefop-services/minefop-services.module.ts
import { Module } from '@nestjs/common';
import { MinefopServicesController } from './minefop-services.controller';
import { MinefopServicesService } from './minefop-services.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [MinefopServicesController],
    providers: [MinefopServicesService],
    exports: [MinefopServicesService],
})
export class MinefopServicesModule { }