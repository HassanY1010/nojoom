import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useLanguageStore } from '../store/useLanguageStore';
import api from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId }) => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { changeLanguage, currentLanguage } = useLanguageStore();

  const [activeTab, setActiveTab] = useState<'appearance' | 'privacy' | 'security' | 'account'>('appearance');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // إعدادات الخصوصية
  const [privacySettings, setPrivacySettings] = useState({
    is_private: false,
    allow_dms: true,
    show_activity_status: true
  });

  // تغيير كلمة المرور
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // حذف الحساب
  const [deletePassword, setDeletePassword] = useState('');

  // جلب إعدادات الخصوصية عند فتح المودال
  useEffect(() => {
    if (isOpen && activeTab === 'privacy') {
      fetchPrivacySettings();
    }
  }, [isOpen, activeTab]);

  const fetchPrivacySettings = async () => {
    try {
      const response = await api.get('/users/privacy-settings');
      if (response.data.success) {
        setPrivacySettings(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch privacy settings:', error);
      setMessage(t('failedToLoadSettings') || 'Failed to load settings');
    }
  };

  const handleLanguageChange = async (lang: 'en' | 'ar') => {
    changeLanguage(lang);
    i18n.changeLanguage(lang);

    // Sync with backend
    try {
      await api.put('/users/appearance', { language: lang });
    } catch (error) {
      console.error('Failed to sync language preference:', error);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    if (theme !== newTheme) {
      toggleTheme();
      // Sync with backend
      try {
        await api.put('/users/appearance', { theme: newTheme });
      } catch (error) {
        console.error('Failed to sync theme preference:', error);
      }
    }
  };

  const handlePrivacySettingChange = (key: keyof typeof privacySettings, value: boolean) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSavePrivacySettings = async () => {
    try {
      setLoading(true);
      const response = await api.put('/users/privacy-settings', privacySettings);

      if (response.data.success) {
        setMessage(t('privacySettingsUpdated') || 'Privacy settings updated successfully');
      } else {
        setMessage(t('failedToUpdateSettings') || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      setMessage(t('failedToUpdateSettings') || 'Failed to update settings');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setMessage(t('fillAllFields') || 'Please fill all fields');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage(t('passwordMinLength') || 'Password must be at least 6 characters');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage(t('passwordsDoNotMatch') || 'Passwords do not match');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setLoading(true);
      const response = await api.put('/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data.success) {
        setMessage(t('passwordChangedSuccess') || 'Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setMessage(response.data.message || t('failedToChangePassword') || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      setMessage(error.response?.data?.message || t('failedToChangePassword') || 'Failed to change password');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDownloadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/download-data', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'my_nojoom_data.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage(t('downloadStarted') || 'Download started');
    } catch (error) {
      console.error('Failed to download data:', error);
      setMessage(t('failedDownloadData') || 'Failed to download data');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage(t('enterPasswordToDelete') || 'Please enter your password to delete account');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!window.confirm(t('confirmAccountDeletion') || 'Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete('/users/account', {
        data: { password: deletePassword }
      });

      if (response.data.success) {
        setMessage(t('accountDeletedSuccess') || 'Account deleted successfully');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setMessage(response.data.message || t('failedDeleteAccount') || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      setMessage(error.response?.data?.message || t('failedDeleteAccount') || 'Failed to delete account');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-white/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="rounded-xl sm:rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border shadow-2xl bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black border-gray-200 dark:border-gray-700/50 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50 dark:bg-black/50 border-gray-100 dark:border-gray-700/50 transition-colors">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white transition-colors">
              {t('settings')}
            </h2>
            <p className="text-xs sm:text-sm mt-1 text-gray-500 dark:text-gray-400 transition-colors">
              {t('manageAccountPreferences')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl sm:text-2xl w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row h-[500px] sm:h-[600px]">
          {/* Sidebar - Mobile Tabs */}
          <div className="md:hidden border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex overflow-x-auto p-2 space-x-1">
              {[
                { id: 'appearance', icon: '🎨', label: t('appearance') },
                { id: 'privacy', icon: '🔒', label: t('privacy') },
                { id: 'security', icon: '🛡️', label: t('security') },
                { id: 'account', icon: '👤', label: t('account') }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-bold transition-all ${activeTab === tab.id
                    ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar - Desktop */}
          <div className="hidden md:block w-full md:w-1/3 lg:w-1/4 border-r p-4 bg-gray-50/50 dark:bg-black/30 border-gray-100 dark:border-gray-700/50 transition-colors">
            <div className="space-y-2">
              {[
                { id: 'appearance', icon: '🎨', label: t('appearance'), desc: t('theme') + ' & ' + t('language') },
                { id: 'privacy', icon: '🔒', label: t('privacy'), desc: t('privacySettings') },
                { id: 'security', icon: '🛡️', label: t('security'), desc: t('changePassword') },
                { id: 'account', icon: '👤', label: t('account'), desc: t('accountSettings') }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center space-x-3 space-x-reverse p-3 sm:p-4 rounded-xl text-right transition-all duration-300 ${activeTab === tab.id
                    ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-lg shadow-purple-500/20 dark:shadow-none'
                    : 'bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm'
                    }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm sm:text-base">{tab.label}</div>
                    <div className={`text-xs mt-1 font-medium ${activeTab === tab.id ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'
                      }`}>
                      {tab.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    {t('appearance')}
                  </h3>

                  {/* Language Selection */}
                  <div className="rounded-xl p-4 sm:p-6 mb-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                    <h4 className="font-bold text-sm sm:text-base mb-3 text-gray-900 dark:text-white transition-colors">
                      🌐 {t('language')}
                    </h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleLanguageChange('en')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border ${currentLanguage === 'en'
                          ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-lg shadow-purple-500/20 dark:shadow-none border-purple-600 dark:border-white'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm'
                          }`}
                      >
                        🇬🇧 {t('english')}
                      </button>
                      <button
                        onClick={() => handleLanguageChange('ar')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border ${currentLanguage === 'ar'
                          ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-lg shadow-purple-500/20 dark:shadow-none border-purple-600 dark:border-white'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm'
                          }`}
                      >
                        🇸🇦 {t('arabic')}
                      </button>
                    </div>
                  </div>

                  {/* Theme Selection */}
                  <div className="rounded-xl p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                    <h4 className="font-bold text-sm sm:text-base mb-3 text-gray-900 dark:text-white transition-colors">
                      🎨 {t('theme')}
                    </h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleThemeChange('light')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border ${theme === 'light'
                          ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-lg shadow-purple-500/20 border-purple-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm'
                          }`}
                      >
                        ☀️ {t('lightMode')}
                      </button>
                      <button
                        onClick={() => handleThemeChange('dark')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border ${theme === 'dark'
                          ? 'bg-purple-600 dark:bg-white text-white dark:text-black shadow-lg shadow-purple-500/20 border-purple-600 dark:border-white'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 shadow-sm'
                          }`}
                      >
                        🌙 {t('darkMode')}
                      </button>
                    </div>

                    {/* Preview */}
                    <div className={`mt-4 p-4 rounded-lg border-2 border-dashed ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-300 bg-white/50'
                      }`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        {theme === 'dark' ? '🌙 ' : '☀️ '}
                        {t('theme')}: {theme === 'dark' ? t('dark') : t('light')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    {t('privacySettings')}
                  </h3>

                  <div className="space-y-4">
                    <div className="rounded-xl p-4 border bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex-1 ml-3 transition-colors">
                          <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                            {t('privateAccount')}
                          </div>
                          <div className="text-xs sm:text-sm mt-1 text-gray-500 dark:text-gray-400 font-medium">
                            {t('privateAccountDesc')}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={privacySettings.is_private}
                          onChange={(e) => handlePrivacySettingChange('is_private', e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 transition-all"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl p-4 border bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex-1 ml-3 transition-colors">
                          <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                            {t('allowDirectMessages')}
                          </div>
                          <div className="text-xs sm:text-sm mt-1 text-gray-500 dark:text-gray-400 font-medium">
                            {t('allowDirectMessagesDesc')}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={privacySettings.allow_dms}
                          onChange={(e) => handlePrivacySettingChange('allow_dms', e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 transition-all"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl p-4 border bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex-1 ml-3 transition-colors">
                          <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                            {t('showActivityStatus')}
                          </div>
                          <div className="text-xs sm:text-sm mt-1 text-gray-500 dark:text-gray-400 font-medium">
                            {t('showActivityStatusDesc')}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={privacySettings.show_activity_status}
                          onChange={(e) => handlePrivacySettingChange('show_activity_status', e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 transition-all"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSavePrivacySettings}
                  disabled={loading}
                  className="w-full bg-purple-600 dark:bg-white text-white dark:text-black py-3 rounded-xl hover:bg-purple-700 dark:hover:bg-gray-100 transition-all duration-300 font-bold shadow-lg shadow-purple-500/20 dark:shadow-none text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('saving')}
                    </>
                  ) : (
                    t('saveChanges')
                  )}
                </button>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    {t('security')}
                  </h3>

                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-100 border-gray-200'
                      }`}>
                      <h4 className="font-bold text-sm sm:text-base mb-2 text-gray-900 dark:text-white transition-colors">
                        {t('changePassword')}
                      </h4>
                      <p className="text-xs sm:text-sm mb-3 text-gray-500 dark:text-gray-400 transition-colors font-medium">
                        {t('passwordMinLength')}
                      </p>

                      <div className="space-y-3">
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          placeholder={t('currentPassword') || 'Current Password'}
                          className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-inner focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        />
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          placeholder={t('newPassword') || 'New Password'}
                          className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-inner focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        />
                        <input
                          type="password"
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          placeholder={t('confirmPassword') || 'Confirm Password'}
                          className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-inner focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        />
                      </div>

                      <button
                        onClick={handleChangePassword}
                        disabled={loading}
                        className="w-full bg-purple-600 dark:bg-white text-white dark:text-black py-2.5 rounded-lg hover:bg-purple-700 dark:hover:bg-gray-100 transition-all font-bold text-sm sm:text-base mt-4 shadow-lg shadow-purple-500/20 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border-none"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t('changing')}
                          </>
                        ) : (
                          t('changePassword')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white transition-colors">
                    {t('accountSettings')}
                  </h3>

                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-100 border-gray-200'
                      }`}>
                      <h4 className="font-bold text-sm sm:text-base mb-2 text-gray-900 dark:text-white transition-colors">
                        {t('downloadYourData')}
                      </h4>
                      <p className="text-xs sm:text-sm mb-3 text-gray-500 dark:text-gray-400 font-medium transition-colors">
                        {t('downloadYourDataDesc')}
                      </p>
                      <button
                        onClick={handleDownloadData}
                        disabled={loading}
                        className="w-full bg-green-600 dark:bg-green-500 text-white dark:text-black py-2.5 rounded-lg hover:bg-green-700 dark:hover:bg-green-400 transition-all font-bold shadow-lg shadow-green-500/20 dark:shadow-none text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t('processing') || 'Processing...'}
                          </span>
                        ) : t('request')}
                      </button>
                    </div>

                    <div className="rounded-xl p-4 border border-red-500/20 bg-red-50/50 dark:bg-red-900/10 shadow-sm transition-colors">
                      <h4 className="font-medium text-sm sm:text-base mb-2 text-red-400">
                        {t('dangerZone')}
                      </h4>
                      <p className="text-xs sm:text-sm mb-3 text-gray-600 dark:text-red-400 font-medium transition-colors">
                        {t('deleteAccountWarning')}
                      </p>

                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder={t('enterPasswordToDelete') || 'Enter your password to delete account'}
                        className="w-full px-4 py-2 rounded-lg border mb-3 bg-white dark:bg-gray-700 border-red-200 dark:border-red-500/30 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-inner focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                      />

                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading || !deletePassword}
                        className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition-all font-bold shadow-lg shadow-red-500/20 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center space-x-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>{t('deleting')}</span>
                          </>
                        ) : (
                          <>
                            <span>🗑️</span>
                            <span>{t('deleteAccount')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message Display */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`p-3 sm:p-4 rounded-xl mt-4 text-sm sm:text-base ${message.includes('Failed') || message.includes('فشل') || message.includes('Error') || message.includes('خطأ')
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                    }`}
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    {message.includes('Failed') || message.includes('فشل') || message.includes('Error') || message.includes('خطأ') ? (
                      <span>❌</span>
                    ) : (
                      <span>✅</span>
                    )}
                    <span>{message}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
