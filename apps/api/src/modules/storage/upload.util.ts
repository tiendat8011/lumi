import { FastifyRequest } from 'fastify';
import { fail } from '../../common/errors/app-error';

export type UploadResult = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  ext: string;
};

type UploadOptions = {
  maxBytes: number;
  allowed: string[];
};

const EXT_TO_MIME: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  csv: ['text/csv', 'application/csv', 'text/plain'],
  json: ['application/json', 'text/plain'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  ogg: ['audio/ogg', 'application/ogg'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  webm: ['audio/webm', 'video/webm'],
};

// Leading bytes for common file types.
const MAGIC: [string, Buffer][] = [
  ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ['jpg', Buffer.from([0xff, 0xd8, 0xff])],
  ['jpeg', Buffer.from([0xff, 0xd8, 0xff])],
  ['gif', Buffer.from([0x47, 0x49, 0x46, 0x38])],
  ['pdf', Buffer.from([0x25, 0x50, 0x44, 0x46])],
  // ZIP-based Office formats (docx, xlsx, pptx)
  ['docx', Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  // Audio formats
  ['wav', Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
  ['ogg', Buffer.from([0x4f, 0x67, 0x67, 0x53])], // OggS
  // mp3, m4a, webm: magic byte check skipped — rely on MIME + extension
];

function extFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

function checkMagicBytes(ext: string, buffer: Buffer): boolean {
  const match = MAGIC.find(([e]) => e === ext);
  if (!match) return true;
  const [, magic] = match;
  if (buffer.length < magic.length) return false;
  return buffer.subarray(0, magic.length).equals(magic);
}

/**
 * @fastify/multipart augments FastifyRequest with `file()`, but that
 * augmentation is not visible from this module, so the parts we use are
 * declared here rather than casting the request to `any`.
 */
type MultipartFile = {
  filename?: string;
  mimetype?: string;
  file: AsyncIterable<Buffer> & { truncated: boolean };
};

type MultipartRequest = FastifyRequest & {
  file(): Promise<MultipartFile | undefined>;
};

export async function readUpload(
  req: FastifyRequest,
  options: UploadOptions,
): Promise<UploadResult> {
  const file = await (req as MultipartRequest).file();
  if (!file) {
    throw fail(400, 'VALIDATION_ERROR', 'Không tìm thấy tệp tải lên');
  }

  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of file.file) {
    size += chunk.length;
    if (size > options.maxBytes) {
      throw fail(
        400,
        'FILE_TOO_LARGE',
        `Tệp vượt quá giới hạn ${Math.floor(options.maxBytes / (1024 * 1024))} MB`,
      );
    }
    parts.push(chunk);
  }

  if (file.file.truncated) {
    throw fail(
      400,
      'FILE_TOO_LARGE',
      `Tệp vượt quá giới hạn ${Math.floor(options.maxBytes / (1024 * 1024))} MB`,
    );
  }

  const buffer = Buffer.concat(parts);
  const filename = file.filename || 'upload';
  const ext = extFromFilename(filename);
  const mimeType = file.mimetype || '';

  if (!ext || !options.allowed.includes(ext)) {
    throw fail(
      400,
      'INVALID_FILE_TYPE',
      `Loại tệp không được hỗ trợ. Cho phép: ${options.allowed.join(', ')}`,
    );
  }

  const allowedMimes = EXT_TO_MIME[ext];
  if (allowedMimes && !allowedMimes.includes(mimeType)) {
    throw fail(
      400,
      'INVALID_FILE_TYPE',
      `MIME type không khớp với phần mở rộng tệp`,
    );
  }

  if (!checkMagicBytes(ext, buffer)) {
    throw fail(
      400,
      'INVALID_FILE_TYPE',
      'Nội dung tệp không khớp với phần mở rộng',
    );
  }

  return { buffer, filename, mimeType, ext };
}
