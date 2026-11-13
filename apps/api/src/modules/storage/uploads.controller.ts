import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';
import { readUpload } from './upload.util';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @Roles('TEACHER')
  @HttpCode(HttpStatus.CREATED)
  async uploadImage(@Req() req: FastifyRequest) {
    const { buffer, mimeType, ext } = await readUpload(req, {
      maxBytes: IMAGE_MAX_BYTES,
      allowed: IMAGE_EXTS,
    });

    const key = `question-images/${randomUUID()}.${ext}`;
    await this.storage.put(key, buffer, mimeType);
    return { url: `/uploads/images/${key}` };
  }

  @Get('images/*')
  @Public()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getImage(@Param('*') key: string): Promise<StreamableFile> {
    const stream = await this.storage.getStream(key);
    const ext = key.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
    };
    return new StreamableFile(stream, {
      type: mimeMap[ext] || 'application/octet-stream',
    });
  }
}
