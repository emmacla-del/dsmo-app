import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Phase 3 (territorial admin monitoring) — the in-app inbox.
 *
 * The property that matters most here is isolation: every read and write is
 * scoped by userId inside the query, so a caller cannot reach another user's
 * notifications even with a valid notification id. These tests assert the
 * `where` clauses rather than trusting the implementation to have remembered.
 */

function makePrisma(rows: any[] = []) {
  return {
    userNotification: {
      create: jest.fn(async ({ data }: any) => ({ id: 'n-new', createdAt: new Date(), readAt: null, ...data })),
      findMany: jest.fn(async () => rows),
      count: jest.fn(async () => rows.length),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn(async () => rows[0] ?? null),
    },
  } as any;
}

describe('NotificationsService', () => {
  it('creates a notification with a null linkHref when none is given', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    await service.create('user-1', 'NUDGE', 'Sujet', 'Corps du message');

    expect(prisma.userNotification.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', kind: 'NUDGE', subject: 'Sujet', body: 'Corps du message', linkHref: null },
    });
  });

  it('keeps an explicit linkHref', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    await service.create('user-1', 'NUDGE', 'Sujet', 'Corps', '/admin/dossiers');

    expect(prisma.userNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ linkHref: '/admin/dossiers' }) }),
    );
  });

  it('scopes the listing to the caller and orders newest first', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    await service.listForUser('user-1');

    expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('filters to unread when asked', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    await service.listForUser('user-1', { unreadOnly: true });

    expect(prisma.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', readAt: null } }),
    );
  });

  it('caps the limit so the inbox cannot be used as an export', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    await service.listForUser('user-1', { limit: 100000 });
    expect(prisma.userNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));

    // A nonsensical limit falls back to the default rather than to zero rows.
    await service.listForUser('user-1', { limit: 0 });
    expect(prisma.userNotification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('counts only the caller\'s unread rows', async () => {
    const prisma = makePrisma();
    const service = new NotificationsService(prisma);

    const result = await service.unreadCount('user-1');

    expect(prisma.userNotification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
    });
    expect(result).toEqual({ count: 0 });
  });

  it('marks read with both ids in the filter, never by id alone', async () => {
    const prisma = makePrisma([{ id: 'n-1', userId: 'user-1', readAt: new Date() }]);
    const service = new NotificationsService(prisma);

    await service.markRead('user-1', 'n-1');

    expect(prisma.userNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('reports not-found for another user\'s notification, revealing nothing', async () => {
    const prisma = makePrisma();
    prisma.userNotification.updateMany = jest.fn(async () => ({ count: 0 }));
    prisma.userNotification.findFirst = jest.fn(async () => null);
    const service = new NotificationsService(prisma);

    await expect(service.markRead('attacker', 'someone-elses-id')).rejects.toThrow(NotFoundException);
    // The confirming read is itself scoped, so existence is never probed
    // outside the caller's own rows.
    expect(prisma.userNotification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'someone-elses-id', userId: 'attacker' } }),
    );
  });

  it('is idempotent on an already-read notification', async () => {
    const alreadyRead = { id: 'n-1', readAt: new Date('2026-10-01T00:00:00Z') };
    const prisma = makePrisma();
    prisma.userNotification.updateMany = jest.fn(async () => ({ count: 0 }));
    prisma.userNotification.findFirst = jest.fn(async () => alreadyRead);
    const service = new NotificationsService(prisma);

    // No throw, and the original readAt is preserved — re-clicking a
    // notification is not a new read.
    await expect(service.markRead('user-1', 'n-1')).resolves.toEqual(alreadyRead);
  });
});
