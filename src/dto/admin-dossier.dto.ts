// src/dto/admin-dossier.dto.ts
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { AnomalyResolutionType } from '@prisma/client';

export class BulkVisaDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  submissionIds: string[];

  @IsBoolean()
  certified: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveAnomalyDto {
  @IsEnum(AnomalyResolutionType)
  @IsNotEmpty()
  resolutionType: AnomalyResolutionType;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'La justification de résolution doit comporter au moins 10 caractères.' })
  resolutionNote: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
