import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * In-app notification inbox — Phase 3 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Deliberately not the same thing as `NotificationService` in src/dsmo: that
 * one sends outbound email and audits it per campaign. This one is a per-user
 * inbox with read state, which a user sees when they next log in. Email is
 * unreliable on this deployment, so in-app is the channel, not a fallback.
 *
 * Every read and write is scoped by `userId` in the query itself rather than
 * checked after loading a row. A caller cannot read, mark, or count another
 * user's notifications even by guessing an id.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** Hard cap on a single listing — an inbox, not an export. */
  private static readonly MAX_LIMIT = 200;
  private static readonly DEFAULT_LIMIT = 50;

  constructor(private prisma: PrismaService) { }

  /**
   * Adds one notification to a user's inbox.
   *
   * Call sites treat this as fire-and-forget: a failed notification must never
   * break the action that triggered it (an approval, a nudge). The rejection
   * is logged here so a swallowed `.catch()` upstream still leaves a trace.
   */
  async create(
    userId: string,
    kind: string,
    subject: string,
    body: string,
    linkHref?: string | null,
  ) {
    try {
      return await this.prisma.userNotification.create({
        data: { userId, kind, subject, body, linkHref: linkHref ?? null },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create ${kind} notification for ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /** The caller's own notifications, newest first. */
  async listForUser(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const limit = Math.min(
      opts.limit && opts.limit > 0 ? opts.limit : NotificationsService.DEFAULT_LIMIT,
      NotificationsService.MAX_LIMIT,
    );
    return this.prisma.userNotification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** The unread count behind the bell badge. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  /**
   * Marks one of the caller's own notifications read.
   *
   * `updateMany` with both ids in the filter, not `update` by id: a row
   * belonging to someone else matches nothing and reports not-found, rather
   * than being loaded and then rejected. Already-read rows keep their original
   * readAt — re-clicking a notification is not a new read.
   */
  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      // Either it does not exist, it is not the caller's, or it was already
      // read. The first two must not be distinguishable from the outside, and
      // the third is not an error — so confirm the row only if the caller owns it.
      const existing = await this.prisma.userNotification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true, readAt: true },
      });
      if (!existing) throw new NotFoundException('Notification introuvable.');
      return existing;
    }

    return this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId },
    });
  }
}
