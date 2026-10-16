// questionnaires.controller.ts
import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';
import {
  mapCooperativeData,
  mapEnterpriseData,
  mapCtdData,
  mapOngData,
  mapAdministrationData,
  mapProjectProgramData,
  mapVocationalTrainingData,
} from '../services/pdf-data-mapper.service';
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';

// Normalize any casing Flutter or web sends → internal key used for mapping and preview
function normalizeEntityTypeForPreview(raw: string): string {
  const map: Record<string, string> = {
    entreprise: 'enterprise',
    enterprise: 'enterprise',
    cooperative: 'cooperative',
    coopérative: 'cooperative',
    ctd: 'ctd',
    ong: 'ong',
    ngo: 'ong',
    administration: 'administration',
    project_program: 'projectProgram',
    projectprogram: 'projectProgram',
    project: 'projectProgram',
    projectProgram: 'projectProgram',
    vocational_training: 'vocationalTraining',
    vocationaltraining: 'vocationalTraining',
    vocationalTraining: 'vocationalTraining',
    vt: 'vocationalTraining',
    vtc: 'vocationalTraining',
  };
  const key = raw?.trim();
  return map[key] ?? map[key?.toLowerCase()] ?? raw?.toLowerCase()?.trim() ?? '';
}

@Controller('onefop')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class QuestionnairesController {
  // Logs carry ids and counts only — never a value the respondent typed,
  // nor a name, phone number or email (defect 9, 2026-10-15 VT run).
  private readonly logger = new Logger(QuestionnairesController.name);

  constructor(
    private readonly service: QuestionnairesService,
    private readonly pdfService: OnefopPuppeteerService,
  ) { }

  @Post('preview')
  @UsePipes(
    new ValidationPipe({
      transform: false,
      skipMissingProperties: true,
      skipUndefinedProperties: true,
      skipNullProperties: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  )
  async preview(@Body() body: any, @Res() res: Response, @Req() req?: any) {
    try {
      const rawData: Record<string, unknown> = body?.data ?? {};
      const entityType: string = normalizeEntityTypeForPreview(body?.entityType);
      // The campaign quarter this preview is for — drives surveyYear (see
      // pdf-data-mapper.service.ts's surveyYearFromQuarterCode) so the PDF
      // prints the reporting period's own year, not today's.
      const quarterCode: string | undefined = body?.quarterCode;
      const rawLocale = body?.lang || body?.data?.lang || body?.locale || body?.data?.locale || (req?.query?.lang as string) || (req?.query?.locale as string) || req?.headers?.['accept-language'];
      const locale: 'fr' | 'en' = (typeof rawLocale === 'string' && rawLocale.toLowerCase().startsWith('en')) ? 'en' : 'fr';

      // ── STEP 1: Normalize ──────────────────────────────────────
      let normalized: Record<string, unknown>;
      try {
        normalized = normalizeFlatKeys(rawData, entityType);
      } catch (e: any) {
        this.logger.error(`Preview (${entityType}) step 1, key normalization failed: ${e.message}`, e.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Normalization failed', step: 1, message: e.message,
        });
      }

      // ── STEP 2: Map to template data ───────────────────────────
      let mappedData: Record<string, unknown>;
      try {
        switch (entityType) {
          case 'enterprise':
            mappedData = mapEnterpriseData(normalized, quarterCode, locale);
            break;
          case 'cooperative':
            mappedData = mapCooperativeData(normalized, quarterCode, locale);
            break;
          case 'ctd':
            mappedData = mapCtdData(normalized, quarterCode, locale);
            break;
          case 'ong':
            mappedData = mapOngData(normalized, quarterCode, locale);
            break;
          case 'administration':
            mappedData = mapAdministrationData(normalized, quarterCode, locale);
            break;
          case 'projectProgram':
            mappedData = mapProjectProgramData(normalized, quarterCode, locale);
            break;
          case 'vocationalTraining':
            mappedData = mapVocationalTrainingData(normalized, quarterCode, locale);
            break;
          default:
            this.logger.warn(`Preview rejected: unknown entity type "${entityType}"`);
            return res.status(HttpStatus.BAD_REQUEST).json({
              error: `Invalid entity type: "${body?.entityType}" (normalized: "${entityType}")`,
            });
        }
      } catch (e: any) {
        this.logger.error(`Preview (${entityType}) step 2, data mapping failed: ${e.message}`, e.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Data mapping failed', step: 2, message: e.message,
        });
      }

      // ── STEP 3: Render preview (HTML or PDF) ─────────────────
      const requestedFormat = (body?.format || req?.query?.format || '').toString().toLowerCase();
      const wantsHtml = requestedFormat === 'html';

      if (wantsHtml) {
        try {
          const html = this.pdfService.renderHtml({
            ...mappedData,
            formType: entityType,
            locale,
            lang: locale,
          });
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        } catch (e: any) {
          this.logger.error(`Preview (${entityType}) step 3, HTML render failed: ${e.message}`, e.stack);
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'HTML preview rendering failed', step: 3, message: e.message,
          });
        }
      }

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfService.generate({
          ...mappedData,
          formType: entityType,
          locale,
          lang: locale,
        });
      } catch (e: any) {
        this.logger.error(`Preview (${entityType}) step 3, PDF generation failed: ${e.message}`, e.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'PDF generation failed', step: 3, message: e.message,
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

    } catch (err) {
      const error = err as Error;
      this.logger.error(`Preview failed: ${error.message}`, error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate preview',
        message: error.message,
      });
    }
  }

  @Post('submit')
  @Roles('COMPANY')
  @UsePipes(
    new ValidationPipe({
      transform: false,
      skipMissingProperties: true,
      skipUndefinedProperties: true,
      skipNullProperties: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  )
  async submit(@Body() dto: any, @Req() req: any) {
    const kind = `${dto?.entityType} ${dto?.isDraft ? 'draft' : 'final'}`;
    try {
      const result = await this.service.submitQuestionnaire({
        ...dto,
        userId: req.user.id,
      });
      this.logger.log(`Submission ${result?.submissionId} saved (${kind}, user ${req.user.id})`);
      return result;
    } catch (e: any) {
      this.logger.warn(`Submission refused (${kind}, user ${req.user?.id}): ${e.message}`);
      throw e;
    }
  }
}