import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';

const FontTest: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { currentLanguage, changeLanguage } = useLanguageStore();

    const arabicText = "مرحباً بك في نجوم! هذا نص عربي بخط Tajawal الجميل. نجوم هي منصة فيديوهات قصيرة تفاعلية مثل TikTok.";
    const englishText = "Welcome to Nojoom! This is English text in Poppins font. Nojoom is an interactive short video platform like TikTok.";

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        {currentLanguage === 'ar' ? 'اختبار الخطوط' : 'Font Test'}
                    </h1>
                    <p className="text-gray-300 text-lg">
                        {currentLanguage === 'ar'
                            ? 'اختبر تبديل الخطوط بين العربية (Tajawal) والإنجليزية (Poppins)'
                            : 'Test font switching between Arabic (Tajawal) and English (Poppins)'}
                    </p>
                </div>

                {/* Language Switcher */}
                <div className="flex justify-center gap-4 mb-12">
                    <button
                        onClick={() => changeLanguage('ar')}
                        className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${currentLanguage === 'ar'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        العربية (Tajawal)
                    </button>
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${currentLanguage === 'en'
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        English (Poppins)
                    </button>
                </div>

                {/* Font Display Cards */}
                <div className="space-y-6">
                    {/* Arabic Text Card */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">نص عربي - Tajawal</h2>
                            <span className="px-4 py-2 bg-purple-600/30 text-purple-200 rounded-full text-sm font-medium">
                                Tajawal Font
                            </span>
                        </div>
                        <p className="text-white text-xl leading-relaxed mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                            {arabicText}
                        </p>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Light (300)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 300 }}>
                                    نجوم
                                </p>
                            </div>
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Regular (400)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 400 }}>
                                    نجوم
                                </p>
                            </div>
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Bold (700)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 700 }}>
                                    نجوم
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* English Text Card */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">English Text - Poppins</h2>
                            <span className="px-4 py-2 bg-blue-600/30 text-blue-200 rounded-full text-sm font-medium">
                                Poppins Font
                            </span>
                        </div>
                        <p className="text-white text-xl leading-relaxed mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            {englishText}
                        </p>
                        <div className="grid grid-cols-4 gap-4 mt-6">
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Light (300)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}>
                                    Nojoom
                                </p>
                            </div>
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Regular (400)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}>
                                    Nojoom
                                </p>
                            </div>
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Medium (500)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>
                                    Nojoom
                                </p>
                            </div>
                            <div className="text-center p-4 bg-black/30 rounded-lg">
                                <p className="text-gray-400 text-sm mb-2">Bold (700)</p>
                                <p className="text-white text-2xl" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
                                    Nojoom
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mixed Text Card */}
                    <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/30">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            {currentLanguage === 'ar' ? 'نص مختلط' : 'Mixed Text'}
                        </h2>
                        <div className="space-y-4">
                            <p className="text-white text-lg leading-relaxed">
                                Welcome مرحباً Nojoom نجوم Platform منصة Videos فيديوهات
                            </p>
                            <p className="text-gray-300 text-sm">
                                {currentLanguage === 'ar'
                                    ? 'لاحظ كيف يتم عرض النص العربي بخط Tajawal والنص الإنجليزي بخط Poppins تلقائياً'
                                    : 'Notice how Arabic text is displayed in Tajawal and English text in Poppins automatically'}
                            </p>
                        </div>
                    </div>

                    {/* Current Font Info */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {currentLanguage === 'ar' ? 'معلومات الخط الحالي' : 'Current Font Information'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-gray-400 text-sm mb-1">
                                    {currentLanguage === 'ar' ? 'اللغة الحالية' : 'Current Language'}
                                </p>
                                <p className="text-white font-bold text-lg">
                                    {currentLanguage === 'ar' ? 'العربية' : 'English'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm mb-1">
                                    {currentLanguage === 'ar' ? 'الخط المستخدم' : 'Font in Use'}
                                </p>
                                <p className="text-white font-bold text-lg">
                                    {currentLanguage === 'ar' ? 'Tajawal' : 'Poppins'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm mb-1">
                                    {currentLanguage === 'ar' ? 'الاتجاه' : 'Direction'}
                                </p>
                                <p className="text-white font-bold text-lg">
                                    {currentLanguage === 'ar' ? 'RTL (من اليمين لليسار)' : 'LTR (Left to Right)'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm mb-1">
                                    {currentLanguage === 'ar' ? 'حالة الخط' : 'Font Status'}
                                </p>
                                <p className="text-green-400 font-bold text-lg flex items-center gap-2">
                                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                                    {currentLanguage === 'ar' ? 'نشط' : 'Active'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-12 bg-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-blue-300 mb-3">
                        {currentLanguage === 'ar' ? '📝 تعليمات الاختبار' : '📝 Test Instructions'}
                    </h3>
                    <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>
                                {currentLanguage === 'ar'
                                    ? 'انقر على أزرار اللغة أعلاه لتبديل اللغة والخط'
                                    : 'Click the language buttons above to switch language and font'}
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>
                                {currentLanguage === 'ar'
                                    ? 'لاحظ كيف يتغير الخط تلقائياً عند تغيير اللغة'
                                    : 'Notice how the font changes automatically when you switch languages'}
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>
                                {currentLanguage === 'ar'
                                    ? 'العربية تستخدم خط Tajawal، والإنجليزية تستخدم خط Poppins'
                                    : 'Arabic uses Tajawal font, English uses Poppins font'}
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>
                                {currentLanguage === 'ar'
                                    ? 'يتم تطبيق هذا التبديل تلقائياً في جميع صفحات التطبيق'
                                    : 'This switching is applied automatically across all app pages'}
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default FontTest;

