import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Đã xảy ra lỗi hệ thống';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        message = (res['message'] as string) || exception.message;
        code = (res['code'] as string) || this.statusToCode(status);
        if (Array.isArray(res['message'])) {
          message = (res['message'] as string[]).join('; ');
        }
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      // Unique constraint: the constraint is the concurrency backstop, so a
      // violation is a conflict, not a server error.
      status = HttpStatus.CONFLICT;
      code = 'CONFLICT';
      message = 'Dữ liệu đã tồn tại';
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      status = HttpStatus.NOT_FOUND;
      code = 'NOT_FOUND';
      message = 'Không tìm thấy dữ liệu';
    } else {
      // Unexpected error: log it, and never send its text (Prisma errors
      // carry SQL, file paths and source lines) to the client.
      message = 'Đã xảy ra lỗi hệ thống';
      if (exception instanceof Error) {
        this.logger.error(exception.message, exception.stack);
      } else {
        this.logger.error(String(exception));
      }
    }

    if (!code || code === 'INTERNAL_ERROR') {
      code = this.statusToCode(status);
    }

    reply.status(status).send({
      success: false,
      error: { code, message },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return map[status] || 'UNKNOWN_ERROR';
  }
}
