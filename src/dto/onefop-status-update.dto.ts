// src/dto/onefop-status-update.dto.ts
import { IsString, IsIn, IsOptional } from 'class-validator';

export class OnefopStatusUpdateDto {
    @IsIn(['submitted', 'verified', 'rejected'])
    status: 'submitted' | 'verified' | 'rejected';

    @IsOptional()
    @IsString()
    rejectionReason?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}