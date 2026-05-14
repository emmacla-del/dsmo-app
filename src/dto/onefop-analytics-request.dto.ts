// src/dto/onefop-analytics-request.dto.ts
import { IsOptional, IsDateString, IsIn, IsString } from 'class-validator';

export class OnefopAnalyticsRequestDto {
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
    @IsString()
    region?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    groupBy?: 'month' | 'quarter' | 'year' | 'entityType' | 'region';
}