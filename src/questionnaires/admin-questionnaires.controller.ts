// src/questionnaires/admin-questionnaires.controller.ts
import {
  Controller,
  Get,
  Post,
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
import { EligibilityEngineService } from './eligibility-engine.service';
import { BulkVisaDto, ResolveAnomalyDto } from '../dto/admin-dossier.dto';

@Controller('admin/questionnaires')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP')
export class AdminQuestionnairesController {
  constructor(
    private readonly service: QuestionnairesService,
    private readonly eligibilityEngine: EligibilityEngineService,
  ) {}

  /**
   * Action-oriented Priority Queues ("Que dois-je traiter aujourd'hui ?")
   */
  @Get('pilotage/queues')
  async getQueues(@Request() req: any) {
    const territory = {
      region: req.user?.region,
      department: req.user?.department,
      regionId: req.user?.regionId,
      departmentId: req.user?.departmentId,
    };
    return this.eligibilityEngine.getPilotageQueues(territory);
  }

  /**
   * Protected Transactional Bulk Visa with Server-side Preflight
   */
  @Post('bulk-visa')
  async bulkVisa(@Body() dto: BulkVisaDto, @Request() req: any) {
    return this.eligibilityEngine.executeBulkVisa(req.user, dto);
  }

  /**
   * Anomalies Registry (Data Quality Axis 2)
   */
  @Get('anomalies/registry')
  async listAnomalies(
    @Query('submissionId') submissionId?: string,
    @Query('status') status?: any,
    @Query('isBlocking') isBlocking?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.eligibilityEngine.listAnomalies({
      submissionId,
      status,
      isBlocking: isBlocking !== undefined ? isBlocking === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * Resolve or waive an anomaly with audit footprint
   */
  @Patch('anomalies/:id/resolve')
  async resolveAnomaly(
    @Param('id') id: string,
    @Body() dto: ResolveAnomalyDto,
    @Request() req: any,
  ) {
    return this.eligibilityEngine.resolveAnomaly(id, req.user, dto);
  }

  @Get()
  async getAll(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    if (status) {
      return this.service.listByStatus(status, limit ?? 100, offset ?? 0);
    }
    return this.service.getAllQuestionnaires();
  }

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

  /**
   * 3-Axis Real-Time Dossier Diagnostic ("Pourquoi ce dossier n'est-il pas prêt ?")
   */
  @Get(':id/diagnostic')
  async getDiagnostic(@Param('id') id: string) {
    return this.eligibilityEngine.evaluateDossier(id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user?.id);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.service.reject(id, reason, req.user?.id);
  }

  @Patch(':id/request-correction')
  async requestCorrection(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @Request() req: any,
  ) {
    return this.service.requestCorrection(id, comments, req.user?.id);
  }
}
