// src/dto/onefop-submission.dto.ts
import { IsString, IsIn, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class OnefopSubmissionDto {
    @IsString()
    formId: string;

    @IsOptional()  // ← CHANGE: make optional
    @IsString()
    userId?: string;  // ← CHANGE: add ?

    // companyId/establishmentId are accepted for backward compatibility with
    // existing clients but are never trusted: QuestionnairesService always
    // re-resolves both from the authenticated user's own Company row, so a
    // caller cannot attribute a submission to another company by editing
    // these fields.
    @IsOptional()
    @IsString()
    companyId?: string;

    @IsOptional()
    @IsString()
    establishmentId?: string;

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