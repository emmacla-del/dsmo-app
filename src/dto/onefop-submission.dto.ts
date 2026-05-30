// src/dto/onefop-submission.dto.ts
import { IsString, IsIn, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class OnefopSubmissionDto {
    @IsString()
    formId: string;

    @IsString()
    userId: string;

    @IsIn(['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'])
    entityType: 'ENTREPRISE' | 'COOPERATIVE' | 'CTD' | 'ONG';

    @IsOptional()
    @IsString()
    establishmentId?: string;

    @IsOptional()
    @IsString()
    quarterCode?: string;

    data: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    isDraft?: boolean;

    @IsOptional()
    @IsString()
    companyId?: string;

    @IsOptional()
    @IsObject()
    __meta?: {
        establishmentId?: string;
        taxNumber?: string;
        cnpsNumber?: string;
        registrationNumber?: string;
    };
}