// src/pdf/pdf.module.ts

import { Module } from '@nestjs/common';
import { OnefopPuppeteerService } from './onefop-puppeteer.service';
import { OnefopSubmissionPdfService } from './onefop-submission-pdf.service';

@Module({
  providers: [OnefopPuppeteerService, OnefopSubmissionPdfService],
  exports: [OnefopPuppeteerService, OnefopSubmissionPdfService],
})
export class PdfModule { }