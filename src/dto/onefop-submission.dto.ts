// src/dto/onefop-submission.dto.ts
import { IsString, IsIn, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class OnefopSubmissionDto {
    @IsString()
    formId: string;

    @IsOptional()  // ← CHANGE: make optional
    @IsString()
    userId?: string;  // ← CHANGE: add ?

    @IsString()  // ← ADD THIS - required field
    companyId: string;  // ← ADD THIS

    @IsString()  // ← ADD THIS - required field  
    establishmentId: string;  // ← ADD THIS

    @IsIn(['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'])
    entityType: 'ENTREPRISE' | 'COOPERATIVE' | 'CTD' | 'ONG';

    @IsOptional()
    @IsString()
    quarterCode?: string;

    data: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    isDraft?: boolean;

    @IsOptional()
    @IsObject()
    __meta?: {
        establishmentId?: string;
        taxNumber?: string;
        cnpsNumber?: string;
        registrationNumber?: string;
    };
}