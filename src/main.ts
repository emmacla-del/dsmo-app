// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as dns from 'dns';
import { AppModule } from './app.module';

async function bootstrap() {
  // Render's network has no outbound IPv6 route, but hosts like Gmail's SMTP
  // servers publish AAAA records. Node's default DNS order can hand back the
  // IPv6 address first, so outbound connections fail with ENETUNREACH. Prefer
  // IPv4 results so those connections use the address that's actually routable.
  dns.setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render terminates TLS and proxies to this app, so without trusting the
  // proxy, req.ip resolves to Render's internal address instead of the real
  // client IP. Account lockout, audit logs, and the admin IP allowlist all
  // depend on req.ip being the actual caller.
  app.set('trust proxy', 1);

  app.use(helmet());

  app.setGlobalPrefix('api'); // ← added

  // ALLOWED_ORIGINS lets production be locked down to known frontend origins
  // without breaking it before that env var is configured.
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
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