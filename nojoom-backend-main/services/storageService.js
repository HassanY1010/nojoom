import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const isProduction = process.env.NODE_ENV === 'production';
const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

class StorageProvider {
  async save() {
    throw new Error('StorageProvider.save must be implemented');
  }

  getPublicUrl() {
    throw new Error('StorageProvider.getPublicUrl must be implemented');
  }
}

class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    if (isProduction && process.env.ALLOW_LOCAL_STORAGE !== 'true') {
      throw new Error('Local upload storage is not allowed in production. Configure STORAGE_PROVIDER=s3.');
    }
  }

  async save(file, folder) {
    return {
      provider: 'local',
      key: `${folder}/${file.filename}`,
      filename: file.filename,
      path: file.path,
      url: `/uploads/${folder}/${file.filename}`,
    };
  }

  getPublicUrl(key) {
    return `/uploads/${key}`;
  }
}

class S3StorageProvider extends StorageProvider {
  constructor() {
    super();

    const required = ['S3_BUCKET', 'S3_REGION'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      throw new Error(`Missing S3 storage configuration: ${missing.join(', ')}`);
    }

    this.bucket = process.env.S3_BUCKET;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || '';
    this.client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }

  async save(file, folder) {
    const key = `${folder}/${file.filename}`;
    const body = fs.createReadStream(file.path);

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: file.mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return {
      provider: 's3',
      key,
      filename: file.filename,
      path: file.path,
      url: this.getPublicUrl(key),
    };
  }

  getPublicUrl(key) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
  }
}

const createStorageProvider = () => {
  if (provider === 's3') {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
};

export const storageService = createStorageProvider();
export const getStorageStatus = () => ({
  provider,
  productionSafe: provider === 's3' || process.env.ALLOW_LOCAL_STORAGE === 'true' || !isProduction,
});
export default storageService;
