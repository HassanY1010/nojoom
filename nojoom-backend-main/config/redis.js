// config/redis.js
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let rawRedisUrl = process.env.REDIS_URL;

// Ensure TLS for Upstash or rediss
if (rawRedisUrl && rawRedisUrl.includes('upstash.io') && rawRedisUrl.startsWith('redis://')) {
    rawRedisUrl = rawRedisUrl.replace(/^redis:\/\//, 'rediss://');
}

export const REDIS_URL = rawRedisUrl;
const isTls = Boolean(
    (REDIS_URL && REDIS_URL.startsWith('rediss://')) ||
    (REDIS_URL && REDIS_URL.includes('upstash.io')) ||
    process.env.REDIS_TLS === 'true'
);

let REDIS_HOST = process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1';
let REDIS_PORT = parseInt(process.env.REDIS_PORT || process.env.REDISPORT) || 6379;
let REDIS_PASSWORD = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || undefined;
let REDIS_USERNAME = process.env.REDIS_USER || process.env.REDISUSER || process.env.REDIS_USERNAME || undefined;

if (REDIS_URL) {
    try {
        const parsed = new URL(REDIS_URL);
        REDIS_HOST = parsed.hostname;
        REDIS_PORT = parseInt(parsed.port) || 6379;
        if (parsed.password) {
            REDIS_PASSWORD = decodeURIComponent(parsed.password);
        }
        if (parsed.username) {
            REDIS_USERNAME = decodeURIComponent(parsed.username);
        }
    } catch (e) {
        console.warn('⚠️ Could not parse REDIS_URL as URL:', e.message);
    }
}

let redisClient = null;
let isRedisAvailable = false;

/**
 * ينشئ اتصال Redis. إذا فشل، يتم التعامل معه بأمان (Graceful Degradation).
 */
export const connectRedis = async () => {
    try {
        const clientOptions = {
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            lazyConnect: true,
            connectTimeout: 5000,
            retryStrategy: () => null,
            ...(isTls ? { tls: {} } : {})
        };

        const client = REDIS_URL 
            ? new Redis(REDIS_URL, clientOptions)
            : new Redis({
                host: REDIS_HOST,
                port: REDIS_PORT,
                password: REDIS_PASSWORD,
                username: REDIS_USERNAME,
                ...clientOptions
            });

        // التقاط أخطاء الاتصال قبل الـ connect() لمنع UnhandledError
        client.on('error', (err) => {
            if (isRedisAvailable) {
                console.error('⚠️  Redis connection error (falling back to in-memory):', err.message);
                isRedisAvailable = false;
            }
        });

        await client.connect();
        await client.ping();

        redisClient = client;
        isRedisAvailable = true;

        console.log(`✅ Redis connected at ${REDIS_HOST}:${REDIS_PORT}${isTls ? ' (TLS enabled)' : ''}`);

        client.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });

        client.on('ready', () => {
            isRedisAvailable = true;
            console.log('✅ Redis reconnected successfully');
        });

        return client;
    } catch (err) {
        console.warn(`⚠️  Redis not available (${err.message}). Running with in-memory fallback.`);
        isRedisAvailable = false;
        return null;
    }
};

/**
 * الحصول على عميل Redis (أو null إذا لم يكن متاحاً)
 */
export const getRedisClient = () => redisClient;

/**
 * هل Redis متاح؟
 */
export const isRedisConnected = () => isRedisAvailable;

/**
 * إعدادات الاتصال لاستخدامها في BullMQ
 */
export const bullMQConnection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    username: REDIS_USERNAME,
    maxRetriesPerRequest: null,   // مطلوب بواسطة BullMQ
    enableReadyCheck: false,
    ...(isTls ? { tls: {} } : {})
};

export default { connectRedis, getRedisClient, isRedisConnected, bullMQConnection, REDIS_URL };
