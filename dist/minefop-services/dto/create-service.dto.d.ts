import { ServiceCategory, UserRole } from '@prisma/client';
export declare class CreateServiceDto {
    code: string;
    name: string;
    nameEn?: string;
    acronym?: string;
    category: ServiceCategory;
    level: number;
    parentCode?: string;
    roleMapping: UserRole;
    requiresRegion?: boolean;
    requiresDepartment?: boolean;
    orderIndex: number;
}
