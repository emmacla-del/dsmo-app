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
} from '@nestjs/common';
import { Response } from 'express';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';
import {
  mapCooperativeData,
  mapEnterpriseData,
  mapCtdData,
  mapOngData,
  diagnoseMappingKeys,
} from '../services/pdf-data-mapper.service';
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('onefop')
export class QuestionnairesController {
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
  async preview(@Body() body: any, @Res() res: Response) {
    try {
      const rawData: Record<string, unknown> = body?.data ?? {};
      const entityType: string = body?.entityType ?? '';

      console.log('📥 Preview request received');
      console.log('   entityType:', entityType);
      console.log('   data keys:', Object.keys(rawData).length);

      // ── STEP 1: Normalize ──────────────────────────────────────
      console.log('🔄 Step 1: Normalizing keys...');
      let normalized: Record<string, unknown>;
      try {
        normalized = normalizeFlatKeys(rawData, entityType);
        console.log('✅ Step 1 done — normalized keys:', Object.keys(normalized).length);
      } catch (e: any) {
        console.error('❌ Step 1 FAILED — normalizeFlatKeys threw:', e.message);
        console.error(e.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Normalization failed', step: 1, message: e.message,
        });
      }

      const relevantKeys = Object.keys(normalized)
        .filter(k => k.startsWith('s3q02') || k.startsWith('s4q02') || k.startsWith('s4q03'));
      console.log('🔑 Reasons/Skills/Training keys:', JSON.stringify(relevantKeys));

      if (process.env.NODE_ENV !== 'production') {
        diagnoseMappingKeys(normalized);
      }

      // ── STEP 2: Map to template data ───────────────────────────
      console.log('🔄 Step 2: Mapping data for entityType:', entityType);
      let mappedData: Record<string, unknown>;
      try {
        switch (entityType) {
          case 'enterprise':
            mappedData = mapEnterpriseData(normalized);
            break;
          case 'cooperative':
            mappedData = mapCooperativeData(normalized);
            break;
          case 'ctd':
            mappedData = mapCtdData(normalized);
            break;
          case 'ong':
            mappedData = mapOngData(normalized);
            break;
          default:
            return res.status(HttpStatus.BAD_REQUEST).json({
              error: `Invalid entity type: "${entityType}"`,
            });
        }
        console.log('✅ Step 2 done — mapped keys:', Object.keys(mappedData).length);
      } catch (e: any) {
        console.error('❌ Step 2 FAILED — data mapping threw:', e.message);
        console.error(e.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Data mapping failed', step: 2, message: e.message,
        });
      }

      // ── STEP 3: Launch browser / generate PDF ─────────────────
      console.log('🔄 Step 3: Generating PDF...');
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfService.generate({
          ...mappedData,
          formType: entityType,
        });
        console.log(`✅ Step 3 done — PDF size: ${pdfBuffer.length} bytes`);
      } catch (e: any) {
        console.error('❌ Step 3 FAILED — PDF generation threw:', e.message);
        console.error('   Full stack:', e.stack);
        // Common Render/Chrome errors
        if (e.message?.includes('Could not find Chrome')) {
          console.error('💡 Hint: Chrome/Chromium not found — set PUPPETEER_EXECUTABLE_PATH');
        }
        if (e.message?.includes('Failed to launch')) {
          console.error('💡 Hint: Browser failed to launch — check sandbox args');
        }
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
      console.error('❌ Unhandled preview error:', error.message);
      console.error('   Stack:', error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate preview',
        message: error.message,
      });
    }
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
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
    console.log('📥 Submit request received');
    console.log('   userId:', req.user?.id);
    console.log('   entityType:', dto?.entityType);
    console.log('   isDraft:', dto?.isDraft);
    console.log('   data keys:', dto?.data ? Object.keys(dto.data).length : 0);

    try {
      const result = await this.service.submitQuestionnaire({
        ...dto,
        userId: req.user.id,
      });
      console.log('✅ Submit successful:', result);
      return result;
    } catch (e: any) {
      console.error('❌ Submit FAILED:', e.message);
      console.error('   Stack:', e.stack);
      throw e; // re-throw so NestJS returns the correct HTTP error
    }
  }
}