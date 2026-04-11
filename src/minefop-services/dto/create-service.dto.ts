// src/minefop-services/dto/create-service.dto.ts
import {
    IsString,
    IsEnum,
    IsOptional,
    IsBoolean,
    IsInt,
    Min,
    Max,
    Length,
    Matches
} from 'class-validator';
import { ServiceCategory, UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // If using Swagger

export class CreateServiceDto {
    @ApiProperty({ example: 'DRMOE-SDIA-SPMO', description: 'Unique service code' })
    @IsString()
    @Matches(/^[A-Z0-9-]+$/, { message: 'Code must contain only uppercase letters, numbers, and hyphens' })
    @Length(2, 50)
    code: string;

    @ApiProperty({ example: 'Service du Placement de la Main-d\'Œuvre', description: 'Service name in French' })
    @IsString()
    @Length(2, 200)
    name: string;

    @ApiPropertyOptional({ example: 'Placement Service', description: 'Service name in English' })
    @IsOptional()
    @IsString()
    @Length(2, 200)
    nameEn?: string;

    @ApiPropertyOptional({ example: 'SPMO', description: 'Service acronym' })
    @IsOptional()
    @IsString()
    @Length(1, 20)
    acronym?: string;

    @ApiProperty({ enum: ServiceCategory, example: 'CENTRALE' })
    @IsEnum(ServiceCategory)
    category: ServiceCategory;

    @ApiProperty({ example: 3, description: 'Hierarchy level (1=Direction, 2=Sous-Direction, 3=Service, 4=Bureau)' })
    @IsInt()
    @Min(1)
    @Max(10)
    level: number;

    @ApiPropertyOptional({ example: 'DRMOE-SDIA', description: 'Parent service code' })
    @IsOptional()
    @IsString()
    parentCode?: string;

    @ApiProperty({ enum: UserRole, example: 'CENTRAL', description: 'User role that this service maps to' })
    @IsEnum(UserRole)
    roleMapping: UserRole;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    requiresRegion?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    requiresDepartment?: boolean;

    @ApiProperty({ example: 85, description: 'Display order' })
    @IsInt()
    @Min(0)
    orderIndex: number;
}