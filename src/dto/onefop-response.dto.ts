// src/dto/onefop-response.dto.ts
export class OnefopResponseDto {
    success: boolean;
    submissionId?: string;
    message?: string;
    errors?: string[];
    data?: any;
}