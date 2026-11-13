import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getMediaUrl } from '../utils/urlUtils';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

interface Stream {
    id: number;
    host_id: number;
    username: string;
    avatar: string;
    title: string;
    viewers_count: number;
    started_at: string;
}

const LiveDiscovery: React.FC = () => {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { t } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        fetchActiveStreams();
        const interval = setInterval(fetchActiveStreams, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchActiveStreams = async () => {
        try {
            const response = await api.get('/live/active');
            setStreams(response.data.streams);
        } catch (error) {
            console.error('Failed to fetch active streams:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 pt-20 sm:p-8 sm:pt-24">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"></span>
                            {t('liveNow')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {t('discoverLiveMsg')}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/live/host')}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20 flex items-center gap-2"
                    >
                        <span>📹</span>
                        {t('goLive')}
                    </button>
                </header>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : streams.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <div className="text-6xl mb-4">📺</div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('noActiveStreams')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {t('beTheFirstLive')}
                        </p>
                        <button
                            onClick={() => navigate('/live/host')}
                            className="mt-6 text-red-500 font-bold hover:underline"
                        >
                            {t('startStreamingNow')}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {streams.map((stream) => (
                            <motion.div
                                key={stream.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ y: -5 }}
                                onClick={() => navigate(`/live/${stream.id}`)}
                                className="group relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 cursor-pointer transition-all"
                            >
                                {/* Preview Thumbnail (Placeholder) */}
                                <div className="aspect-[9/16] bg-gray-200 dark:bg-gray-800 relative">
                                    <img
                                        src={getMediaUrl(stream.avatar)}
                                        alt={stream.username}
                                        className="w-full h-full object-cover blur-sm opacity-50"
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <img
                                            src={getMediaUrl(stream.avatar)}
                                            alt={stream.username}
                                            className="w-20 h-20 rounded-full border-4 border-red-500 shadow-2xl"
                                        />
                                        <div className="mt-4 bg-red-600 text-white text-xs px-2 py-1 rounded-lg font-black uppercase tracking-wider animate-pulse">
                                            LIVE
                                        </div>
                                    </div>

                                    {/* Overlay Info */}
                                    <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                        <h3 className="text-white font-bold text-lg line-clamp-1">{stream.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-red-400">👤</span>
                                            <span className="text-gray-300 text-sm">{stream.username}</span>
                                        </div>
                                    </div>

                                    {/* Viewers Badge */}
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                        {stream.viewers_count} {t('viewers')}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveDiscovery;
