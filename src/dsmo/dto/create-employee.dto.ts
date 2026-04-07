import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() fullName: string;
  @IsString() gender: 'M' | 'F';
  @IsInt() @Min(15) @Max(100) age: number;
  @IsString() nationality: string;
  @IsOptional() @IsString() diploma?: string;
  @IsString() function: string;
  @IsInt() @Min(0) seniority: number;
  @IsOptional() @IsString() salaryCategory?: string;
}
