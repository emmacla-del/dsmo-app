import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Lighter DTO used when a company saves its profile during account registration.
 * Workforce figures and district are not required at this stage —
 * they are filled in (and overwritten) each time a declaration is submitted.
 */
export class RegisterCompanyProfileDto {
  @IsString()
  name!: string;

  @IsString()
  taxNumber!: string;

  @IsString()
  mainActivity!: string;

  @IsString()
  region!: string;

  @IsString()
  department!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  parentCompany?: string;

  @IsOptional()
  @IsString()
  secondaryActivity?: string;

  @IsOptional()
  @IsString()
  cnpsNumber?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  socialCapital?: number;
}
