import { IsEmail, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterCompanyDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  companyName!: string;

  @IsString()
  region!: string;

  @IsString()
  address!: string;

  @IsOptional() @IsString() parentCompany?: string;
  @IsOptional() @IsString() mainActivity?: string;
  @IsOptional() @IsString() secondaryActivity?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() subdivision?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() cnpsNumber?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) socialCapital?: number;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() sectorId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() phone2?: string;
  @IsOptional() @IsString() poBox?: string;
  @IsOptional() @IsString() legalStatus?: string;
  @IsOptional() @IsString() cooperativeType?: string;
  @IsOptional() @IsString() ctdType?: string;
  @IsOptional() @IsString() yearOfCreation?: string;
  @IsOptional() @IsString() mainMission?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() trainingDomains?: string;
  @IsOptional() @IsString() respondentPhone?: string;
  @IsOptional() @IsString() respondentPhone2?: string;
  @IsOptional() @IsString() respondentFunction?: string;
  @IsOptional() @IsString() respondentFirstName?: string;
  @IsOptional() @IsString() respondentLastName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() branch?: string;

  // VOCATIONAL_TRAINING-specific identification fields.
  @IsOptional() @IsString() sigle?: string;

  // Required only when entityType === 'VOCATIONAL_TRAINING' — the Flutter
  // register_constants.dart EntityConfig for vocationalTraining marks these
  // as required (no `required: false`), but the server never enforced it.
  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsString()
  cfpType?: string;

  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsString()
  educationSystem?: string;

  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsString()
  functionalStatus?: string;

  // dependsOn chain: only required when functionalStatus is 'Non-fonctionnelle'.
  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.functionalStatus === 'Non-fonctionnelle',
  )
  @IsString()
  nonFunctionalReason?: string;

  // dependsOn chain: only required when nonFunctionalReason is 'Autres'.
  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.nonFunctionalReason === 'Autres',
  )
  @IsString()
  nonFunctionalReasonOther?: string;

  @IsOptional() @IsString() promoterName?: string;
  @IsOptional() @IsString() promoterSex?: string;
  @IsOptional() @IsString() promoterPhone1?: string;
  @IsOptional() @IsString() promoterPhone2?: string;
}
