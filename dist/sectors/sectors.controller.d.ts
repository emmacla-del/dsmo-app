import { SectorsService } from './sectors.service';
export declare class SectorsController {
    private readonly sectorsService;
    constructor(sectorsService: SectorsService);
    getAllSectors(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string | null;
        nameEn: string | null;
        category: string | null;
    }[]>;
    getSectorById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string | null;
        nameEn: string | null;
        category: string | null;
    } | null>;
    getSectorsByCategory(category: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string | null;
        nameEn: string | null;
        category: string | null;
    }[]>;
}
