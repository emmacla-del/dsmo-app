import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCompanyDto {
  @IsString() name: string;
  @IsOptional() @IsString() parentCompany?: string;
  @IsString() mainActivity: string;
  @IsOptional() @IsString() secondaryActivity?: string;
  @IsString() region: string;
  @IsString() department: string;
  @IsString() district: string;
  @IsString() address: string;
  @IsString() taxNumber: string;
  @IsOptional() @IsString() cnpsNumber?: string;
  @IsOptional() @IsInt() socialCapital?: number;
  @IsInt() totalEmployees: number;
  @IsOptional() @IsInt() menCount?: number;
  @IsOptional() @IsInt() womenCount?: number;
  @IsOptional() @IsInt() lastYearTotal?: number;
  @IsOptional() @IsInt() recruitments?: number;
  @IsOptional() @IsInt() promotions?: number;
  @IsOptional() @IsInt() dismissals?: number;
  @IsOptional() @IsInt() retirements?: number;
  @IsOptional() @IsInt() deaths?: number;
  @IsOptional() @IsInt() cat0_3?: number;
  @IsOptional() @IsInt() cat4_6?: number;
  @IsOptional() @IsInt() cat7_9?: number;
  @IsOptional() @IsInt() cat10_12?: number;
  @IsOptional() @IsInt() catNonDeclared?: number;
}
