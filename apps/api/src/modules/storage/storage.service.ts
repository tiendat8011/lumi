import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { fail } from '../../common/errors/app-error';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'lumi');
  }

  async onModuleInit() {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    if (!endpoint) {
      this.logger.warn(
        'MINIO_ENDPOINT not set — storage is disabled (uploads return 503)',
      );
      return;
    }

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<boolean>('MINIO_USE_SSL', false),
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', ''),
    });

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to connect to MinIO: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private ensureConfigured(): Minio.Client {
    if (!this.client) {
      throw fail(
        503,
        'STORAGE_UNAVAILABLE',
        'Dịch vụ lưu trữ chưa được cấu hình',
      );
    }
    return this.client;
  }

  async put(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const client = this.ensureConfigured();
    try {
      await client.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': mimeType,
      });
    } catch (error) {
      this.logger.error(
        `put(${key}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw fail(
        503,
        'STORAGE_UNAVAILABLE',
        'Không thể lưu tệp vào kho lưu trữ',
      );
    }
  }

  async getStream(key: string): Promise<Readable> {
    const client = this.ensureConfigured();
    try {
      return await client.getObject(this.bucket, key);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'NoSuchKey'
      ) {
        throw fail(404, 'NOT_FOUND', 'Không tìm thấy tệp');
      }
      this.logger.error(
        `getStream(${key}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw fail(
        503,
        'STORAGE_UNAVAILABLE',
        'Không thể đọc tệp từ kho lưu trữ',
      );
    }
  }

  async remove(key: string): Promise<void> {
    const client = this.ensureConfigured();
    try {
      await client.removeObject(this.bucket, key);
    } catch (error) {
      this.logger.error(
        `remove(${key}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
