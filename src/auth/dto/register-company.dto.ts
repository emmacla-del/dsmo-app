import { IsDefined, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { CNPS_REQUIRED_ENTITY_TYPES } from '../registration-verification';

// PP_S1Q01 « Type d'entité », in the questionnaire's option order
// (lib/core/focus/compiler/onefop_ast.dart). Registration stores the option
// string itself, the value OnefopProjectProgramDetail.nature holds (dataset
// v12), so the wizard can pre-fill the question with no mapping.
export const PROJECT_NATURE_VALUES = [
  'Projet/ Project',
  'Programme/ Program',
  'Structure sous-tutelle/ Structure under supervision',
  'Autres/ Other',
];

export const CAMEROON_PHONE_PATTERN = /^(?:(?:\+|00)?237[\s().-]*)?[\s().-]*[26](?:[\s().-]*\d){8}$/;

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
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
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
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  phone?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  phone2?: string;
  @IsOptional() @IsString() poBox?: string;
  @IsOptional() @IsString() legalStatus?: string;
  @IsOptional() @IsString() cooperativeType?: string;
  @IsOptional() @IsString() ctdType?: string;
  @IsOptional() @IsString() yearOfCreation?: string;
  @IsOptional() @IsString() mainMission?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() trainingDomains?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  respondentPhone?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  respondentPhone2?: string;
  @IsOptional() @IsString() respondentFunction?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @IsNotEmpty()
  respondentFirstName?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @IsNotEmpty()
  respondentLastName?: string;
  @ValidateIf((o) => !o.respondentFirstName)
  @IsDefined() @IsString() @IsNotEmpty()
  firstName?: string;
  @ValidateIf((o) => !o.respondentLastName)
  @IsDefined() @IsString() @IsNotEmpty()
  lastName?: string;
  @IsOptional() @IsString() branch?: string;

  // VOCATIONAL_TRAINING-specific identification fields.
  @IsOptional() @IsString() sigle?: string;

  // Required only when entityType === 'VOCATIONAL_TRAINING' — the Flutter
  // register_constants.dart EntityConfig for vocationalTraining marks these
  // as required (no `required: false`), but the server never enforced it.
  // @IsDefined because the global pipe runs with skipMissingProperties: with
  // @IsString alone a missing key passed. @ValidateIf still gates it by type.
  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  cfpType?: string;

  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  educationSystem?: string;

  @ValidateIf((o) => o.entityType === 'VOCATIONAL_TRAINING')
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  functionalStatus?: string;

  // Section 2.1.13 accreditation details. Kept optional at the API boundary
  // for older mobile clients; current web and Flutter forms collect status,
  // and require the supporting details when the answer is Yes.
  @IsOptional()
  @IsIn(['Oui/ Yes', 'Non/ No'])
  authorizationStatus?: string;

  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.authorizationStatus === 'Oui/ Yes',
  )
  @IsDefined() @IsString() @Matches(/^\d{4}$/)
  authorizationYear?: string;

  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.authorizationStatus === 'Oui/ Yes',
  )
  @IsDefined() @IsString() @IsNotEmpty()
  authorizationOrderNumber?: string;

  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.authorizationStatus === 'Oui/ Yes',
  )
  @IsDefined() @IsString() @Matches(/^\d{2}\/\d{2}\/\d{4}$/)
  authorizationOrderDate?: string;

  // dependsOn chain: only required when functionalStatus is 'Non-fonctionnelle'.
  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.functionalStatus === 'Non-fonctionnelle',
  )
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  nonFunctionalReason?: string;

  // dependsOn chain: only required when nonFunctionalReason is 'Autres'.
  @ValidateIf(
    (o) =>
      o.entityType === 'VOCATIONAL_TRAINING' &&
      o.nonFunctionalReason === 'Autres',
  )
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  nonFunctionalReasonOther?: string;

  @IsOptional() @IsString() promoterName?: string;
  @IsOptional() @IsString() promoterSex?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  promoterPhone1?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString() @Matches(CAMEROON_PHONE_PATTERN)
  promoterPhone2?: string;

  // Required for PROJECT_PROGRAM only: the registration form asks it there,
  // and the wizard pre-fills PP_S1Q01 from it. @IsDefined because the global
  // pipe runs with skipMissingProperties; @ValidateIf gates it by type.
  @ValidateIf((o) => o.entityType === 'PROJECT_PROGRAM')
  @IsDefined()
  @IsIn(PROJECT_NATURE_VALUES)
  projectNature?: string;
}

/** The public POST /auth/register-company body: the fields plus a password. */
export class RegisterCompanyDto extends CompanyRegistrationFieldsDto {
  @IsString()
  @IsNotEmpty()
  password!: string;

  // Stable across an offline queue retry. This is optional for existing
  // clients, but the web registration flow sends it on every attempt.
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}
