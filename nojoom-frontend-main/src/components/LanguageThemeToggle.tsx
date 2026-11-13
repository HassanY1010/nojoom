// components/LanguageThemeToggle.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useLanguageStore } from '../store/useLanguageStore';

const LanguageThemeToggle: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useThemeStore();
    const { currentLanguage, changeLanguage } = useLanguageStore();
  

    const handleLanguageChange = (lang: 'en' | 'ar') => {
        changeLanguage(lang);
        i18n.changeLanguage(lang);
    };

    return (
        <div className="space-y-6">
            {/* Language Selection */}
            <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    🌐 {t('language')}
                </h3>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleLanguageChange('en')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            currentLanguage === 'en'
                                ? theme === 'dark'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-600 text-white'
                                : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                    >
                        🇬🇧 {t('english')}
                    </button>
                    <button
                        onClick={() => handleLanguageChange('ar')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            currentLanguage === 'ar'
                                ? theme === 'dark'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-600 text-white'
                                : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                    >
                        🇸🇦 {t('arabic')}
                    </button>
                </div>
            </div>

            {/* Theme Selection */}
            <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    🎨 {t('appearance')}
                </h3>
                <div className="flex gap-3">
                    <button
                        onClick={() => theme === 'light' ? null : toggleTheme()}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            theme === 'light'
                                ? 'bg-blue-600 text-white'
                                : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                    >
                        ☀️ {t('lightMode')}
                    </button>
                    <button
                        onClick={() => theme === 'dark' ? null : toggleTheme()}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            theme === 'dark'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                    >
                        🌙 {t('darkMode')}
                    </button>
                </div>

                {/* Preview */}
                <div className={`mt-4 p-4 rounded-lg border-2 border-dashed ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {theme === 'dark' ? '🌙 ' : '☀️ '}
                        {t('theme')}: {theme === 'dark' ? t('dark') : t('light')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LanguageThemeToggle;

