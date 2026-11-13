import React, { useState, useEffect } from 'react';
import api from '../../services/api';  // بدلاً من ../services/api
import { useTranslation } from 'react-i18next';

const SystemSettings = ({ showNotification }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/system-settings');
      // Backend returns { settings: { ... } }
      const backendSettings = response.data.settings || {};

      // توحيد المسميات بين الفرونت وبوكيند إذا لزم الأمر
      // لاحظ أن الفرونت يستخدم 'video_upload_enabled' والباكيند يستخدم 'upload_enabled'
      const mappedSettings = {
        ...backendSettings,
        video_upload_enabled: backendSettings.upload_enabled !== undefined ? backendSettings.upload_enabled.toString() : 'true',
        user_registration_enabled: backendSettings.user_registration_enabled !== undefined ? backendSettings.user_registration_enabled.toString() : 'true',
        chat_enabled: backendSettings.chat_enabled !== undefined ? backendSettings.chat_enabled.toString() : 'true',
        maintenance_mode: backendSettings.maintenance_mode !== undefined ? backendSettings.maintenance_mode.toString() : 'false',
        max_video_size: backendSettings.max_video_size ? backendSettings.max_video_size.toString() : (100 * 1024 * 1024).toString(),
        max_video_duration: backendSettings.max_video_duration ? backendSettings.max_video_duration.toString() : '300',
        auto_ban_reports_threshold: backendSettings.auto_ban_reports_threshold ? backendSettings.auto_ban_reports_threshold.toString() : '5'
      };

      setSettings(mappedSettings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showNotification(t('adminSettingsLoadFailed') || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      // تحويل القيم من الفرونت إلى ما يتوقعه الباكيند
      const backendCompatibleSettings = {
        upload_enabled: settings.video_upload_enabled === 'true',
        user_registration_enabled: settings.user_registration_enabled === 'true',
        chat_enabled: settings.chat_enabled === 'true',
        maintenance_mode: settings.maintenance_mode === 'true',
        max_video_size: parseInt(settings.max_video_size),
        max_video_duration: parseInt(settings.max_video_duration),
        maintenance_message: settings.maintenance_message,
        featured_hashtags: settings.featured_hashtags
      };

      await api.put('/admin/system-settings', { settings: backendCompatibleSettings });
      showNotification(t('adminSettingsSavedSuccess') || 'Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification(t('adminSettingsSaveFailed') || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2">{t('adminSettingsLoading') || 'Loading settings...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 transition-colors duration-300 bg-gray-950 min-h-screen text-white">
      <div className="mb-8">
        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{t('adminSystemSettings')}</h2>
        <p className="text-gray-400 text-lg">{t('adminSystemSettingsDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Video Settings */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎥</span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('adminVideoSettingsSection')}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
              <div>
                <div className="text-sm font-black text-white uppercase tracking-tighter">{t('adminEnableUploads')}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('adminEnableUploadsDesc')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.video_upload_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, video_upload_enabled: e.target.checked.toString() })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">{t('adminMaxFileSize')} (MB)</label>
              <input
                type="number"
                value={settings.max_video_size / (1024 * 1024)}
                onChange={(e) => setSettings({ ...settings, max_video_size: e.target.value * 1024 * 1024 })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">{t('adminMaxVideoDuration')} (s)</label>
              <input
                type="number"
                value={settings.max_video_duration}
                onChange={(e) => setSettings({ ...settings, max_video_duration: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
              />
            </div>
          </div>
        </div>

        {/* User Settings */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👥</span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('adminUserSettingsSection')}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
              <div>
                <div className="text-sm font-black text-white uppercase tracking-tighter">{t('adminEnableRegistration')}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('adminEnableRegistrationDesc')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.user_registration_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, user_registration_enabled: e.target.checked.toString() })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
              <div>
                <div className="text-sm font-black text-white uppercase tracking-tighter">{t('adminEnableChat')}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('adminEnableChatDesc')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.chat_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, chat_enabled: e.target.checked.toString() })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 p-8 shadow-2xl space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚙️</span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('adminSystemSettingsSection')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 group hover:border-rose-500/30 transition-all">
                <div>
                  <div className="text-sm font-black text-rose-500 uppercase tracking-tighter">{t('adminMaintenanceMode')}</div>
                  <div className="text-[10px] text-red-500/50 font-bold uppercase tracking-widest">{t('adminMaintenanceModeDesc')}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenance_mode === 'true'}
                    onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked.toString() })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">{t('adminMaintenanceMessage')}</label>
                <textarea
                  value={settings.maintenance_message}
                  onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                  rows="3"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">{t('adminTrendingHashtags')} ({t('adminCommaSeparated')})</label>
              <textarea
                value={settings.featured_hashtags}
                onChange={(e) => setSettings({ ...settings, featured_hashtags: e.target.value })}
                rows="6"
                placeholder="#dance, #comedy, #football"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium resize-none h-[180px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all transform active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
        >
          {saving ? t('adminSaving') : t('adminSaveSettings')}
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;