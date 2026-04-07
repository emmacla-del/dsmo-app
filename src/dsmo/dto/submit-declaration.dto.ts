import { Type } from 'class-transformer';
import { ValidateNested, IsInt, IsArray } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { CreateEmployeeDto } from './create-employee.dto';

export class SubmitDeclarationDto {
  @ValidateNested()
  @Type(() => CreateCompanyDto)
  company: CreateCompanyDto;

  @IsInt()
  year: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees: CreateEmployeeDto[];
}
