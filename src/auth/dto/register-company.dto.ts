import { IsDefined, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

// The entity types whose registration must carry a CNPS number.
const CNPS_REQUIRED_ENTITY_TYPES: readonly string[] = [
  'ENTREPRISE',
  'COOPERATIVE',
  'CTD',
  'ONG',
  'VOCATIONAL_TRAINING',
];

/**
 * Every company-registration field except the password.
 *
 * Split out so the admin-assisted route can accept the same body without a
 * password: there, the server generates a temporary password and hands it to
 * the acting admin once (see AssistedRegistrationDto / adminRegisterCompany).
 * An admin choosing a declarant's password is not a capability this platform
 * grants, so the field is absent from that DTO rather than accepted and
 * ignored — with ValidationPipe's whitelist, absent means rejected.
 *
 * class-validator reads decorators through the prototype chain, so both
 * subclasses validate exactly these rules; there is no second copy of the
 * field list to drift.
 */
export class CompanyRegistrationFieldsDto {
  @IsEmail()
  email!: string;

  @IsString()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  region!: string;

  @IsString()
  @IsNotEmpty()
  department!: string;

  @IsString()
  @IsNotEmpty()
  subdivision!: string;

  @IsString()
  address!: string;

  @IsOptional() @IsString() parentCompany?: string;
  @IsOptional() @IsString() mainActivity?: string;
  @IsOptional() @IsString() secondaryActivity?: string;
  @IsOptional() @IsString() regionId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() subdivisionId?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) socialCapital?: number;
  @IsOptional() @IsString() contactName?: string;
  // Required: the establishment ID prefix derives from it. The list is the
  // seven types the ID generator knows, not OnefopEntityType, which still
  // carries the deprecated VOCATIONAL_TRAINING_CENTER. @IsDefined because the
  // global pipe runs with skipMissingProperties, which skips @IsIn on a
  // missing key.
  @IsDefined()
  @IsIn(['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG', 'ADMINISTRATION', 'PROJECT_PROGRAM', 'VOCATIONAL_TRAINING'])
  entityType!: string;
  // Required for the five types that declare it on the registration form
  // (react-web ENTITY_CONFIGS); administration and project/programme do not
  // collect it. @IsDefined because the global pipe runs with
  // skipMissingProperties, which skips @IsString/@IsNotEmpty on a missing key;
  // @ValidateIf gates @IsDefined too, so the other two types may omit it.
  @ValidateIf((o) => CNPS_REQUIRED_ENTITY_TYPES.includes(o.entityType))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  cnpsNumber?: string;
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

/** The public POST /auth/register-company body: the fields plus a password. */
export class RegisterCompanyDto extends CompanyRegistrationFieldsDto {
  @IsString()
  password!: string;
}
