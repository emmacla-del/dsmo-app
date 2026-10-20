// src/prisma/transient-db-error.ts
//
// A lost database connection is not a fault in the request. The Supabase
// pooler closes idle connections, and Prisma then hands the next query a
// connection the server has already dropped: P1017 « Server has closed the
// connection » (E2E 2026-10-18, C6, at establishment.findMany during a
// submission). The retry that follows gets a fresh connection and succeeds.
//
// Two things follow from that, and both live here so they agree:
//  - a READ that failed this way is retried once, outside a transaction
//    (PrismaService). A write is never retried: the connection may have been
//    lost after the database committed it, and doing it twice is worse than
//    reporting it.
//  - whatever still fails this way is answered 503 with a message saying so,
//    not 500 « Internal server error » (TransientDbExceptionFilter).

/** Prisma codes for a connection that is gone, unreachable, or timed out. */
const CONNECTION_CODES = new Set([
  'P1001', // can't reach database server
  'P1002', // database server reached but timed out
  'P1008', // operations timed out
  'P1017', // server has closed the connection
  'P2024', // timed out fetching a new connection from the pool
]);

/** The same failures when Prisma reports them without a code. */
const CONNECTION_MESSAGE =
  /server has closed the connection|can't reach database server|connection (?:terminated|reset|refused)|ECONNRESET|ETIMEDOUT|Timed out fetching a new connection/i;

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, errorCode, message } = error as { code?: unknown; errorCode?: unknown; message?: unknown };
  if (typeof code === 'string' && CONNECTION_CODES.has(code)) return true;
  if (typeof errorCode === 'string' && CONNECTION_CODES.has(errorCode)) return true;
  const name = (error as { name?: unknown }).name;
  if (typeof name !== 'string' || !name.startsWith('PrismaClient')) return false;
  return typeof message === 'string' && CONNECTION_MESSAGE.test(message);
}

/** Prisma actions that only read, and so may be sent again. */
const READ_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

export function isRetryableRead(params: { action: string; runInTransaction: boolean }): boolean {
  return !params.runInTransaction && READ_ACTIONS.has(params.action);
}

interface QueryParams {
  model?: string;
  action: string;
  runInTransaction: boolean;
}

/** Prisma query middleware: a read that lost its connection is sent once more. */
export function retryLostConnectionReads(logger?: { warn(message: string): void }) {
  return async <P extends QueryParams>(params: P, next: (params: P) => Promise<unknown>): Promise<unknown> => {
    try {
      return await next(params);
    } catch (error) {
      if (!isTransientDbError(error) || !isRetryableRead(params)) throw error;
      logger?.warn(`${params.model ?? ''}.${params.action}: connection lost, retried once`);
      return next(params);
    }
  };
}

/**
 * What the user reads. It says only what is certain: the database did not
 * answer, and trying again is the remedy. Repeating a submission is safe —
 * the server answers a retry of the same formId with its first result.
 */
export const DB_UNAVAILABLE_MESSAGE =
  'Le service est momentanément indisponible : la base de données n\'a pas répondu. Réessayez dans un instant.';
