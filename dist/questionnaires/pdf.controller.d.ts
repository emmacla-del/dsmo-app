import { Response } from 'express';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';
export declare class OnefopPdfController {
    private readonly pdfService;
    constructor(pdfService: OnefopPuppeteerService);
    generatePdf(dto: any, res: Response): Promise<void>;
}
