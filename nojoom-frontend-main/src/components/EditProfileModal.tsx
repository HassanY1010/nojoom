import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: any) => void;
  currentUser: {
    id: number;
    username: string;
    email: string;
    avatar: string;
    bio: string;
    country: string;
    social_links: string;
  };
}

interface SocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  currentUser
}) => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const [formData, setFormData] = useState({
    username: currentUser.username || '',
    bio: currentUser.bio || '',
    country: currentUser.country || 'Global',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentUser.avatar || '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // دالة مساعدة للحصول على رابط الصورة الكامل


  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: currentUser.username || '',
        bio: currentUser.bio || '',
        country: currentUser.country || 'Global',
      });
      setAvatarPreview(currentUser.avatar || '');
      setAvatarFile(null);

      // تحليل الروابط الاجتماعية
      if (currentUser.social_links) {
        try {
          const links = typeof currentUser.social_links === 'string'
            ? JSON.parse(currentUser.social_links)
            : currentUser.social_links;
          setSocialLinks(links || {});
        } catch (e) {
          setSocialLinks({});
        }
      } else {
        setSocialLinks({});
      }

      setErrors({});
    }
  }, [isOpen, currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // مسح الخطأ عند التعديل
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSocialLinkChange = (platform: keyof SocialLinks, value: string) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // التحقق من نوع الملف
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, avatar: t('imageTypeError') }));
        return;
      }

      // التحقق من حجم الملف (5MB كحد أقصى)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: t('imageSizeError') }));
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, avatar: '' }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setErrors(prev => ({ ...prev, avatar: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = t('usernameRequired');
    } else if (formData.username.length < 3) {
      newErrors.username = t('usernameMinLength');
    } else if (formData.username.length > 30) {
      newErrors.username = t('usernameMaxLength');
    }

    if (formData.bio.length > 150) {
      newErrors.bio = t('bioMaxLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const submitData = new FormData();
      submitData.append('username', formData.username.trim());
      submitData.append('bio', formData.bio.trim());
      submitData.append('country', formData.country);

      // إضافة الصورة إذا تم اختيار واحدة
      if (avatarFile) {
        submitData.append('avatar', avatarFile);
      }

      // إضافة الروابط الاجتماعية
      const socialLinksData = JSON.stringify(socialLinks);
      submitData.append('social_links', socialLinksData);

      console.log('🔄 Updating profile...', {
        username: formData.username,
        bio: formData.bio,
        hasAvatar: !!avatarFile,
        socialLinks: socialLinks
      });

      const response = await api.put('/users/profile', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Profile updated successfully:', response.data);

      // تحديث بيانات المستخدم في context
      if (updateUser) {
        updateUser(response.data.user);
      }

      // إغلاق المودال وتحديث البيانات
      onUpdate(response.data.user);
      onClose();

    } catch (error: any) {
      console.error('❌ Failed to update profile:', error);

      let errorMessage = t('failedUpdateProfile');

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      }

      setErrors(prev => ({ ...prev, submit: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-white/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative border border-gray-100 dark:border-gray-700 shadow-2xl transition-colors"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-500 dark:text-white text-xl font-bold hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
        >
          ×
        </button>

        {/* Error Message */}
        {errors.submit && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-500/20 border border-red-500/30 rounded-lg sm:rounded-xl">
            <div className="flex items-center space-x-2 text-red-300 text-xs sm:text-sm">
              <span>⚠️</span>
              <span>{errors.submit}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Avatar Section */}
          <div className="text-center">
            <label className="block text-sm font-bold text-gray-700 dark:text-white mb-2 sm:mb-3 transition-colors">{t('profilePicture')}</label>
            <div className="relative inline-block">
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full border-2 border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-800 shadow-inner transition-colors">
                {avatarPreview ? (
                  <img src={avatarPreview} alt={t('avatarPreviewLabel')} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <span className="text-xl sm:text-2xl">👤</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-1 sm:space-x-2 mt-2 sm:mt-3">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={loading}
                  className="px-2 sm:px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {t('change')}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    disabled={loading}
                    className="px-2 sm:px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {t('remove')}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            {errors.avatar && <p className="text-red-400 text-xs mt-1 sm:mt-2">{errors.avatar}</p>}
            <p className="text-gray-400 text-xs mt-1 sm:mt-2">{t('imageTypeParams')}</p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-bold text-gray-700 dark:text-white mb-1 sm:mb-2 transition-colors">
              {t('usernameLabel')}
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg sm:rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all duration-200 text-sm sm:text-base shadow-inner"
              placeholder={t('enterUsername')}
            />
            {errors.username && <p className="text-red-400 text-xs mt-1 sm:mt-2">{errors.username}</p>}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-bold text-gray-700 dark:text-white mb-1 sm:mb-2 transition-colors">
              {t('bioLabel')}
              <span className="text-gray-500 dark:text-gray-400 text-xs mr-1 sm:mr-2 font-medium">({formData.bio.length}/150)</span>
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              disabled={loading}
              rows={3}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg sm:rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 resize-none transition-all duration-200 text-sm sm:text-base shadow-inner"
              placeholder={t('writeBio')}
              maxLength={150}
            />
            {errors.bio && <p className="text-red-400 text-xs mt-1 sm:mt-2">{errors.bio}</p>}
          </div>

          {/* Country/Region */}
          <div>
            <label htmlFor="country" className="block text-sm font-bold text-gray-700 dark:text-white mb-1 sm:mb-2 transition-colors">
              {t('countryLabel', 'Country / Region')}
            </label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg sm:rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all duration-200 text-sm sm:text-base shadow-inner appearance-none"
            >
              <option value="Global">Global</option>
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="Egypt">Egypt</option>
              <option value="UAE">UAE</option>
              <option value="Kuwait">Kuwait</option>
              <option value="Qatar">Qatar</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-lg sm:rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold border border-gray-200 dark:border-gray-700 text-sm sm:text-base order-2 xs:order-1"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 dark:bg-white text-white dark:text-black rounded-lg sm:rounded-xl hover:bg-purple-700 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold shadow-lg shadow-purple-500/20 dark:shadow-none flex items-center justify-center space-x-2 text-sm sm:text-base order-1 xs:order-2"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs sm:text-sm">{t('saving')}</span>
                </>
              ) : (
                <>
                  <span className="text-sm">💾</span>
                  <span>{t('saveChanges')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div >
  );
};
export default EditProfileModal;


