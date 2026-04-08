import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Transforms plain JSON bodies into typed DTO instances, strips unknown fields,
  // and runs all class-validator decorators (including @ValidateNested + @Type).
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,       // coerce JSON → DTO class instances
      whitelist: true,       // strip fields not declared in DTOs (e.g. otherCountry)
      forbidNonWhitelisted: false, // warn but don't reject — safer during rollout
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false, // must be false when origin is '*'
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
}
bootstrap();