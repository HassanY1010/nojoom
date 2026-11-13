import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import UploadModal from '../components/UploadModal';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getMediaUrl } from '../utils/urlUtils';
import { CircleDot, FileUp, RefreshCcw } from 'lucide-react';

const Upload: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [userVideo, setUserVideo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchUserVideo();
    }
  }, [user]);

  const fetchUserVideo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/videos/user/video');
      setUserVideo(response.data.video);
    } catch (error) {
      console.error('Failed to fetch user video:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // تحقق من نوع الملف
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType = validTypes.includes(file.type) ||
      ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');

    if (!isValidType) {
      alert(t('selectValidVideoFile'));
      return;
    }

    // تحقق من حجم الملف (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert(t('fileSizeLimit'));
      return;
    }

    setSelectedFile(file);
    setIsModalOpen(true);

    // reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadSuccess = () => {
    fetchUserVideo(); // تحديث حالة الفيديو بعد الرفع
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white flex items-center justify-center p-4 sm:p-6 transition-colors duration-300">
        <div className="text-center max-w-sm w-full">
          {/* Lock Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center shadow-inner border border-gray-200 dark:border-gray-700"
          >
            <span className="text-2xl sm:text-3xl">🔒</span>
          </motion.div>

          <motion.h1
            className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold mb-2 sm:mb-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {t('signInToUpload')}
          </motion.h1>

          <motion.p
            className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 font-medium"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t('joinCommunityToShare')}
          </motion.p>

          <motion.div
            className="flex flex-col gap-2 sm:gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => navigate('/login')}
              className="ui-button ui-button--primary ui-button--lg interactive px-6 rounded-[var(--radius-pill)] active:scale-95"
            >
              {t('signIn')}
            </button>

            <button
              onClick={() => navigate('/register')}
              className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm sm:text-base border border-gray-200 dark:border-gray-700"
            >
              {t('signUp')}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pt-16 flex items-center justify-center p-4 sm:p-6 transition-colors duration-300">
      {/* Main Upload Container */}
      <div className="w-full max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-gray-900 dark:text-white text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
              {userVideo ? t('changeVideo') : t('addVideo')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">
              {userVideo
                ? t('replaceCurrentVideo')
                : t('shareWithCommunity')
              }
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="mb-4 sm:mb-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Current Video Preview */}
          {userVideo && !loading && (
            <motion.div
              className="mb-4 sm:mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-800 shadow-sm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-gray-900 dark:text-white text-sm font-bold mb-2 sm:mb-3 text-right">{t('currentVideo')}:</h3>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={getMediaUrl(userVideo.video_url)}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 truncate text-right font-medium">
                {userVideo.description || t('noCaption')}
              </p>
              <div className="flex justify-between items-center mt-2 text-[10px] sm:text-xs text-gray-500 font-bold">
                <span>{new Date(userVideo.created_at).toLocaleDateString()}</span>
                <span>{Math.round(userVideo.duration || 0)}{t('videoDurationSuffix')}</span>
              </div>
            </motion.div>
          )}

          {/* Drag & Drop Area */}
          <motion.div
            className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 text-center cursor-pointer transition-all duration-300 ${isDragging
              ? 'border-purple-600 dark:border-white bg-purple-50 dark:bg-purple-900/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 bg-gray-50 dark:bg-gray-900/50 shadow-inner'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".mp4,.webm,.ogg,.mov,video/mp4,video/webm,video/ogg,video/quicktime"
              className="hidden"
            />

            {/* Upload Icon */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
              {userVideo ? <RefreshCcw className="w-6 h-6 text-[rgb(var(--primary-accent))]" /> : <FileUp className="w-6 h-6 text-[rgb(var(--primary-accent))]" />}
            </div>

            <h2 className="text-gray-900 dark:text-white font-bold mb-1 sm:mb-2 text-sm sm:text-base">
              {isDragging
                ? t('dropToUpload')
                : userVideo
                  ? t('selectNewVideo')
                  : t('selectVideoToUpload')
              }
            </h2>

            <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 sm:mb-4 font-medium">
              {t('orDragAndDrop')}
            </p>

            {/* File Requirements */}
            <div className="text-xs text-gray-500 space-y-1 mb-3 sm:mb-4">
              <p className="text-xs">{t('videoFormats')}: MP4, WebM, OGG, MOV</p>
              <p className="text-xs">{t('fileRequirements')}: {t('maxSize50MB')}</p>
            </div>

            {/* Upload Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="ui-button ui-button--primary interactive px-6 rounded-[var(--radius-pill)] active:scale-95"
            >
              {userVideo ? t('changeVideo') : t('upload')}
            </button>
          </motion.div>

          {/* Quick Tips */}
          <motion.div
            className="mt-6 sm:mt-8 text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-gray-900 dark:text-white text-sm font-bold mb-2 sm:mb-3">{t('tips')}:</h3>
            <ul className="text-gray-500 dark:text-gray-400 text-xs space-y-1.5 sm:space-y-2 font-medium">
              <li className="flex items-start justify-end text-right">
                <CircleDot className="w-3 h-3 mt-0.5 mr-2 text-[rgb(var(--primary-accent))]" />
                <span className="flex-1">{t('tipAspectRatio')}</span>
              </li>
              <li className="flex items-start justify-end text-right">
                <CircleDot className="w-3 h-3 mt-0.5 mr-2 text-[rgb(var(--primary-accent))]" />
                <span className="flex-1">{t('tipVideoLength')}</span>
              </li>
              <li className="flex items-start justify-end text-right">
                <CircleDot className="w-3 h-3 mt-0.5 mr-2 text-[rgb(var(--primary-accent))]" />
                <span className="flex-1">{t('tipAutoReplace')}</span>
              </li>
              <li className="flex items-start justify-end text-right">
                <CircleDot className="w-3 h-3 mt-0.5 mr-2 text-[rgb(var(--primary-accent))]" />
                <span className="flex-1">{t('tipGoodLighting')}</span>
              </li>
            </ul>
          </motion.div>

          {/* Upload Stats */}
          {userVideo && (
            <motion.div
              className="mt-4 sm:mt-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-800 shadow-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h4 className="text-gray-900 dark:text-white text-sm font-bold mb-2 text-right">{t('videoStats')}:</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">{t('views')}</div>
                  <div className="text-gray-900 dark:text-white font-bold">{userVideo.views || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">{t('likes')}</div>
                  <div className="text-gray-900 dark:text-white font-bold">{userVideo.likes || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">{t('comments')}</div>
                  <div className="text-gray-900 dark:text-white font-bold">{userVideo.comment_count || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">{t('uploaded')}</div>
                  <div className="text-gray-900 dark:text-white font-bold">
                    {new Date(userVideo.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        onUploadSuccess={() => {
          setSelectedFile(null);
          handleUploadSuccess();
        }}
      />
    </div>
  );
};

export default Upload;
