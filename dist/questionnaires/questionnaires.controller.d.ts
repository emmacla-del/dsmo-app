import { Response } from 'express';
import { QuestionnairesService } from './questionnaires.service';
import { OnefopPuppeteerService } from '../pdf/onefop-puppeteer.service';
export declare class QuestionnairesController {
    private readonly service;
    private readonly pdfService;
    constructor(service: QuestionnairesService, pdfService: OnefopPuppeteerService);
    preview(body: any, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    submit(dto: any): Promise<import("../dto").OnefopResponseDto>;
}
