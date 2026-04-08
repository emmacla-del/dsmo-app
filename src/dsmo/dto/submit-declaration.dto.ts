import { Type } from 'class-transformer';
import {
  ValidateNested,
  IsInt,
  IsArray,
  IsOptional,
  IsBoolean,
  IsString,
  IsEnum,
  IsDateString,
  IsIn,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { CreateEmployeeDto } from './create-employee.dto';
import { MovementType } from '../../types/prisma.types';

export class CreateMovementDto {
  @IsEnum(MovementType)
  movementType!: MovementType;

  @IsOptional()
  @IsInt()
  @Min(0)
  cat1_3?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  cat4_6?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  cat7_9?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  cat10_12?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  catNonDeclared?: number = 0;
}

export class CreateQualitativeDto {
  @IsOptional()
  @IsBoolean()
  hasTrainingCenter?: boolean;

  @IsOptional()
  @IsBoolean()
  recruitmentPlansNext?: boolean;

  @IsOptional()
  @IsBoolean()
  camerounisationPlan?: boolean;

  @IsOptional()
  @IsBoolean()
  usesTempAgencies?: boolean;

  @IsOptional()
  @IsString()
  tempAgencyDetails?: string;
}

export class SubmitDeclarationDto {
  @ValidateNested()
  @Type(() => CreateCompanyDto)
  company!: CreateCompanyDto; // Added ! to resolve TS2564

  @IsInt()
  @Min(1900)
  year!: number; // Added ! to resolve TS2564

  @IsOptional()
  @IsDateString()
  fillingDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMovementDto)
  movements?: CreateMovementDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateQualitativeDto)
  qualitative?: CreateQualitativeDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees!: CreateEmployeeDto[]; // Added ! to resolve TS2564

  @IsOptional()
  @IsIn(['fr', 'en'])
  language?: 'fr' | 'en' = 'fr';
}