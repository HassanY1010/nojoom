// components/AIPrivacyControl.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiTrackingService from '../services/aiTrackingService';

interface AIPrivacyControlProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIPrivacyControl: React.FC<AIPrivacyControlProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        eyeTrackingEnabled: false,
        voiceTrackingEnabled: false,
        scrollTrackingEnabled: true
    });

    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // تحميل الإعدادات والإحصائيات
    useEffect(() => {
        if (isOpen) {
            loadSettings();
            loadStats();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const profile = await aiTrackingService.getAIProfile();
            if (profile && profile.profile) {
                setSettings({
                    eyeTrackingEnabled: profile.profile.eye_tracking_enabled || false,
                    voiceTrackingEnabled: profile.profile.voice_tracking_enabled || false,
                    scrollTrackingEnabled: profile.profile.scroll_tracking_enabled !== false
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const loadStats = async () => {
        try {
            const statsData = await aiTrackingService.getAIStats();
            if (statsData && statsData.stats) {
                setStats(statsData.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleToggle = async (key: keyof typeof settings) => {
        const newSettings = {
            ...settings,
            [key]: !settings[key]
        };

        setSettings(newSettings);

        try {
            await aiTrackingService.updateAISettings(newSettings);
        } catch (error) {
            console.error('Error updating settings:', error);
            // إعادة القيمة السابقة في حالة الخطأ
            setSettings(settings);
        }
    };

    const handleDeleteData = async () => {
        if (!confirm('هل أنت متأكد من حذف جميع بيانات الذكاء الاصطناعي؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        setLoading(true);
        try {
            await aiTrackingService.deleteAIData();
            alert('تم حذف جميع البيانات بنجاح');
            setStats(null);
            loadStats();
        } catch (error) {
            console.error('Error deleting data:', error);
            alert('فشل حذف البيانات');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                🤖 إعدادات الذكاء الاصطناعي
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                تحكم في كيفية استخدام بياناتك لتحسين التوصيات
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Privacy Notice */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🔒</span>
                                <div>
                                    <h3 className="text-blue-400 font-semibold mb-1">خصوصيتك أولويتنا</h3>
                                    <p className="text-gray-300 text-sm">
                                        نحن نهتم بخصوصيتك ولا نطلب صلاحيات الكاميرا أو الميكروفون أبداً. نعتمد فقط على تفاعلاتك الطبيعية والآمنة مثل مدة المشاهدة، إكمال الفيديو، الإعجابات، التعليقات، المشاركات، والمتابعة لتحسين توصياتك الشخصية.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Settings */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">إعدادات التتبع</h3>

                            {/* Scroll Tracking */}
                            <div className="bg-gray-800 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📱</span>
                                            <h4 className="text-white font-medium">تتبع سلوك التمرير</h4>
                                        </div>
                                        <p className="text-gray-400 text-sm mt-1">
                                            تحليل سرعة التمرير لفهم مستوى اهتمامك
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggle('scrollTrackingEnabled')}
                                        className={`relative w-14 h-7 rounded-full transition-colors ${settings.scrollTrackingEnabled ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <motion.div
                                            animate={{ x: settings.scrollTrackingEnabled ? 28 : 2 }}
                                            className="absolute top-1 w-5 h-5 bg-white rounded-full"
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        {stats && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white">إحصائيات البيانات</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800 rounded-xl p-4">
                                        <p className="text-gray-400 text-sm">نقاط البيانات</p>
                                        <p className="text-2xl font-bold text-white mt-1">
                                            {stats.totalDataPoints || 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-800 rounded-xl p-4">
                                        <p className="text-gray-400 text-sm">دقة النموذج</p>
                                        <p className="text-2xl font-bold text-blue-400 mt-1">
                                            {stats.modelAccuracy ? `${stats.modelAccuracy.toFixed(1)}%` : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delete Data */}
                        <div className="border-t border-gray-800 pt-6">
                            <button
                                onClick={handleDeleteData}
                                disabled={loading}
                                className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl py-3 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'جاري الحذف...' : '🗑️ حذف جميع بيانات الذكاء الاصطناعي'}
                            </button>
                            <p className="text-gray-500 text-xs text-center mt-2">
                                سيتم حذف جميع بيانات التتبع والتوصيات بشكل دائم
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AIPrivacyControl;
