import { CreateCompanyDto } from './create-company.dto';
import { CreateEmployeeDto } from './create-employee.dto';
import { MovementType } from '../../types/prisma.types';
export declare class CreateMovementDto {
    movementType: MovementType;
    cat1_3?: number;
    cat4_6?: number;
    cat7_9?: number;
    cat10_12?: number;
    catNonDeclared?: number;
}
export declare class CreateQualitativeDto {
    hasTrainingCenter?: boolean;
    recruitmentPlansNext?: boolean;
    camerounisationPlan?: boolean;
    usesTempAgencies?: boolean;
    tempAgencyDetails?: string;
}
export declare class SubmitDeclarationDto {
    company: CreateCompanyDto;
    year: number;
    fillingDate?: string;
    movements?: CreateMovementDto[];
    qualitative?: CreateQualitativeDto;
    employees: CreateEmployeeDto[];
    employeeCount?: number;
    language?: 'fr' | 'en';
}
