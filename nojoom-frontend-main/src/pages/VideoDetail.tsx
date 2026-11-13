import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { Video } from '../types';
import VideoCard from '../components/VideoCard';
import { CardSkeleton } from '../components/Skeletons';
import { useLanguageStore } from '../store/useLanguageStore';

const VideoDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { isRTL } = useLanguageStore();
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVideo = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/videos/${id}`);
                // The backend structure seems to be { video: ... } based on Home.tsx:77
                const videoData = response.data.video || response.data;
                if (videoData) {
                    setVideo(videoData);
                } else {
                    setError(t('failedLoadVideo'));
                }
            } catch (err) {
                console.error('Error fetching video:', err);
                setError(t('failedLoadVideo'));
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchVideo();
        }
    }, [id, t]);

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-[500px]">
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    if (error || !video) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl">⚠️</span>
                </div>
                <h1 className="text-white text-2xl font-bold mb-4">{error || t('failedLoadVideo')}</h1>
                <button
                    onClick={handleBack}
                    className="px-8 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-all"
                >
                    {t('back')}
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center p-0 lg:p-4"
        >
            {/* Back Button */}
            <button
                onClick={handleBack}
                className={`fixed top-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-xl ${isRTL ? 'right-6' : 'left-6'
                    }`}
                title={t('back')}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                </svg>
            </button>

            <div className="w-full h-screen lg:h-auto lg:max-w-[500px] relative">
                <VideoCard
                    video={video}
                    isActive={true}
                    autoPlay={true}
                    showUserInfo={true}
                />
            </div>
        </motion.div>
    );
};

export default VideoDetail;

