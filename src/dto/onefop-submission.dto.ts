// src/dto/onefop-submission.dto.ts
import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class OnefopSubmissionDto {
    @IsString()
    formId: string;

    @IsString()
    userId: string;

    @IsIn(['enterprise', 'cooperative', 'ctd', 'ong'])
    entityType: 'enterprise' | 'cooperative' | 'ctd' | 'ong';

    // No decorators on data — the global ValidationPipe will not inspect
    // the contents of this field. Validation of the nested structure happens
    // in the service AFTER FlatToNestedTransformer runs.
    data: Record<string, any>;

    // When true: save partial data, skip required-field checks
    // When false/absent: enforce required fields before saving
    @IsOptional()
    @IsBoolean()
    isDraft?: boolean;

    @IsOptional()
    @IsString()
    companyId?: string;
}