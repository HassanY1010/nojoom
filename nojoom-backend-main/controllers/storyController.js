import { Story } from '../models/Story.js';
import storageService from '../services/storageService.js';

export const storyController = {
    async createStory(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Media file is required' });
            }

            const user_id = req.user.id;
            let media_url = `/uploads/stories/${req.file.filename}`;
            if (['s3', 'supabase'].includes((process.env.STORAGE_PROVIDER || '').toLowerCase())) {
                const stored = await storageService.save(req.file, 'stories');
                media_url = stored.url;
            }
            const media_type = req.file.mimetype.startsWith('image') ? 'image' : 'video';

            const storyId = await Story.create({ tenant_id: req.tenantId, user_id, media_url, media_type });

            console.log('✅ Story created successfully:', {
                storyId,
                user_id,
                media_url,
                media_type,
                filename: req.file.filename
            });

            res.status(201).json({
                success: true,
                message: 'Story posted successfully',
                data: { id: storyId, media_url, media_type }
            });
        } catch (error) {
            console.error('❌ Create story error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async getStoriesFeed(req, res) {
        try {
            const userId = req.user.id;
            const overview = await Story.getStoriesOverview(userId, req.tenantId);

            console.log('📊 Stories feed retrieved:', {
                userId,
                storiesCount: overview.length,
                users: overview.map(u => ({ user_id: u.user_id, username: u.username, stories: u.active_stories_count }))
            });

            res.json({
                success: true,
                data: overview
            });
        } catch (error) {
            console.error('❌ Get stories feed error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async getUserStories(req, res) {
        try {
            const { userId } = req.params;
            const stories = await Story.getActiveByUser(userId, req.tenantId);

            res.json({
                success: true,
                data: stories
            });
        } catch (error) {
            console.error('Get user stories error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async deleteStory(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const success = await Story.delete(id, userId, req.tenantId);

            if (success) {
                res.json({ success: true, message: 'Story deleted successfully' });
            } else {
                res.status(403).json({ error: 'Not authorized or story not found' });
            }
        } catch (error) {
            console.error('Delete story error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async viewStory(req, res) {
        try {
            const { id } = req.params;
            await Story.incrementViews(id);
            res.json({ success: true });
        } catch (error) {
            console.error('View story error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
