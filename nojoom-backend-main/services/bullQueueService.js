// services/bullQueueService.js
/**
 * BullMQ Queue Service - مع Graceful Degradation للـ In-Memory
 * 
 * إذا كان Redis متاحاً: يستخدم BullMQ (مهام مستمرة لا تضيع عند restart)
 * إذا لم يكن Redis متاحاً: يرجع إلى In-Memory Queue (النظام القديم)
 */

import path from 'path';
import fs from 'fs';
import { isRedisConnected, bullMQConnection } from '../config/redis.js';

// Queue & Worker names
export const QUEUES = {
    VIDEO_PROCESSING: 'video-processing',
    THUMBNAIL_GENERATION: 'thumbnail-generation',
};

// Job types
export const JOB_TYPES = {
    PROCESS_VIDEO: 'process-video',
    GENERATE_THUMBNAIL: 'generate-thumbnail',
};

// ---- BullMQ instances (يُهيأن فقط إذا توفر Redis) ----
let videoQueue = null;
let thumbnailQueue = null;
let videoWorker = null;
let thumbnailWorker = null;

// ---- In-Memory Fallback (النظام القديم) ----
import { queueService as inMemoryQueue } from './queueService.js';

const allowInMemoryQueue = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_IN_MEMORY_QUEUE === 'true';

/**
 * تهيئة BullMQ Queues والـ Workers
 * يجب استدعاء هذه الدالة بعد نجاح اتصال Redis
 */
export const initBullMQ = async () => {
    if (!isRedisConnected()) {
        if (!allowInMemoryQueue()) {
            throw new Error('Redis is required for production queues. Refusing in-memory queue fallback.');
        }
        console.warn('⚠️  Redis not available. BullMQ will NOT be initialized. Using in-memory queue.');
        return false;
    }

    try {
        const { Queue, Worker } = await import('bullmq');

        // --- إنشاء الـ Queues ---
        videoQueue = new Queue(QUEUES.VIDEO_PROCESSING, {
            connection: bullMQConnection,
            defaultJobOptions: {
                attempts: 3,                    // إعادة المحاولة 3 مرات عند الفشل
                backoff: {
                    type: 'exponential',
                    delay: 5000,                // تأخير بين المحاولات
                },
                removeOnComplete: { count: 100 },  // احتفظ بآخر 100 مهمة مكتملة
                removeOnFail: { count: 50 },       // احتفظ بآخر 50 مهمة فاشلة
            }
        });

        thumbnailQueue = new Queue(QUEUES.THUMBNAIL_GENERATION, {
            connection: bullMQConnection,
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'fixed', delay: 3000 },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 25 },
            }
        });

        // --- إنشاء الـ Workers ---
        videoWorker = new Worker(
            QUEUES.VIDEO_PROCESSING,
            async (job) => {
                console.log(`🎬 [BullMQ Worker] Processing video job: ${job.id}`, job.data);
                const { videoId, path: videoPath, startTime, endTime, filter, audioPath } = job.data;

                // تحديث التقدم
                await job.updateProgress(5);

                const { videoChunkService } = await import('./videoChunkService.js');
                await videoChunkService.processVideo(videoId, videoPath, {
                    startTime, endTime, filter, audioPath
                });

                await job.updateProgress(80);

                // تشغيل تحليل AI
                try {
                    const { default: aiService } = await import('./aiService.js');
                    const { executeQuery } = await import('../config/db.js');
                    const [video] = await executeQuery('SELECT description, category FROM videos WHERE id = ?', [videoId]);
                    if (video) {
                        await aiService.moderateContent(videoId, video.description, []);
                        await aiService.generateSubtitles(videoId, videoPath);
                    }
                } catch (aiErr) {
                    console.error(`⚠️  AI analysis failed for video ${videoId} (non-fatal):`, aiErr.message);
                }

                await job.updateProgress(100);
                console.log(`✅ [BullMQ Worker] Video ${videoId} fully processed.`);
            },
            {
                connection: bullMQConnection,
                concurrency: 2,             // معالجة فيديوين في نفس الوقت
                limiter: {
                    max: 5,
                    duration: 60000,        // أقصى 5 فيديوهات في الدقيقة
                }
            }
        );

        thumbnailWorker = new Worker(
            QUEUES.THUMBNAIL_GENERATION,
            async (job) => {
                console.log(`🖼️  [BullMQ Worker] Generating thumbnail:`, job.data);
                const { videoId, videoPath, thumbnailsDir, thumbFilename, thumbnailTimestamp } = job.data;

                const { ThumbnailService } = await import('./thumbnailService.js');
                await ThumbnailService.generateThumbnail(
                    videoPath,
                    thumbnailsDir,
                    thumbFilename,
                    thumbnailTimestamp || '00:00:01'
                );

                if (['s3', 'supabase'].includes((process.env.STORAGE_PROVIDER || '').toLowerCase())) {
                    const localThumbPath = path.join(thumbnailsDir, thumbFilename);
                    if (fs.existsSync(localThumbPath)) {
                        const { storageService } = await import('./storageService.js');
                        const stored = await storageService.save({
                            filename: thumbFilename,
                            path: localThumbPath,
                            mimetype: 'image/jpeg'
                        }, 'thumbnails');
                        const { pool } = await import('../config/db.js');
                        await pool.execute('UPDATE videos SET thumbnail = ? WHERE id = ?', [stored.url, videoId]);
                        console.log("[BullMQ Worker] Thumbnail uploaded to S3/Supabase for video:", videoId, stored.url);
                    }
                }

                console.log(`✅ [BullMQ Worker] Thumbnail generated for video ${videoId}.`);
            },
            {
                connection: bullMQConnection,
                concurrency: 3,
            }
        );

        // --- حدث عند اكتمال المهمة ---
        videoWorker.on('completed', (job) => {
            console.log(`✅ [BullMQ] Video job ${job.id} completed.`);
        });

        videoWorker.on('failed', (job, err) => {
            console.error(`❌ [BullMQ] Video job ${job?.id} failed:`, err.message);
        });

        thumbnailWorker.on('completed', (job) => {
            console.log(`✅ [BullMQ] Thumbnail job ${job.id} completed.`);
        });

        thumbnailWorker.on('failed', (job, err) => {
            console.error(`❌ [BullMQ] Thumbnail job ${job?.id} failed:`, err.message);
        });

        console.log('✅ BullMQ Queues and Workers initialized successfully.');
        return true;

    } catch (err) {
        if (!allowInMemoryQueue()) {
            throw err;
        }
        console.error('❌ Failed to initialize BullMQ:', err.message);
        console.warn('⚠️  Falling back to in-memory queue.');
        return false;
    }
};

/**
 * إضافة مهمة معالجة فيديو إلى الطابور
 */
export const addVideoProcessingJob = async (data, options = {}) => {
    if (videoQueue && isRedisConnected()) {
        try {
            const job = await videoQueue.add(JOB_TYPES.PROCESS_VIDEO, data, {
                priority: options.priority || 0,
                delay: options.delay || 0,
                jobId: options.jobId || `video-${data.videoId}-${Date.now()}`,
            });
            console.log(`📦 [BullMQ] Video processing job enqueued: ${job.id} for video ${data.videoId}`);
            return { provider: 'bullmq', jobId: job.id };
        } catch (err) {
            console.error('❌ BullMQ enqueue failed, falling back to in-memory:', err.message);
        }
    }

    if (!allowInMemoryQueue()) {
        throw new Error('Video queue unavailable: Redis/BullMQ is required in production.');
    }

    // Fallback to in-memory
    console.log(`📦 [In-Memory] Video processing job enqueued for video ${data.videoId}`);
    await inMemoryQueue.add(QUEUES.VIDEO_PROCESSING, data);
    return { provider: 'in-memory', jobId: null };
};

/**
 * إضافة مهمة توليد Thumbnail إلى الطابور
 */
export const addThumbnailJob = async (data, options = {}) => {
    if (thumbnailQueue && isRedisConnected()) {
        try {
            const job = await thumbnailQueue.add(JOB_TYPES.GENERATE_THUMBNAIL, data, {
                priority: options.priority || 0,
                jobId: options.jobId || `thumb-${data.videoId}-${Date.now()}`,
            });
            console.log(`🖼️  [BullMQ] Thumbnail job enqueued: ${job.id} for video ${data.videoId}`);
            return { provider: 'bullmq', jobId: job.id };
        } catch (err) {
            console.error('❌ BullMQ thumbnail enqueue failed, falling back to in-memory:', err.message);
        }
    }

    if (!allowInMemoryQueue()) {
        throw new Error('Thumbnail queue unavailable: Redis/BullMQ is required in production.');
    }

    // Fallback to in-memory
    console.log(`🖼️  [In-Memory] Thumbnail job enqueued for video ${data.videoId}`);
    await inMemoryQueue.add(QUEUES.THUMBNAIL_GENERATION, data);
    return { provider: 'in-memory', jobId: null };
};

/**
 * الحصول على إحصائيات الطابور (للوحة الإدارة)
 */
export const getQueueStats = async () => {
    if (!videoQueue || !isRedisConnected()) {
        return {
            provider: 'in-memory',
            videoProcessing: { waiting: 0, active: 0, completed: 0, failed: 0 },
            thumbnailGeneration: { waiting: 0, active: 0, completed: 0, failed: 0 },
        };
    }

    const [videoStats, thumbStats] = await Promise.all([
        videoQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        thumbnailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    return {
        provider: 'bullmq',
        videoProcessing: videoStats,
        thumbnailGeneration: thumbStats,
    };
};

/**
 * إغلاق الـ Workers والـ Queues بأمان عند إيقاف السيرفر
 */
export const shutdownQueues = async () => {
    console.log('🔄 Gracefully shutting down BullMQ workers...');
    try {
        if (videoWorker) await videoWorker.close();
        if (thumbnailWorker) await thumbnailWorker.close();
        if (videoQueue) await videoQueue.close();
        if (thumbnailQueue) await thumbnailQueue.close();
        console.log('✅ BullMQ workers shut down successfully.');
    } catch (err) {
        console.error('❌ Error shutting down BullMQ:', err.message);
    }
};

export default {
    initBullMQ,
    addVideoProcessingJob,
    addThumbnailJob,
    getQueueStats,
    shutdownQueues,
};
