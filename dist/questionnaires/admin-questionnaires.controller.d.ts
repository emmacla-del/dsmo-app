import { QuestionnairesService } from './questionnaires.service';
export declare class AdminQuestionnairesController {
    private readonly service;
    constructor(service: QuestionnairesService);
    getPending(limit?: number, offset?: number): Promise<any>;
    getCorrectionRequested(limit?: number, offset?: number): Promise<any>;
    getOne(id: string): Promise<any>;
    approve(id: string, req: any): Promise<any>;
    reject(id: string, reason: string, req: any): Promise<any>;
    requestCorrection(id: string, comments: string, req: any): Promise<any>;
}
