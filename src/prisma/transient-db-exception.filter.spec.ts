import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { LocalizedHttpExceptionFilter } from '../common/i18n/localized-http-exception.filter';
import { TransientDbExceptionFilter } from './transient-db-exception.filter';

/** Over real HTTP, with both global filters registered as main.ts does. */
@Controller('probe')
class ProbeController {
  @Get('lost')
  lost() {
    throw new Prisma.PrismaClientKnownRequestError('Server has closed the connection.', {
      code: 'P1017',
      clientVersion: '5.22.0',
    });
  }

  @Get('unique')
  unique() {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('a lost database connection over HTTP (C6)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false });
    app.useGlobalFilters(
      new LocalizedHttpExceptionFilter(),
      new TransientDbExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
    );
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  const get = async (path: string, locale?: string) => {
    const res = await fetch(base + path, { headers: locale ? { 'X-Locale': locale } : {} });
    return { status: res.status, body: await res.json() };
  };

  it('is answered 503 « réessayez », in French by default', async () => {
    const r = await get('/probe/lost');
    expect(r.status).toBe(503);
    expect(r.body.message).toBe(
      "Le service est momentanément indisponible : la base de données n'a pas répondu. Réessayez dans un instant.",
    );
  });

  it('and in English with X-Locale: en', async () => {
    const r = await get('/probe/lost', 'en');
    expect(r.status).toBe(503);
    expect(r.body.message).toBe('The service is briefly unavailable: the database did not respond. Try again in a moment.');
  });

  it('any other database error is still a 500, as before', async () => {
    expect(await get('/probe/unique')).toEqual({ status: 500, body: { statusCode: 500, message: 'Internal server error' } });
  });
});
