// src/questionnaires/admin-questionnaires.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuestionnairesService } from './questionnaires.service';

@Controller('admin/questionnaires')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
export class AdminQuestionnairesController {
  constructor(private readonly service: QuestionnairesService) { }

  @Get('pending')
  async getPending(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.listByStatus('PENDING_REVIEW', limit ?? 100, offset ?? 0);
  }

  @Get('correction-requested')
  async getCorrectionRequested(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.listByStatus('CORRECTION_REQUESTED', limit ?? 100, offset ?? 0);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user?.sub);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.service.reject(id, reason, req.user?.sub);
  }

  @Patch(':id/request-correction')
  async requestCorrection(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @Request() req: any,
  ) {
    return this.service.requestCorrection(id, comments, req.user?.sub);
  }
}
