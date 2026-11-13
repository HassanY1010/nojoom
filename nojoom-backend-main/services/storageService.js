import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

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
      throw new Error('Local upload storage is not allowed in production. Configure STORAGE_PROVIDER=s3 or STORAGE_PROVIDER=supabase.');
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

class SupabaseStorageProvider extends StorageProvider {
  constructor() {
    super();

    const url = process.env.SUPABASE_URL || (process.env.SUPABASE_PROJECT_ID ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co` : '');
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase storage configuration: SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
    }

    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || 'nojoom-media';
    this.client = createClient(url, key);
    this.publicBaseUrl = process.env.SUPABASE_PUBLIC_URL || `${url.replace(/\/$/, '')}/storage/v1/object/public/${this.bucket}`;
  }

  async save(file, folder) {
    const key = `${folder}/${file.filename}`;
    const fileBuffer = fs.readFileSync(file.path);

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(key, fileBuffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase Storage upload error: ${error.message}`);
    }

    const { data: publicUrlData } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(key);

    return {
      provider: 'supabase',
      key,
      filename: file.filename,
      path: file.path,
      url: publicUrlData?.publicUrl || this.getPublicUrl(key),
    };
  }

  getPublicUrl(key) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.supabase.co/storage/v1/object/public/${this.bucket}/${key}`;
  }
}

const createStorageProvider = () => {
  if (provider === 'supabase') {
    return new SupabaseStorageProvider();
  }
  if (provider === 's3') {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
};

export const storageService = createStorageProvider();
export const getStorageStatus = () => ({
  provider,
  productionSafe: ['s3', 'supabase'].includes(provider) || process.env.ALLOW_LOCAL_STORAGE === 'true' || !isProduction,
});
export default storageService;
