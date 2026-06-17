// src/dto/submission-round.dto.ts
import { IsDateString, IsString } from 'class-validator';

export class CreateRoundDto {
    @IsString()
    quarterCode: string;

    @IsString()
    labelFr: string;

    @IsString()
    labelEn: string;

    @IsDateString()
    periodStart: string;

    @IsDateString()
    periodEnd: string;

    @IsDateString()
    deadline: string;
}
