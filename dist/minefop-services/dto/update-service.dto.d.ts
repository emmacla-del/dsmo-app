import { ServiceCategory, UserRole } from '@prisma/client';
export declare class UpdateServiceDto {
    code?: string;
    name?: string;
    nameEn?: string;
    acronym?: string;
    category?: ServiceCategory;
    level?: number;
    parentCode?: string;
    roleMapping?: UserRole;
    requiresRegion?: boolean;
    requiresDepartment?: boolean;
    orderIndex?: number;
    isActive?: boolean;
}
