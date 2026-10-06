import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OnefopEntityType } from '../../types/prisma.types';

/**
 * The corrections a company may send when staff asked for complements.
 *
 * Every field is optional: a resubmission with no body at all is just the
 * status flip back to PENDING_APPROVAL, which stays allowed.
 *
 * This list is an explicit allowlist of the RegisterCompanyProfileDto fields
 * plus the territory ids — establishmentId is deliberately absent and the
 * service copies fields one by one rather than spreading the body, so a
 * company can never reach it. Establishment IDs are issued by a reviewer at
 * approval, never by the applicant.
 *
 * The route validates with forbidNonWhitelisted, so an unknown key is a 400
 * rather than being silently dropped.
 */
export class ResubmitRegistrationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() mainActivity?: string;
  @IsOptional() @IsString() secondaryActivity?: string;
  @IsOptional() @IsString() parentCompany?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cnpsNumber?: string;
  @IsOptional() @IsString() fax?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) socialCapital?: number;

  // User.email, not a Company column: the login identifier and the entity's
  // ONEFOP contact. Written to User by the service, outside the Company path.
  @IsOptional() @IsEmail() email?: string;

  // Validated against the enum rather than left a free string: the column is
  // an enum, so an unrecognised value would otherwise reach Prisma and
  // surface as a 500 instead of a 400.
  @IsOptional() @IsEnum(OnefopEntityType) entityType?: OnefopEntityType;

  // Territory. Sending any one of these resolves the whole chain through
  // resolveAndValidateTerritory, which requires a subdivision, so a partial
  // chain is a 400 rather than a half-moved file.
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() subdivision?: string;
  @IsOptional() @IsString() regionId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() subdivisionId?: string;
}
