import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  parentCompany?: string;

  @IsString()
  mainActivity!: string;

  @IsOptional()
  @IsString()
  secondaryActivity?: string;

  @IsString()
  region!: string;

  @IsString()
  department!: string;

  @IsString()
  subdivision!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsString()
  taxNumber!: string;

  @IsOptional()
  @IsString()
  cnpsNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  socialCapital?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalEmployees!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  menCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  womenCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastYearMenCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastYearWomenCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lastYearTotal?: number;

  // ═══════════════════════════════════════════════════════════
  // ONEFOP PREFILL FIELDS — Added for DSMO/ONEFOP integration
  // These fields are filled during registration and prefilled
  // into ONEFOP Section 0 & 1 forms.
  // ═══════════════════════════════════════════════════════════

  // ── Entity Contact (Section 1) ──
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phone2?: string;        // ← REQUIRED for ONEFOP prefill

  @IsOptional()
  @IsString()
  poBox?: string;         // ← REQUIRED for ONEFOP prefill

  @IsOptional()
  @IsString()
  branch?: string;       // ← REQUIRED for ONEFOP prefill

  // ── Entity Classification (Section 1) ──
  @IsOptional()
  @IsString()
  area?: string;           // Urbain / Rural

  @IsOptional()
  @IsString()
  legalStatus?: string;    // SARL, SA, etc.

  @IsOptional()
  @IsString()
  cooperativeType?: string;

  @IsOptional()
  @IsString()
  ctdType?: string;

  @IsOptional()
  @IsString()
  yearOfCreation?: string;

  @IsOptional()
  @IsString()
  entityType?: string;     // ENTREPRISE, COOPERATIVE, CTD, ONG

  @IsOptional()
  @IsString()
  mainMission?: string;   // For ONG

  @IsOptional()
  @IsString()
  registrationNumber?: string; // For ONG

  @IsOptional()
  @IsString()
  trainingDomains?: string;    // For vocational

  // ── Respondent Contact (Section 0) ──
  @IsOptional()
  @IsString()
  respondentPhone?: string;

  @IsOptional()
  @IsString()
  respondentPhone2?: string;   // ← REQUIRED for ONEFOP prefill

  @IsOptional()
  @IsString()
  respondentFunction?: string; // ← REQUIRED for ONEFOP prefill

  @IsOptional()
  @IsString()
  respondentFirstName?: string; // ← REQUIRED for ONEFOP prefill

  @IsOptional()
  @IsString()
  respondentLastName?: string;  // ← REQUIRED for ONEFOP prefill
}