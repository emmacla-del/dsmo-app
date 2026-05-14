// src/dto/onefop-error.dto.ts
export class OnefopErrorDto {
    success: false;
    error: string;
    message: string;
    timestamp: string;
    path: string;
    statusCode: number;
    details?: any[];
}