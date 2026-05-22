// questionnaires.controller.ts

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
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';

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

      const normalized = normalizeFlatKeys(rawData, entityType);

      // DEBUG: Log keys for dismissal reasons, skills, and training needs
      const relevantKeys = Object.keys(normalized)
        .filter(k => k.startsWith('s3q02') || k.startsWith('s4q02') || k.startsWith('s4q03'));
      console.log('🔑 Reasons/Skills/Training keys:', JSON.stringify(relevantKeys));
      console.log('📦 Full normalized payload keys count:', Object.keys(normalized).length);

      if (process.env.NODE_ENV !== 'production') {
        diagnoseMappingKeys(normalized);
      }

      let mappedData: Record<string, unknown>;
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