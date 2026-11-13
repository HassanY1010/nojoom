import { executeQuery } from '../config/db.js';

/**
 * Queue Service - Readiness for BullMQ + Redis
 * Implements a true non-blocking in-memory queue.
 */
class QueueService {
    constructor() {
        this.queues = {
            'video-processing': [],
            'thumbnail-generation': []
        };
        this.isProcessing = {
            'video-processing': false,
            'thumbnail-generation': false
        };
    }

    async add(name, data, options = {}) {
        console.log(`📦 Queue [${name}] - Job added:`, data.videoId || data.filename);
        
        if (!this.queues[name]) {
            this.queues[name] = [];
            this.isProcessing[name] = false;
        }

        // Push to in-memory queue
        this.queues[name].push({ data, options, timestamp: Date.now() });

        // Trigger processing asynchronously without blocking the caller
        this._triggerProcessing(name).catch(err => console.error(`❌ Background processing error in ${name}:`, err));
    }

    async _triggerProcessing(name) {
        if (this.isProcessing[name]) return; // Already running
        
        this.isProcessing[name] = true;

        try {
            while (this.queues[name].length > 0) {
                const job = this.queues[name].shift();
                await this._processJob(name, job.data);
            }
        } catch (error) {
            console.error(`❌ Queue Worker Error [${name}]:`, error);
        } finally {
            this.isProcessing[name] = false;
            // If new items were added while we were stopping
            if (this.queues[name].length > 0) {
                this._triggerProcessing(name);
            }
        }
    }

    async _processJob(name, data) {
        try {
            if (name === 'video-processing') {
                const { videoChunkService } = await import('./videoChunkService.js');
                console.log(`🎬 Processing HLS for video: ${data.videoId}`);
                await videoChunkService.processVideo(data.videoId, data.path, {
                    startTime: data.startTime,
                    endTime: data.endTime,
                    filter: data.filter,
                    audioPath: data.audioPath
                });

                // ✅ تشغيل ذكاء اصطناعي (AI Analysis) بعد اكتمال المعالجة
                const aiService = (await import('./aiService.js')).default;
                console.log(`🤖 AI: Starting analysis for video: ${data.videoId}`);

                const [video] = await executeQuery('SELECT description, category FROM videos WHERE id = ?', [data.videoId]);

                if (video) {
                    await aiService.moderateContent(data.videoId, video.description, []);
                    await aiService.generateSubtitles(data.videoId, data.path);
                }

                console.log(`✅ Queue: Finished HLS and AI processing for ${data.videoId}`);
            }

            if (name === 'thumbnail-generation') {
                const { ThumbnailService } = await import('./thumbnailService.js');
                console.log(`🖼️ Generating thumbnail for video: ${data.videoId}`);
                await ThumbnailService.generateThumbnail(
                    data.videoPath,
                    data.thumbnailsDir,
                    data.thumbFilename,
                    data.thumbnailTimestamp || '00:00:01'
                );
                console.log(`✅ Queue: Finished thumbnail generation for ${data.videoId}`);
            }
        } catch (error) {
            console.error(`❌ Queue: Error processing job [${name}] for video ${data.videoId}:`, error);
        }
    }
}

export const queueService = new QueueService();
export default queueService;
