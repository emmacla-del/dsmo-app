// src/dto/admin-dossier.dto.ts
import { IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AnomalyResolutionType } from '@prisma/client';

export class BulkRejectDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  submissionIds: string[];

  @IsBoolean()
  certified: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'La justification doit comporter au moins 10 caractères.' })
  reason: string;
}

/** Same shape as a bulk reject: a written reason and the reviewer's attestation. */
export class BulkRequestCorrectionDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  submissionIds: string[];

  @IsBoolean()
  certified: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'La justification doit comporter au moins 10 caractères.' })
  reason: string;
}

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

  // Required for both ordinary resolutions and privileged waivers so every
  // mutation is tied to the dossier revision the reviewer opened.
  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedRevision: number;
}

/** A non-empty, reviewer-authored progress note; reads and heartbeats do not extend a claim. */
export class SaveReviewProgressDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'La note de progression doit comporter au moins 10 caractères.' })
  @MaxLength(2000)
  note: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedRevision: number;
}

/** Approval confirmation; an explanation is required when open warnings remain. */
export class ApproveDossierDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedRevision: number;
}
