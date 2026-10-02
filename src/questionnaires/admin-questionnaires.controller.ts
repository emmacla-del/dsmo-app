// src/questionnaires/admin-questionnaires.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { QuestionnairesService } from './questionnaires.service';
import { EligibilityEngineService } from './eligibility-engine.service';
import { BulkVisaDto, BulkRejectDto, ResolveAnomalyDto } from '../dto/admin-dossier.dto';
import { territoryFromUser } from '../auth/territory';
import { ADMIN_LIST_FORM_TYPES, ADMIN_LIST_PERIODS, ADMIN_LIST_STATUSES, AdminListPeriod } from './admin-list-filter';

const LIST_MAX_LIMIT = 100;
const SEARCH_MAX_LENGTH = 100;

// Query params arrive as strings (the global ValidationPipe runs with
// transform: false), and Prisma rejects a string `take`/`skip`. Parse here and
// answer a clear 400 rather than letting Prisma fail with a 500.
function parseIntParam(raw: unknown, fallback: number, min: number, max: number, message: string): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new BadRequestException(message);
  const value = Number(text);
  if (value < min || value > max) throw new BadRequestException(message);
  return value;
}

function optionalText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().slice(0, SEARCH_MAX_LENGTH);
  return text || undefined;
}

@Controller('admin/questionnaires')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
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
    const territory = territoryFromUser(req.user);
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
   * Protected Transactional Bulk Reject
   */
  @Post('bulk-reject')
  async bulkReject(@Body() dto: BulkRejectDto, @Request() req: any) {
    return this.eligibilityEngine.executeBulkReject(req.user, dto);
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
    @Request() req?: any,
  ) {
    return this.eligibilityEngine.listAnomalies({
      submissionId,
      status,
      isBlocking: isBlocking !== undefined ? isBlocking === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    }, territoryFromUser(req?.user));
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

  /**
   * Paginated dossier list: { items, total }. `total` counts the filtered
   * query (territory + status + type + region + period + search, drafts
   * excluded), not the whole table.
   */
  @Get()
  async getAll(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('region') region?: string,
    @Query('search') search?: string,
    @Query('formType') formType?: string,
    @Query('period') period?: string,
    @Request() req?: any,
  ) {
    // DRAFT is not in ADMIN_LIST_STATUSES: drafts are never listed.
    const statusFilter = optionalText(status);
    if (statusFilter && !ADMIN_LIST_STATUSES.includes(statusFilter)) {
      throw new BadRequestException('Statut de dossier inconnu.');
    }
    const typeFilter = optionalText(formType);
    if (typeFilter && !ADMIN_LIST_FORM_TYPES.includes(typeFilter)) {
      throw new BadRequestException('Type de questionnaire inconnu.');
    }
    const periodFilter = optionalText(period);
    if (periodFilter && !(ADMIN_LIST_PERIODS as readonly string[]).includes(periodFilter)) {
      throw new BadRequestException('Période inconnue.');
    }
    return this.service.listForAdmin(
      {
        status: statusFilter,
        formType: typeFilter,
        period: periodFilter as AdminListPeriod | undefined,
        region: optionalText(region),
        search: optionalText(search),
        limit: parseIntParam(limit, LIST_MAX_LIMIT, 1, LIST_MAX_LIMIT,
          `Le paramètre « limit » doit être un entier entre 1 et ${LIST_MAX_LIMIT}.`),
        offset: parseIntParam(offset, 0, 0, Number.MAX_SAFE_INTEGER,
          'Le paramètre « offset » doit être un entier positif ou nul.'),
      },
      territoryFromUser(req?.user),
    );
  }

  @Get('pending')
  async getPending(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    return this.service.listByStatus('PENDING_REVIEW', limit ?? 100, offset ?? 0, territoryFromUser(req?.user));
  }

  @Get('correction-requested')
  async getCorrectionRequested(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    return this.service.listByStatus('CORRECTION_REQUESTED', limit ?? 100, offset ?? 0, territoryFromUser(req?.user));
  }

  /**
   * Stream the current filtered list as CSV or Excel.
   * Must appear before :id routes so the literal "export" is not matched as an id.
   */
  @Get('export')
  async exportDossiers(
    @Query('format') format: string,
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('search') search?: string,
    @Query('formType') formType?: string,
    @Query('period') period?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const exportFormat: 'csv' | 'xlsx' = format === 'xlsx' ? 'xlsx' : 'csv';
    const statusFilter = optionalText(status);
    if (statusFilter && !ADMIN_LIST_STATUSES.includes(statusFilter)) {
      throw new BadRequestException('Statut de dossier inconnu.');
    }
    const typeFilter = optionalText(formType);
    if (typeFilter && !ADMIN_LIST_FORM_TYPES.includes(typeFilter)) {
      throw new BadRequestException('Type de questionnaire inconnu.');
    }
    const periodFilter = optionalText(period);
    if (periodFilter && !(ADMIN_LIST_PERIODS as readonly string[]).includes(periodFilter)) {
      throw new BadRequestException('Période inconnue.');
    }
    await this.service.streamDossiersExport(
      {
        status: statusFilter,
        formType: typeFilter,
        period: periodFilter as AdminListPeriod | undefined,
        region: optionalText(region),
        search: optionalText(search),
      },
      exportFormat,
      territoryFromUser(req?.user),
      req?.user?.id,
      res!,
    );
  }

  /**
   * 3-Axis Real-Time Dossier Diagnostic ("Pourquoi ce dossier n'est-il pas prêt ?")
   */
  @Get(':id/diagnostic')
  async getDiagnostic(@Param('id') id: string, @Request() req: any) {
    return this.eligibilityEngine.evaluateDossier(id, territoryFromUser(req.user));
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.service.getById(id, territoryFromUser(req.user));
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user?.id, territoryFromUser(req.user));
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('certified') certified: boolean,
    @Request() req: any,
  ) {
    if (certified !== true) {
      throw new BadRequestException('Vous devez certifier la décision de rejet avant de confirmer.');
    }
    return this.service.reject(id, reason, req.user?.id, territoryFromUser(req.user));
  }

  @Patch(':id/request-correction')
  async requestCorrection(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @Body('certified') certified: boolean,
    @Request() req: any,
  ) {
    return this.service.requestCorrection(id, comments, certified, req.user?.id, territoryFromUser(req.user));
  }
}
