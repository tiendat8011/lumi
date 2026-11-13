import { Injectable, PipeTransform } from '@nestjs/common';
import { fail } from '../errors/app-error';

/** Any 8-4-4-4-12 hex string, which is what PostgreSQL accepts as a uuid. */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * For `:id` path parameters and id query parameters. A malformed id fails
 * with 400 VALIDATION_ERROR instead of reaching Prisma and returning 500.
 *
 *   @Param('id', UuidPipe) id: string
 */
@Injectable()
export class UuidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isUuid(value)) {
      throw fail(400, 'VALIDATION_ERROR', 'Mã định danh không hợp lệ');
    }
    return value;
  }
}
