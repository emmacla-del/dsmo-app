import { IsBoolean, IsOptional } from 'class-validator';

/**
 * PATCH /auth/approve-user/:id — the reviewer's confirmations.
 *
 * Every field is optional here: which ones an approval needs depends on the
 * file (ADMINISTRATION needs centralStructureConfirmed; the CNPS row applies
 * to five entity types only), so the service is the enforcing copy and
 * answers 400 when a required one is not strictly `true`. The DTO's job is to
 * refuse a non-boolean outright: "true" or 1 is a 400 here, not a pass.
 *
 * Staff (non-COMPANY) approvals use the same route and need none of these.
 */
export class ApproveRegistrationDto {
  @IsOptional() @IsBoolean() centralStructureConfirmed?: boolean;
  @IsOptional() @IsBoolean() nameVerified?: boolean;
  @IsOptional() @IsBoolean() phoneVerified?: boolean;
  @IsOptional() @IsBoolean() contactEmailVerified?: boolean;
  @IsOptional() @IsBoolean() cnpsVerified?: boolean;
}
