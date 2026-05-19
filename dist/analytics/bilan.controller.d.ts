import { Request } from 'express';
import { BilanService } from './bilan.service';
export declare class BilanController {
    private readonly bilanService;
    constructor(bilanService: BilanService);
    getBilan(req: Request & {
        user: {
            id: string;
        };
    }, year: number): Promise<import("./bilan.service").BilanRhResponse>;
}
