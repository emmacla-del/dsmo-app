// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import * as dns from 'dns';
import { AppModule } from './app.module';

async function bootstrap() {
  // Render's network has no outbound IPv6 route, but hosts like Gmail's SMTP
  // servers publish AAAA records. Node's default DNS order can hand back the
  // IPv6 address first, so outbound connections fail with ENETUNREACH. Prefer
  // IPv4 results so those connections use the address that's actually routable.
  dns.setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render sends SIGTERM on every deploy/restart. Without this, Nest never
  // calls each module's onModuleDestroy() (e.g. PrismaService.$disconnect())
  // before the process is killed, so in-flight DB work can be cut off
  // mid-request instead of draining cleanly.
  app.enableShutdownHooks();

  // Render terminates TLS and proxies to this app, so without trusting the
  // proxy, req.ip resolves to Render's internal address instead of the real
  // client IP. Account lockout, audit logs, and the admin IP allowlist all
  // depend on req.ip being the actual caller.
  app.set('trust proxy', 1);

  app.use(helmet());

  // Gzips JSON responses (analytics/report/listing payloads can be large).
  // compression's default filter already skips small bodies and already-
  // compressed content types (e.g. the PDF endpoints), so this is a no-op
  // for those responses rather than wasted CPU.
  app.use(compression());

  app.setGlobalPrefix('api'); // ← added

  // ALLOWED_ORIGINS lets production be locked down to known frontend origins
  // without breaking it before that env var is configured. The '*' fallback
  // is intentionally NOT hardened into a startup failure the way the JWT
  // secret is (see jwt-secret.ts) — unlike that fallback, this one may
  // already be silently in effect in the live environment, and forcing a
  // crash-on-boot here risks an unannounced production outage. Flagging
  // loudly instead: if this warning is showing up in production logs,
  // set ALLOWED_ORIGINS to a comma-separated list of the real frontend
  // origins (e.g. the deployed Flutter web origin).
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (!allowedOrigins || allowedOrigins.length === 0) {
    console.warn(
      '⚠️  ALLOWED_ORIGINS is not set — CORS is wide open (origin: "*"). ' +
        'Set ALLOWED_ORIGINS to a comma-separated allowlist before relying on this in production.',
    );
  }
  app.enableCors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();