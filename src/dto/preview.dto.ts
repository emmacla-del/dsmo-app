// src/dto/preview.dto.ts
import { IsString, IsIn, IsOptional, IsObject } from 'class-validator';

export class PreviewDto {
    @IsString()
    formId: string;

    @IsString()
    userId: string;

    @IsIn(['enterprise', 'cooperative', 'ctd', 'ong'])
    entityType: 'enterprise' | 'cooperative' | 'ctd' | 'ong';

    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
