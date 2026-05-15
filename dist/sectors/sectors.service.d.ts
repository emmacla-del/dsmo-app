import { PrismaService } from '../prisma/prisma.service';
export declare class SectorsService {
    private prisma;
    constructor(prisma: PrismaService);
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
