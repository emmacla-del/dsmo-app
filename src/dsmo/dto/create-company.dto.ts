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
  district!: string;

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
}