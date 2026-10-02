import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';
import { ALLOW_INACTIVE_COMPANY_KEY, AllowInactiveCompanyOptions } from './allow-inactive-company.decorator';

@Injectable()
export class ActiveCompanyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return true;
    }

    // Staff and admin roles pass through untouched
    if (user.role !== UserRole.COMPANY) {
      return true;
    }

    // isActive = false is always denied regardless of status or @AllowInactiveCompany
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'COMPANY_NOT_ACTIVE',
        status: user.status ?? null,
      });
    }

    // Check if the handler or class has @AllowInactiveCompany
    const allowInactiveOptions = this.reflector.getAllAndOverride<AllowInactiveCompanyOptions | undefined>(
      ALLOW_INACTIVE_COMPANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowInactiveOptions !== undefined) {
      // No arg (or empty statuses array) = any status allowed (provided isActive === true)
      if (!allowInactiveOptions.statuses || allowInactiveOptions.statuses.length === 0) {
        return true;
      }
      // With statuses = allow only those statuses
      if (allowInactiveOptions.statuses.includes(user.status)) {
        return true;
      }
    }

    // Default allow-list: allow ONLY if status is ACTIVE
    // Any other status (PENDING_APPROVAL, REJECTED, DRAFT, UNDER_REVIEW, etc.) is denied
    // Do NOT check establishmentId (29 active companies have none until R.1's backfill)
    if (user.status === UserStatus.ACTIVE) {
      return true;
    }

    throw new ForbiddenException({
      code: 'COMPANY_NOT_ACTIVE',
      status: user.status ?? null,
    });
  }
}
