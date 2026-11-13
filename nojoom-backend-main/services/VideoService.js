import path from 'path';
import fs from 'fs';
import { Video } from '../models/Video.js';
import VideoRepository from '../repositories/VideoRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import { auditService } from './auditService.js';
import { addVideoProcessingJob, addThumbnailJob } from './bullQueueService.js';
import storageService from './storageService.js';

export const VideoService = {
    /**
     * بناء الرابط الكامل للملف
     */
    getFullUrl(baseUrl, pathStr) {
        if (!pathStr || pathStr.startsWith('http')) return pathStr;
        return `${baseUrl}${pathStr.startsWith('/') ? '' : '/'}${pathStr}`;
    },

    /**
     * توحيد بيانات الفيديو
     */
    standardizeVideo(baseUrl, video) {
        if (!video) return video || { id: finalVideoId, ...videoData };

        if (!video.video_url?.startsWith('http')) {
            let videoFilename = video.path || (video.video_url ? path.basename(video.video_url) : '');
            if (videoFilename && (videoFilename.startsWith('http') || videoFilename.includes('/'))) {
                videoFilename = path.basename(videoFilename);
            }

            if (videoFilename) {
                video.video_url = this.getFullUrl(baseUrl, `/uploads/videos/${videoFilename}`);
            } else {
                video.video_url = video.video_url || '/default-video.mp4';
            }
        }

        let thumbFilename = video.thumbnail ? path.basename(video.thumbnail) : '';
        if (thumbFilename) {
            thumbFilename = path.basename(thumbFilename);
            if (thumbFilename.includes('default')) {
                video.thumbnail = this.getFullUrl(baseUrl, '/default-thumbnail.jpg');
            } else {
                video.thumbnail = this.getFullUrl(baseUrl, `/uploads/videos/thumbnails/${thumbFilename}`);
            }
        } else {
            video.thumbnail = this.getFullUrl(baseUrl, '/default-thumbnail.jpg');
        }

        let avatarUrl = video.avatar || '/default-avatar.png';
        if (avatarUrl) {
            const avatarFilename = path.basename(avatarUrl);
            if (avatarFilename.includes('default')) {
                video.avatar = this.getFullUrl(baseUrl, '/default-avatar.png');
            } else {
                video.avatar = this.getFullUrl(baseUrl, `/uploads/avatars/${avatarFilename}`);
            }
        }

        video.likes = parseInt(video.likes) || 0;
        video.views = parseInt(video.views) || 0;
        video.comment_count = parseInt(video.comment_count) || 0;

        return video || { id: finalVideoId, ...videoData };
    },

    /**
     * تسجيل مشاركة الفيديو
     */
    async addShare(videoId, userId, shareMethod = 'direct') {
        const hasShared = await Video.hasUserShared(videoId, userId);
        if (!hasShared) {
            const shareRecorded = await Video.addShare(videoId, userId);
            if (shareRecorded) {
                try {
                    const { recommendationEngine } = await import('./recommendationEngine.js');
                    await recommendationEngine.recordInteraction({
                        userId,
                        videoId: parseInt(videoId),
                        type: 'share',
                        weight: 1.5,
                        metadata: { shareMethod },
                        timestamp: new Date()
                    });
                } catch (recError) {
                    await Video.recordUserInteraction(userId, videoId, 'share', 1.5);
                }
            }
        }
        return { alreadyShared: hasShared, shareCount: await Video.getShareCount(videoId) };
    },

    /**
     * رفع فيديو جديد أو تحديث فيديو موجود
     */
    async uploadVideo(userData, fileData, options) {
        const { userId, tenantId, userCountry } = userData;
        const activeTenantId = tenantId || 1;
        const { filename, path: videoAbsolutePath } = fileData;
        const { 
            description, title, duration, category, 
            replaceVideoId, startTime, endTime, filter, 
            thumbnailTimestamp, audioPath 
        } = options;

        const storedVideo = await storageService.save(
            { filename, path: videoAbsolutePath, mimetype: fileData.mimetype },
            'videos'
        );

        const thumbFilename = `thumb_${filename}.jpg`;
        const thumbRelativeUrl = `/uploads/videos/thumbnails/${thumbFilename}`;
        const videoUrl = storedVideo.url;

        const videoData = {
            tenant_id: activeTenantId,
            user_id: userId,
            video_url: videoUrl,
            thumbnail: thumbRelativeUrl,
            description: description || '',
            title: title || 'بدون عنوان',
            duration: (endTime && startTime) ? (parseFloat(endTime) - parseFloat(startTime)) : (parseFloat(duration) || 0),
            is_public: true,
            path: storedVideo.key || filename,
            category: category || 'general',
            country: userCountry || 'Global'
        };

        let finalVideoId;
        if (replaceVideoId) {
            await VideoRepository.updateVideo(replaceVideoId, userId, videoData);
            finalVideoId = replaceVideoId;
        } else {
            finalVideoId = await Video.create(videoData);
        }

        // إضافة لمهام المعالجة (BullMQ مع Fallback تلقائي للـ In-Memory)
        try {
            const thumbJob = await addThumbnailJob({
                videoId: finalVideoId,
                videoPath: videoAbsolutePath,
                thumbnailsDir: path.join(process.cwd(), 'uploads', 'videos', 'thumbnails'),
                thumbFilename,
                thumbnailTimestamp
            });
            console.log(`🖼️  Thumbnail job dispatched via [${thumbJob.provider}]`);

            const videoJob = await addVideoProcessingJob({
                videoId: finalVideoId,
                path: videoAbsolutePath,
                startTime,
                endTime,
                filter,
                audioPath
            });
            console.log(`🎬 Video processing job dispatched via [${videoJob.provider}]`);
        } catch (queueErr) {
            console.error('⚠️  Queue dispatch failed, triggering direct processing fallback:', queueErr.message);
            setTimeout(async () => {
                const { videoChunkService } = await import('./videoChunkService.js');
                videoChunkService.processVideo(finalVideoId, videoAbsolutePath).catch(console.error);
            }, 1000);
        }

        const video = await Video.findById(finalVideoId, activeTenantId);
        return video || { id: finalVideoId, ...videoData };
    },

    /**
     * الحصول على الفيديوهات الموصى بها
     */
    async getRecommendedVideos(userId, tenantId, limit) {
        let recommendedVideos = [];

        try {
            const { recommendationEngine } = await import('./recommendationEngine.js');
            recommendedVideos = await recommendationEngine.getRecommendedVideos(userId, limit);
        } catch (recErr) {
            console.warn('⚠️ Engine failed:', recErr.message);
        }

        if (!recommendedVideos?.length) {
            const [followingVideos, popularVideos] = await Promise.allSettled([
                Video.getVideosFromFollowingUsers(userId, tenantId, Math.floor(limit * 0.6)),
                Video.getMostViewedVideos(tenantId, Math.floor(limit * 0.4))
            ]).then(results =>
                results.map(r => (r.status === 'fulfilled' ? r.value : []))
            );
            recommendedVideos = [...followingVideos, ...popularVideos];
        }

        if (!recommendedVideos.length) {
            recommendedVideos = await Video.getVideos(tenantId, limit, 0, userId);
        }

        // إزالة التكرار
        const uniqueMap = new Map();
        for (const v of recommendedVideos) {
            if (!uniqueMap.has(v.id)) uniqueMap.set(v.id, v);
        }
        
        const videos = Array.from(uniqueMap.values()).slice(0, limit);
        
        // إضافة عدد التعليقات
        for (const v of videos) {
            v.comment_count = await VideoRepository.getCommentCount(v.id);
        }

        return videos;
    }
};

export default VideoService;
