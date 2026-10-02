import { SetMetadata } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

export const ALLOW_INACTIVE_COMPANY_KEY = 'allowInactiveCompany';

export interface AllowInactiveCompanyOptions {
  statuses?: UserStatus[];
}

/**
 * Decorator to exempt specific authenticated handlers from ActiveCompanyGuard.
 * - No arg: any status allowed (provided isActive is true).
 * - With { statuses: [...] }: allows only those specified statuses (isActive=false is always denied).
 */
export const AllowInactiveCompany = (options?: AllowInactiveCompanyOptions) =>
  SetMetadata(ALLOW_INACTIVE_COMPANY_KEY, options ?? {});
