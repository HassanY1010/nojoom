// services/aiService.js
import { executeQuery } from '../config/db.js';
import path from 'path';
import fs from 'fs';

class AIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    }

    /**
     * Suggests a video title based on description and category
     */
    async suggestTitle(description, category) {
        console.log('🤖 AI: Suggesting title for:', description);

        // Placeholder logic - In a real app, this would call Gemini/OpenAI
        // Example: const response = await gemini.generateText(`Suggest a catchy title for this ${category} video: ${description}`);

        const catchphrases = [
            'أفضل لحظات', 'تحدي جديد في', 'سر النجاح في', 'استكشف عالم', 'كيف تصبح محترفاً في'
        ];
        const prefix = catchphrases[Math.floor(Math.random() * catchphrases.length)];

        return `${prefix} ${description.substring(0, 30)}${description.length > 30 ? '...' : ''}`;
    }

    /**
     * Automatically moderates content (description, hashtags, etc.)
     */
    async moderateContent(videoId, description, hashtags) {
        console.log(`🤖 AI: Moderating video ID: ${videoId}`);

        const blacklistedWords = ['badword1', 'badword2', 'violence', 'hate']; // Simple placeholder
        const foundFlags = [];

        const content = `${description} ${JSON.stringify(hashtags)}`.toLowerCase();

        blacklistedWords.forEach(word => {
            if (content.includes(word)) {
                foundFlags.push(word);
            }
        });

        const score = foundFlags.length > 0 ? 0.9 : 0.1; // 0.9 = high probability of violation

        await executeQuery(
            'UPDATE videos SET ai_moderation_score = ?, ai_moderation_flags = ? WHERE id = ?',
            [score, JSON.stringify(foundFlags), videoId]
        );

        return { score, flags: foundFlags };
    }

    /**
     * Placeholder for Subtitle Generation
     * In a real implementation, this would use Whisper API or Gemini 1.5 Pro
     */
    async generateSubtitles(videoId, videoPath) {
        console.log(`🤖 AI: Generating subtitles for video ID: ${videoId}`);

        // Simulate processing time
        // This would typically involve:
        // 1. Extracting audio from video using FFmpeg
        // 2. Sending audio to Speech-to-Text API
        // 3. saving SRT/VTT file

        const subtitlesPath = `/uploads/videos/subtitles/sub_${videoId}.vtt`;

        // Mock VTT content
        const mockVtt = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n[AI Generated Subtitles]\nWelcome to Nojoom!`;

        const fullSubPath = path.join(process.cwd(), 'public', 'uploads', 'videos', 'subtitles');
        if (!fs.existsSync(fullSubPath)) {
            fs.mkdirSync(fullSubPath, { recursive: true });
        }

        fs.writeFileSync(path.join(fullSubPath, `sub_${videoId}.vtt`), mockVtt);

        await executeQuery(
            'UPDATE videos SET subtitles_path = ?, ai_transcription = ? WHERE id = ?',
            [subtitlesPath, 'Welcome to Nojoom!', videoId]
        );

        return subtitlesPath;
    }

    /**
     * Analyzes content trends based on interactions and categories
     */
    async analyzeTrends() {
        console.log('🤖 AI: Analyzing content trends...');

        const sql = `
      SELECT category, COUNT(*) as count, SUM(views) as total_views
      FROM videos
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY category
      ORDER BY total_views DESC
    `;

        const stats = await executeQuery(sql);
        return stats;
    }
}

export default new AIService();
