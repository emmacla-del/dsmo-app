import { Type } from 'class-transformer';
import {
  ValidateNested, IsInt, IsArray, IsOptional,
  IsBoolean, IsString, IsEnum, IsDateString,
} from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { CreateEmployeeDto } from './create-employee.dto';
import { MovementType } from '../../types/prisma.types';

export class CreateMovementDto {
  @IsEnum(MovementType) movementType: MovementType;
  @IsOptional() @IsInt() cat1_3?: number;
  @IsOptional() @IsInt() cat4_6?: number;
  @IsOptional() @IsInt() cat7_9?: number;
  @IsOptional() @IsInt() cat10_12?: number;
}

export class CreateQualitativeDto {
  @IsOptional() @IsBoolean() hasTrainingCenter?: boolean;
  @IsOptional() @IsBoolean() recruitmentPlansNext?: boolean;
  @IsOptional() @IsBoolean() camerounisationPlan?: boolean;
  @IsOptional() @IsBoolean() usesTempAgencies?: boolean;
  @IsOptional() @IsString() tempAgencyDetails?: string;
}

export class SubmitDeclarationDto {
  @ValidateNested()
  @Type(() => CreateCompanyDto)
  company: CreateCompanyDto;

  @IsInt()
  year: number;

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
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees: CreateEmployeeDto[];
}
