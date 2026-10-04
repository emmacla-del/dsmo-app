import { Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowInactiveCompany } from '../auth/allow-inactive-company.decorator';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { NotificationsService } from './notifications.service';

/**
 * The caller's own notification inbox — Phase 3 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Mounted under /auth/me so it sits with the other "about the caller" routes.
 *
 * No @Roles: every authenticated user reads their own notifications, company
 * accounts included (Phase 3-full notifies them of approvals, and having the
 * routes exist now saves re-plumbing). There is no userId parameter anywhere —
 * the service filters by req.user.id on every call, so authorization is
 * structural rather than a check that could be forgotten.
 *
 * A pending or complements-requested company must still reach its inbox, which
 * is where it will be told what to correct, so AllowInactiveCompany applies
 * here as it does on GET /auth/me.
 *
 * Deliberately omitted for v1: PATCH read-all. Users mark each notification
 * read by clicking it; the bulk route arrives in Phase 3-full if it is missed.
 */
@Controller('auth/me/notifications')
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@AllowInactiveCompany()
export class NotificationsController {
  constructor(private notifications: NotificationsService) { }

  @Get()
  async list(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listForUser(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unread-count')
  async unreadCount(@Request() req: any) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.id, id);
  }
}
