import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationError } from 'class-validator';
import multipart from '@fastify/multipart';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';

function collectMessages(errors: ValidationError[], out: string[] = []) {
  for (const error of errors) {
    if (error.constraints) out.push(...Object.values(error.constraints));
    if (error.children?.length) collectMessages(error.children, out);
  }
  return out;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: collectMessages(errors).join('; ') || 'Dữ liệu không hợp lệ',
      }),
  });
}

/**
 * Global prefix, validation pipe, exception filter and response envelope.
 * Called by src/main.ts and by the e2e harness (test/support/app.ts), so the
 * two cannot drift apart.
 */
export async function configureApp(
  app: NestFastifyApplication,
): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
}
