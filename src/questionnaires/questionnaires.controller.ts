// questionnaires.controller.ts
//
// CHANGE from previous version (one line added, one line changed):
//
//   BEFORE  mappedData = mapCooperativeData(rawData);   ← raw Flutter keys
//   AFTER   const normalized = normalizeFlatKeys(rawData, entityType);
//           mappedData = mapCooperativeData(normalized); ← registry keys
//
// That single normalization call is the only diff. The pdf-data-mapper already
// reads registry keys (S0Q01, COOP_S1Q01, s21q01_*, …) so it needs no changes.
//
// WHY the service still calls normalizeFlatKeys() internally:
//   questionnairesService.submitQuestionnaire() normalises independently because
//   it receives the raw DTO directly (not the already-normalised object). The two
//   calls are on different code paths and both are pure / idempotent — running
//   normalizeFlatKeys() on already-normalised keys is a safe no-op.

import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  UsePipes,
  ValidationPipe,
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
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer'; // ← NEW

@Controller('onefop')
export class QuestionnairesController {
  constructor(
    private readonly service: QuestionnairesService,
    private readonly pdfService: OnefopPuppeteerService,
  ) { }

  // ── PREVIEW ────────────────────────────────────────────────────────────────
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

      // ── STEP 1: Normalise Flutter camelCase → registry keys ────────────────
      // This is the only change from the previous version. Everything downstream
      // (mapCooperativeData, mapEnterpriseData, …) already reads registry keys,
      // so no other code needs to change.
      const normalized = normalizeFlatKeys(rawData, entityType); // ← NEW

      if (process.env.NODE_ENV !== 'production') {
        diagnoseMappingKeys(normalized); // ← was rawData, now normalized
      }

      // ── STEP 2: Map normalised data → template-ready structure ─────────────
      let mappedData: Record<string, unknown>;
      switch (entityType) {
        case 'enterprise':
          mappedData = mapEnterpriseData(normalized);  // ← was rawData
          break;
        case 'cooperative':
          mappedData = mapCooperativeData(normalized); // ← was rawData
          break;
        case 'ctd':
          mappedData = mapCtdData(normalized);         // ← was rawData
          break;
        case 'ong':
          mappedData = mapOngData(normalized);         // ← was rawData
          break;
        default:
          return res
            .status(HttpStatus.BAD_REQUEST)
            .json({ error: `Invalid entity type: "${entityType}"` });
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          '🔍 Mapped data sample:',
          JSON.stringify(mappedData, null, 2).substring(0, 500),
        );
      }

      // ── STEP 3: Generate PDF ───────────────────────────────────────────────
      console.log('📄 Generating PDF...');
      const pdfBuffer = await this.pdfService.generate({
        ...mappedData,
        formType: entityType,
      });
      console.log(`✅ PDF generated (${pdfBuffer.length} bytes)`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      const error = err as Error;
      console.error('❌ Preview error:', error.message);
      console.error('   Stack:', error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate preview',
        message: error.message,
      });
    }
  }

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  // Unchanged — the service calls normalizeFlatKeys() internally.
  @Post('submit')
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
  async submit(@Body() dto: any) {
    return this.service.submitQuestionnaire(dto);
  }
}