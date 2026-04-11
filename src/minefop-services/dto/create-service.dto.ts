import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, Min, Max, Length, Matches } from 'class-validator';
import { ServiceCategory, UserRole } from '@prisma/client';

export class CreateServiceDto {
  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: 'Code must contain only uppercase letters, numbers, and hyphens' })
  @Length(2, 50)
  code: string;

  @IsString()
  @Length(2, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  acronym?: string;

  @IsEnum(ServiceCategory)
  category: ServiceCategory;

  @IsInt()
  @Min(1)
  @Max(10)
  level: number;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsEnum(UserRole)
  roleMapping: UserRole;

  @IsOptional()
  @IsBoolean()
  requiresRegion?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDepartment?: boolean;

  @IsInt()
  @Min(0)
  orderIndex: number;
}
