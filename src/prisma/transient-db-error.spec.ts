import { Prisma } from '@prisma/client';
import { isRetryableRead, isTransientDbError, retryLostConnectionReads } from './transient-db-error';

const lost = () =>
  new Prisma.PrismaClientKnownRequestError('Server has closed the connection.', { code: 'P1017', clientVersion: '5.22.0' });
const unique = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });

describe('a lost database connection (E2E 2026-10-18, C6)', () => {
  it('is recognised by its code, or by its message when Prisma gives none', () => {
    expect(isTransientDbError(lost())).toBe(true);
    expect(
      isTransientDbError(new Prisma.PrismaClientUnknownRequestError("Can't reach database server at pooler", { clientVersion: '5.22.0' })),
    ).toBe(true);
    expect(isTransientDbError(new Prisma.PrismaClientInitializationError('boot failed', '5.22.0', 'P1001'))).toBe(true);
  });

  it('is not confused with a real error', () => {
    expect(isTransientDbError(unique())).toBe(false);
    expect(isTransientDbError(new Error('Server has closed the connection'))).toBe(false); // not Prisma's
    expect(isTransientDbError(undefined)).toBe(false);
  });

  it('only a read outside a transaction may be sent again', () => {
    expect(isRetryableRead({ action: 'findMany', runInTransaction: false })).toBe(true);
    expect(isRetryableRead({ action: 'findMany', runInTransaction: true })).toBe(false);
    expect(isRetryableRead({ action: 'create', runInTransaction: false })).toBe(false);
    expect(isRetryableRead({ action: 'upsert', runInTransaction: false })).toBe(false);
  });

  describe('the retry middleware', () => {
    const run = async (action: string, failures: Error[], runInTransaction = false) => {
      let calls = 0;
      const next = async () => {
        const failure = failures[calls++];
        if (failure) throw failure;
        return 'rows';
      };
      const result = await retryLostConnectionReads()({ model: 'Establishment', action, runInTransaction }, next).catch(
        (e: unknown) => e,
      );
      return { result, calls };
    };

    it('sends a read again once when its connection was lost, and returns what it got', async () => {
      expect(await run('findMany', [lost()])).toEqual({ result: 'rows', calls: 2 });
    });

    it('does not retry a second time', async () => {
      const { result, calls } = await run('findMany', [lost(), lost()]);
      expect(calls).toBe(2);
      expect(isTransientDbError(result)).toBe(true);
    });

    it('never sends a write again', async () => {
      const { result, calls } = await run('create', [lost()]);
      expect(calls).toBe(1);
      expect(isTransientDbError(result)).toBe(true);
    });

    it('never retries inside a transaction', async () => {
      expect((await run('findMany', [lost()], true)).calls).toBe(1);
    });

    it('leaves any other error alone', async () => {
      const { result, calls } = await run('findMany', [unique()]);
      expect(calls).toBe(1);
      expect((result as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    });
  });
});
