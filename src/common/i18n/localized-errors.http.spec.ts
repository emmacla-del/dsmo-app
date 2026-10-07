import { BadRequestException, Body, Controller, Get, INestApplication, Module, Param, ParseUUIDPipe, Post, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { LocalizedHttpExceptionFilter } from './localized-http-exception.filter';

/**
 * End to end over real HTTP: a Nest app bootstrapped the way main.ts does it
 * (global ValidationPipe, the localizing filter, the CORS headers), with a
 * throwaway controller -- no database, no AppModule. Node's own fetch is the
 * client.
 */

class SignUpDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

@Controller('probe')
class ProbeController {
  @Get('reject')
  reject() {
    throw new BadRequestException('Le motif de rejet est obligatoire.');
  }

  @Get('english')
  english() {
    throw new BadRequestException('Campaign not found');
  }

  @Get('item/:id')
  item(@Param('id', ParseUUIDPipe) id: string) {
    return { id };
  }

  @Post('sign-up')
  signUp(@Body() body: SignUpDto) {
    return body;
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('localized errors over HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false });
    app.enableCors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization', 'X-Locale'] });
    app.useGlobalPipes(new ValidationPipe({ transform: false, whitelist: true, forbidNonWhitelisted: false, skipMissingProperties: true }));
    app.useGlobalFilters(new LocalizedHttpExceptionFilter());
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

  it('French by default, as before', async () => {
    expect(await get('/probe/reject')).toEqual({
      status: 400,
      body: { statusCode: 400, message: 'Le motif de rejet est obligatoire.', error: 'Bad Request' },
    });
  });

  it('English with X-Locale: en', async () => {
    const r = await get('/probe/reject', 'en');
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('A reason for rejection is required.');
  });

  it('an English-only message now reaches French clients in French', async () => {
    expect((await get('/probe/english')).body.message).toBe('Campagne introuvable');
    expect((await get('/probe/english', 'en')).body.message).toBe('Campaign not found');
  });

  it('validation messages, in both languages', async () => {
    const post = (locale: string) =>
      fetch(base + '/probe/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Locale': locale },
        body: JSON.stringify({ email: 'nope', name: '' }),
      }).then((r) => r.json());
    expect((await post('fr')).message).toEqual(expect.arrayContaining(['email doit être une adresse e-mail', 'name ne doit pas être vide']));
    expect((await post('en')).message).toEqual(expect.arrayContaining(['email must be an email', 'name should not be empty']));
  });

  it('framework messages: route not found and pipe failures', async () => {
    expect((await get('/nowhere')).body.message).toBe('Route introuvable : GET /nowhere');
    expect((await get('/nowhere', 'en')).body.message).toBe('Cannot GET /nowhere');
    expect((await get('/probe/item/not-a-uuid')).body.message).toBe('Validation échouée (UUID attendu)');
  });

  it('a browser may send X-Locale: the CORS preflight allows it', async () => {
    const res = await fetch(base + '/probe/reject', {
      method: 'OPTIONS',
      headers: { Origin: 'https://cam-leap.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-locale' },
    });
    expect(res.status).toBeLessThan(300);
    expect((res.headers.get('access-control-allow-headers') ?? '').toLowerCase()).toContain('x-locale');
  });
});
