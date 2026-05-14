// src/pdf/pdf.module.ts

import { Module } from '@nestjs/common';
import { OnefopPuppeteerService } from './onefop-puppeteer.service';

@Module({
  providers: [OnefopPuppeteerService],
  exports: [OnefopPuppeteerService],
})
export class PdfModule { }