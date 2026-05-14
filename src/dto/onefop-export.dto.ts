// src/dto/onefop-export.dto.ts
import { IsOptional, IsIn, IsDateString } from 'class-validator';

export class OnefopExportDto {
    @IsIn(['csv', 'excel', 'json'])
    format: 'csv' | 'excel' | 'json';

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsIn(['enterprise', 'cooperative', 'ctd', 'ong'])
    entityType?: string;

    @IsOptional()
    @IsIn(['summary', 'detailed', 'raw'])
    exportType?: 'summary' | 'detailed' | 'raw' = 'detailed';

    @IsOptional()
    @IsIn(['fr', 'en'])
    language?: 'fr' | 'en' = 'fr';
}