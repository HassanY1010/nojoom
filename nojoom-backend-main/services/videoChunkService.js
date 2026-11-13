// services/videoChunkService.js
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { pool } from '../config/db.js';
import { getFfmpegOptions, getVideoInfo, qualityPresets } from '../config/ffmpegConfig.js';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * خدمة معالجة وتقسيم الفيديوهات إلى chunks
 */
class VideoChunkService {
    constructor() {
        this.baseChunksDir = path.join(process.cwd(), 'uploads', 'chunks');
        this.ensureChunksDirectory();
    }

    /**
     * التأكد من وجود مجلد chunks
     */
    async ensureChunksDirectory() {
        try {
            if (!fs.existsSync(this.baseChunksDir)) {
                await mkdir(this.baseChunksDir, { recursive: true });
                console.log('✅ Created chunks directory:', this.baseChunksDir);
            }
        } catch (error) {
            console.error('❌ Error creating chunks directory:', error);
        }
    }

    /**
     * معالجة الفيديو وتقسيمه إلى chunks بجودات متعددة
     * @param {number} videoId - معرف الفيديو
     * @param {string} videoPath - مسار الفيديو الأصلي
     * @param {object} editOptions - خيارات إضافية (trimming, filters, audio)
     * @returns {Promise<object>} - نتيجة المعالجة
     */
    async processVideo(videoId, videoPath, editOptions = {}) {
        console.log(`🎬 Starting video processing for video ID: ${videoId}`, editOptions);

        try {
            // تحديث حالة المعالجة إلى "processing"
            await this.updateProcessingStatus(videoId, 'processing');

            // إنشاء مجلد للفيديو
            const videoChunksDir = path.join(this.baseChunksDir, videoId.toString());
            await mkdir(videoChunksDir, { recursive: true });

            // الحصول على معلومات الفيديو
            const videoInfo = await getVideoInfo(videoPath);
            console.log(`📊 Video info:`, videoInfo);

            // معالجة الفيديو بجودات مختلفة - تم التعديل لتكون 720p فقط حسب طلب المستخدم
            const qualities = ['720p'];
            const results = [];

            for (const quality of qualities) {
                const result = await this.processQuality(videoId, videoPath, videoChunksDir, quality, videoInfo, editOptions);
                results.push(result);
            }

            // إنشاء master playlist
            const masterPlaylistPath = await this.createMasterPlaylist(videoId, videoChunksDir, results);

            // حساب إجمالي عدد الـ chunks
            const totalChunks = results.reduce((sum, r) => sum + r.chunkCount, 0);

            // تحديث حالة المعالجة إلى "completed"
            await this.updateProcessingStatus(videoId, 'completed', totalChunks, masterPlaylistPath);

            console.log(`✅ Video processing completed for video ID: ${videoId}`);
            console.log(`📦 Total chunks created: ${totalChunks}`);

            return {
                success: true,
                videoId,
                totalChunks,
                qualities: results,
                masterPlaylist: masterPlaylistPath
            };

        } catch (error) {
            console.error(`❌ Error processing video ${videoId}:`, error);
            await this.updateProcessingStatus(videoId, 'failed', 0, null, error.message);
            throw error;
        }
    }

    /**
     * معالجة الفيديو بجودة محددة
     */
    async processQuality(videoId, videoPath, videoChunksDir, quality, videoInfo, editOptions = {}) {
        console.log(`🔄 Processing quality: ${quality} for video ${videoId}`, editOptions);

        const qualityDir = path.join(videoChunksDir, quality);
        await mkdir(qualityDir, { recursive: true });

        const playlistPath = path.join(qualityDir, 'playlist.m3u8');
        const segmentPattern = path.join(qualityDir, 'segment_%03d.ts');

        const options = getFfmpegOptions(quality);
        const { startTime, endTime, filter, audioPath } = editOptions;

        return new Promise((resolve, reject) => {
            let command = ffmpeg(videoPath);

            // إضافة مسار الصوت إذا وجد
            if (audioPath) {
                const fullAudioPath = path.isAbsolute(audioPath) ? audioPath : path.join(process.cwd(), audioPath);
                if (fs.existsSync(fullAudioPath)) {
                    command = command.input(fullAudioPath);
                    // مزج الصوت الأصلي مع الموسيقى (تخفيض صوت الموسيقى قليلاً)
                    command = command.complexFilter([
                        '[0:a]volume=1.0[a0]',
                        '[1:a]volume=0.5[a1]',
                        '[a0][a1]amix=inputs=2:duration=first[aout]'
                    ]).map('[aout]');
                }
            }

            // تطبيق القص (Trimming)
            if (startTime) command = command.setStartTime(startTime);
            if (endTime) command = command.setDuration(parseFloat(endTime) - (parseFloat(startTime) || 0));

            // تطبيق الفلاتر (Filters)
            if (filter) {
                switch (filter) {
                    case 'grayscale': command = command.videoFilters('colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3'); break;
                    case 'sepia': command = command.videoFilters('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131'); break;
                    case 'brightness': command = command.videoFilters('eq=brightness=0.2'); break;
                    case 'contrast': command = command.videoFilters('eq=contrast=1.5'); break;
                }
            }

            command
                .videoCodec(options.videoCodec)
                .audioCodec(audioPath ? 'aac' : options.audioCodec) // استخدام aac عند الدمج
                .size(options.size)
                .videoBitrate(options.videoBitrate)
                .audioBitrate(options.audioBitrate)
                .fps(options.fps)
                .outputOptions([
                    ...options.outputOptions,
                    '-hls_time 10',
                    '-hls_list_size 0',
                    '-hls_segment_type mpegts',
                    '-hls_flags independent_segments+temp_file',
                    `-hls_segment_filename ${segmentPattern}`
                ])
                .output(playlistPath)
                .on('start', (commandLine) => {
                    console.log(`▶️ FFMPEG command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`⏳ Processing ${quality}: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', async () => {
                    try {
                        // حساب عدد الـ chunks
                        const files = await readdir(qualityDir);
                        const chunks = files.filter(f => f.endsWith('.ts'));
                        const chunkCount = chunks.length;

                        console.log(`✅ Quality ${quality} completed: ${chunkCount} chunks`);

                        // حفظ معلومات الـ chunks في قاعدة البيانات
                        await this.saveChunksToDatabase(videoId, quality, qualityDir, chunks);

                        resolve({
                            quality,
                            chunkCount,
                            playlistPath: `/uploads/chunks/${videoId}/${quality}/playlist.m3u8`,
                            preset: qualityPresets[quality]
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    console.error(`❌ Error processing ${quality}:`, error);
                    reject(error);
                });

            command.run();
        });
    }

    /**
     * حفظ معلومات الـ chunks في قاعدة البيانات
     */
    async saveChunksToDatabase(videoId, quality, qualityDir, chunks) {
        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunkPath = path.join(qualityDir, chunks[i]);
                const stats = await stat(chunkPath);

                await pool.execute(
                    `INSERT INTO video_chunks (video_id, quality, chunk_index, chunk_path, file_size)
           VALUES (?, ?, ?, ?, ?)`,
                    [
                        videoId,
                        quality,
                        i,
                        `/uploads/chunks/${videoId}/${quality}/${chunks[i]}`,
                        stats.size
                    ]
                );
            }
            console.log(`💾 Saved ${chunks.length} chunks to database for quality ${quality}`);
        } catch (error) {
            console.error('❌ Error saving chunks to database:', error);
            throw error;
        }
    }

    /**
     * إنشاء master playlist (HLS)
     */
    async createMasterPlaylist(videoId, videoChunksDir, qualityResults) {
        const masterPlaylistPath = path.join(videoChunksDir, 'master.m3u8');

        let content = '#EXTM3U\n';
        content += '#EXT-X-VERSION:3\n\n';

        // إضافة كل جودة إلى الـ master playlist
        for (const result of qualityResults) {
            const preset = result.preset;
            const bandwidth = parseInt(preset.videoBitrate) * 1000 + parseInt(preset.audioBitrate) * 1000;
            const [width, height] = preset.resolution.split('x');

            content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}\n`;
            content += `${result.quality}/playlist.m3u8\n\n`;
        }

        await writeFile(masterPlaylistPath, content, 'utf8');
        console.log(`📝 Created master playlist: ${masterPlaylistPath}`);

        return `/uploads/chunks/${videoId}/master.m3u8`;
    }

    /**
     * تحديث حالة المعالجة في قاعدة البيانات
     */
    async updateProcessingStatus(videoId, status, totalChunks = 0, manifestPath = null, errorMessage = null) {
        try {
            const manifestPathValue = manifestPath || `/uploads/chunks/${videoId}/master.m3u8`;

            await pool.execute(
                `INSERT INTO video_manifests (video_id, manifest_path, total_chunks, processing_status, error_message)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         processing_status = VALUES(processing_status),
         total_chunks = VALUES(total_chunks),
         error_message = VALUES(error_message),
         updated_at = NOW()`,
                [videoId, manifestPathValue, totalChunks, status, errorMessage]
            );

            console.log(`📊 Updated processing status for video ${videoId}: ${status}`);
        } catch (error) {
            console.error('❌ Error updating processing status:', error);
        }
    }

    /**
     * الحصول على حالة معالجة الفيديو
     */
    async getProcessingStatus(videoId) {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM video_manifests WHERE video_id = ?',
                [videoId]
            );

            return rows[0] || null;
        } catch (error) {
            console.error('❌ Error getting processing status:', error);
            return null;
        }
    }

    /**
     * الحصول على معلومات chunks لفيديو معين
     */
    async getVideoChunks(videoId, quality = null) {
        try {
            let query = 'SELECT * FROM video_chunks WHERE video_id = ?';
            const params = [videoId];

            if (quality) {
                query += ' AND quality = ?';
                params.push(quality);
            }

            query += ' ORDER BY quality, chunk_index';

            const [rows] = await pool.execute(query, params);
            return rows;
        } catch (error) {
            console.error('❌ Error getting video chunks:', error);
            return [];
        }
    }

    /**
     * حذف chunks الفيديو
     */
    async deleteVideoChunks(videoId) {
        try {
            const videoChunksDir = path.join(this.baseChunksDir, videoId.toString());

            if (fs.existsSync(videoChunksDir)) {
                // حذف المجلد وجميع محتوياته
                fs.rmSync(videoChunksDir, { recursive: true, force: true });
                console.log(`🗑️ Deleted chunks directory for video ${videoId}`);
            }

            // حذف من قاعدة البيانات
            await pool.execute('DELETE FROM video_chunks WHERE video_id = ?', [videoId]);
            await pool.execute('DELETE FROM video_manifests WHERE video_id = ?', [videoId]);

            console.log(`✅ Deleted all chunks for video ${videoId}`);
        } catch (error) {
            console.error('❌ Error deleting video chunks:', error);
            throw error;
        }
    }
}

// تصدير instance واحد من الخدمة
export const videoChunkService = new VideoChunkService();
export default videoChunkService;
