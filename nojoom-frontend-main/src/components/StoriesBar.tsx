import React, { useEffect, useState } from 'react';
import { storyApi } from '../services/api';
import './StoriesBar.css';

import StoryViewer from './StoryViewer';

interface StoryUser {
    user_id: number;
    username: string;
    avatar: string;
    active_stories_count: number;
}

const StoriesBar: React.FC = () => {
    const [stories, setStories] = useState<StoryUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<StoryUser | null>(null);

    // Helper function to get full avatar URL
    const getFullAvatarUrl = (url: string): string => {
        if (!url || url.startsWith('http')) return url || '/default-avatar.png';
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://192.168.0.198:3333/api';
        const backendUrl = apiBaseUrl.replace('/api', '');
        return `${backendUrl}${url}`;
    };

    useEffect(() => {
        fetchStories();
    }, []);

    const fetchStories = async () => {
        try {
            console.log('📥 Fetching stories feed...');
            const response = await storyApi.getFeed();
            console.log('✅ Stories feed response:', response.data);

            if (response.data.success) {
                setStories(response.data.data);
                console.log('📊 Stories loaded:', response.data.data.length, 'users with active stories');
                console.log('Avatar URLs:', response.data.data.map((u: StoryUser) => ({ username: u.username, avatar: u.avatar })));
            }
        } catch (error: any) {
            console.error('❌ Failed to fetch stories:', error);
            console.error('Error details:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadStory = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    console.log('📤 Uploading story:', {
                        name: file.name,
                        type: file.type,
                        size: file.size
                    });

                    const response = await storyApi.createStory(file);
                    console.log('✅ Upload response:', response.data);

                    if (response.data.success) {
                        console.log('🔄 Refreshing stories feed...');
                        await fetchStories();
                        alert('Story posted successfully!');
                    }
                } catch (error: any) {
                    console.error('❌ Failed to upload story:', error);
                    console.error('Error details:', error.response?.data || error.message);
                    alert('Failed to post story: ' + (error.response?.data?.error || error.message));
                }
            }
        };
        input.click();
    };

    if (loading && stories.length === 0) return null;

    return (
        <div className="stories-container">
            <div className="stories-scroll">
                {/* My Story Add Button */}
                <div className="story-item add-story" onClick={handleUploadStory}>
                    <div className="story-avatar-container">
                        <div className="add-icon">+</div>
                    </div>
                    <span className="story-username">قصتك</span>
                </div>

                {/* Following Stories */}
                {stories.map((storyUser) => (
                    <div
                        key={storyUser.user_id}
                        className="story-item"
                        onClick={() => setSelectedUser(storyUser)}
                    >
                        <div className="story-avatar-container active">
                            <img
                                src={getFullAvatarUrl(storyUser.avatar)}
                                alt={storyUser.username}
                                className="story-avatar"
                                onError={(e) => {
                                    console.error('❌ Failed to load avatar:', storyUser.avatar);
                                    console.error('Full URL:', getFullAvatarUrl(storyUser.avatar));
                                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                                }}
                            />
                        </div>
                        <span className="story-username">{storyUser.username}</span>
                    </div>
                ))}
            </div>

            {selectedUser && (
                <StoryViewer
                    userId={selectedUser.user_id}
                    username={selectedUser.username}
                    onClose={() => setSelectedUser(null)}
                />
            )}
        </div>
    );
};

export default StoriesBar;
