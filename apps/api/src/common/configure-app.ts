import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationError } from 'class-validator';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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
  const logger = new Logger('ConfigureApp');

  // Security: HTTP headers (XSS, clickjacking, MIME sniffing, etc.)
  await app.register(helmet, {
    contentSecurityPolicy: false, // handled by frontend/nginx
  });

  // Security: rate limiting — 100 requests per minute per IP
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true, 'retry-after': true },
  });

  // Multipart file uploads — 50MB for audio files
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  logger.log('Security middleware configured: helmet + rate-limit (100 req/min)');
}
