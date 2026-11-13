import { HttpException } from '@nestjs/common';

/**
 * Builds the exception every service throws for an expected failure.
 * The global filter copies `code` and `message` into the error envelope.
 *
 *   throw fail(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
 */
export function fail(
  status: number,
  code: string,
  message: string,
): HttpException {
  return new HttpException({ code, message }, status);
}
