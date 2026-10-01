import { Module } from '@nestjs/common';
import { PilotageController } from './pilotage.controller';
import { PilotageService } from './pilotage.service';

@Module({
  controllers: [PilotageController],
  providers: [PilotageService],
})
export class PilotageModule {}
