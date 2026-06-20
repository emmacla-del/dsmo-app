// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dns from 'dns';
import { AppModule } from './app.module';

async function bootstrap() {
  // Render's network has no outbound IPv6 route, but hosts like Gmail's SMTP
  // servers publish AAAA records. Node's default DNS order can hand back the
  // IPv6 address first, so outbound connections fail with ENETUNREACH. Prefer
  // IPv4 results so those connections use the address that's actually routable.
  dns.setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api'); // ← added

  app.enableCors({
    origin: '*',
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