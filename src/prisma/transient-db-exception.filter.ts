// src/prisma/transient-db-exception.filter.ts
//
// A request that still fails because the database connection was lost (the
// read retry in PrismaService did not save it, or it was a write) is answered
// 503 with a message that says so, in the client's language, instead of
// Nest's 500 « Internal server error » — which tells a respondent filing a
// declaration nothing, at the one moment a retry matters (E2E 2026-10-18,
// C6). Every other Prisma error keeps Nest's default handling: logged, 500.
import { ArgumentsHost, Catch, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { LocalizedHttpExceptionFilter } from '../common/i18n/localized-http-exception.filter';
import { DB_UNAVAILABLE_MESSAGE, isTransientDbError } from './transient-db-error';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class TransientDbExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Database');
  private readonly localized = new LocalizedHttpExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http' && isTransientDbError(exception)) {
      this.logger.warn(`Connection lost, answered 503: ${(exception as Error).message.split('\n')[0]}`);
      this.localized.catch(new ServiceUnavailableException(DB_UNAVAILABLE_MESSAGE), host);
      return;
    }
    super.catch(exception, host);
  }
}
