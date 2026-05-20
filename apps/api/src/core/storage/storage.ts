import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  prefix?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface Storage {
  put(input: UploadInput): Promise<UploadResult>;
  getPublicUrl(key: string): string | Promise<string>;
  delete(key: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Local-disk driver — dev only                                       */
/* ------------------------------------------------------------------ */

class LocalStorage implements Storage {
  private readonly root = path.resolve(config.STORAGE_LOCAL_DIR);

  async put(input: UploadInput): Promise<UploadResult> {
    const ext = path.extname(input.originalName) || mimeToExt(input.mimeType);
    const id = crypto.randomBytes(16).toString('hex');
    const prefix = input.prefix ? input.prefix.replace(/^\/+|\/+$/g, '') : 'misc';
    const key = `${prefix}/${id}${ext}`;
    const fullPath = path.join(this.root, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return {
      key,
      url: this.getPublicUrl(key),
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
    };
  }

  getPublicUrl(key: string): string {
    const base = config.API_PUBLIC_URL.replace(/\/+$/, '');
    const prefix = config.STORAGE_PUBLIC_PREFIX.startsWith('/')
      ? config.STORAGE_PUBLIC_PREFIX
      : `/${config.STORAGE_PUBLIC_PREFIX}`;
    return `${base}${prefix}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.root, key);
    await fs.rm(fullPath, { force: true });
  }
}

/* ------------------------------------------------------------------ */
/*  S3 / R2 driver                                                     */
/*    R2 is S3-compatible — set STORAGE_S3_ENDPOINT to                  */
/*    `https://<account>.r2.cloudflarestorage.com` and                  */
/*    STORAGE_S3_REGION="auto".                                         */
/*                                                                     */
/*  Public URL strategy:                                                */
/*    - STORAGE_PUBLIC_BASE_URL set → return `${base}/${key}` (CDN,     */
/*      public bucket, or custom domain).                               */
/*    - Empty → return a short-lived presigned GET. Best for private    */
/*      buckets and study materials that need access control later.     */
/* ------------------------------------------------------------------ */

class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (
      !config.STORAGE_S3_BUCKET ||
      !config.STORAGE_S3_ACCESS_KEY_ID ||
      !config.STORAGE_S3_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        'S3/R2 storage selected but STORAGE_S3_BUCKET / STORAGE_S3_ACCESS_KEY_ID / STORAGE_S3_SECRET_ACCESS_KEY are not all set.',
      );
    }
    this.bucket = config.STORAGE_S3_BUCKET;
    this.client = new S3Client({
      region: config.STORAGE_S3_REGION,
      endpoint: config.STORAGE_S3_ENDPOINT || undefined,
      // R2 + most non-AWS S3 providers need path-style addressing.
      forcePathStyle: Boolean(config.STORAGE_S3_ENDPOINT),
      credentials: {
        accessKeyId: config.STORAGE_S3_ACCESS_KEY_ID,
        secretAccessKey: config.STORAGE_S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(input: UploadInput): Promise<UploadResult> {
    const ext = path.extname(input.originalName) || mimeToExt(input.mimeType);
    const id = crypto.randomBytes(16).toString('hex');
    const prefix = input.prefix ? input.prefix.replace(/^\/+|\/+$/g, '') : 'misc';
    const key = `${prefix}/${id}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        ContentLength: input.buffer.byteLength,
      }),
    );

    const url = await this.resolveUrl(key);
    return {
      key,
      url,
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
    };
  }

  async getPublicUrl(key: string): Promise<string> {
    return this.resolveUrl(key);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async resolveUrl(key: string): Promise<string> {
    if (config.STORAGE_PUBLIC_BASE_URL) {
      const base = config.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '');
      return `${base}/${key}`;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 60 * 60 }, // 1h
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Driver selection                                                   */
/* ------------------------------------------------------------------ */

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'text/markdown') return '.md';
  if (mime === 'text/plain') return '.txt';
  return '';
}

function buildStorage(): Storage {
  switch (config.STORAGE_DRIVER) {
    case 'local':
      return new LocalStorage();
    case 's3':
    case 'r2':
      return new S3Storage();
  }
}

export const storage: Storage = buildStorage();
