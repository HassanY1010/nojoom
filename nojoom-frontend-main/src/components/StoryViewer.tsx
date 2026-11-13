import React, { useEffect, useState, useCallback } from 'react';
import { storyApi } from '../services/api';
import './StoryViewer.css';

interface Story {
    id: number;
    media_url: string;
    media_type: 'image' | 'video';
    created_at: string;
}

interface StoryViewerProps {
    userId: number;
    username: string;
    onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ userId, username, onClose }) => {
    const [stories, setStories] = useState<Story[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);

    // Helper function to get full media URL
    const getFullMediaUrl = (url: string): string => {
        if (url.startsWith('http')) return url;
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://192.168.0.198:3333/api';
        const backendUrl = apiBaseUrl.replace('/api', '');
        const fullUrl = `${backendUrl}${url}`;
        console.log('🔗 Media URL:', url, '→', fullUrl);
        return fullUrl;
    };

    const fetchStories = useCallback(async () => {
        try {
            console.log('📥 Fetching stories for user:', userId, username);
            const response = await storyApi.getUserStories(userId);
            console.log('✅ User stories response:', response.data);

            if (response.data.success) {
                setStories(response.data.data);
                console.log('📊 Stories loaded:', response.data.data.length, 'stories');
                console.log('Media URLs:', response.data.data.map((s: Story) => s.media_url));
            }
        } catch (error: any) {
            console.error('❌ Failed to fetch stories:', error);
            console.error('Error details:', error.response?.data || error.message);
            onClose();
        } finally {
            setLoading(false);
        }
    }, [userId, username, onClose]);

    useEffect(() => {
        fetchStories();
    }, [fetchStories]);

    useEffect(() => {
        if (stories.length === 0) return;

        const duration = 5000; // 5 seconds per story
        const interval = 50; // Update every 50ms
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    if (currentIndex < stories.length - 1) {
                        setCurrentIndex((idx) => idx + 1);
                        return 0;
                    } else {
                        onClose();
                        return 100;
                    }
                }
                return prev + step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [stories, currentIndex, onClose]);

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setProgress(0);
        }
    };

    if (loading) return <div className="story-viewer-loading">Loading...</div>;
    if (stories.length === 0) return null;

    const currentStory = stories[currentIndex];

    return (
        <div className="story-viewer-overlay">
            <div className="story-viewer-container">
                {/* Progress Bars */}
                <div className="story-progress-container">
                    {stories.map((_, index) => (
                        <div key={index} className="story-progress-bar-bg">
                            <div
                                className="story-progress-bar-fill"
                                style={{
                                    width: index < currentIndex ? '100%' : (index === currentIndex ? `${progress}%` : '0%')
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="story-header">
                    <span className="story-viewer-username">{username}</span>
                    <button className="story-close-btn" onClick={onClose}>×</button>
                </div>

                {/* Content */}
                <div className="story-content" onClick={(e) => {
                    const x = e.clientX;
                    const width = window.innerWidth;
                    if (x < width / 3) handlePrev();
                    else handleNext();
                }}>
                    {currentStory.media_type === 'image' ? (
                        <img
                            src={getFullMediaUrl(currentStory.media_url)}
                            alt="Story"
                            className="story-media"
                            onError={(e) => {
                                console.error('❌ Failed to load image:', currentStory.media_url);
                                console.error('Full URL:', getFullMediaUrl(currentStory.media_url));
                            }}
                        />
                    ) : (
                        <video
                            src={getFullMediaUrl(currentStory.media_url)}
                            autoPlay
                            muted
                            className="story-media"
                            onEnded={handleNext}
                            onError={(e) => {
                                console.error('❌ Failed to load video:', currentStory.media_url);
                                console.error('Full URL:', getFullMediaUrl(currentStory.media_url));
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoryViewer;
