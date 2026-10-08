import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DecimalSerializerInterceptor } from './common/interceptors/decimal-serializer.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ClinicContextInterceptor } from './common/interceptors/clinic-context.interceptor';

async function bootstrap() {
  // Warn if JWT_SECRET is not configured
  if (!process.env.JWT_SECRET) {
    console.warn(
      '⚠ WARNING: JWT_SECRET environment variable is not set. ' +
      'Using insecure fallback for development only. ' +
      'Set JWT_SECRET in your .env file for production.',
    );
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-clinic-id'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown properties with a 400 instead of letting them reach Prisma,
      // which fails with an opaque 500 on unrecognised columns.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Clinic context runs first so handlers see the hospital a platform admin picked.
  app.useGlobalInterceptors(new ClinicContextInterceptor(), new DecimalSerializerInterceptor());
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`HMS Backend running on http://localhost:${port}/api`);
}
bootstrap();
