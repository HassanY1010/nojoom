import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onUploadSuccess: () => void;
  isVideoOwner?: boolean;
  currentVideoId?: number;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  file,
  onUploadSuccess,
  isVideoOwner = false,
  currentVideoId
}) => {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoResolution, setVideoResolution] = useState<string>('');
  const [uploadStage, setUploadStage] = useState<'preparing' | 'editing' | 'uploading' | 'processing' | 'complete'>('preparing');
  const [error, setError] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [filter, setFilter] = useState<string>('');
  const [thumbnailTimestamp, setThumbnailTimestamp] = useState<number>(1);
  const [audioPath, setAudioPath] = useState<string>('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setUploadStage('editing');

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  // اقتراح عنوان بالذكاء الاصطناعي
  const handleSuggestTitle = async () => {
    if (!description || description.length < 5) {
      setError(t('enterDescriptionFirst') || 'يرجى كتابة وصف أطول أولاً للحصول على اقتراح دقيق');
      return;
    }

    setIsSuggesting(true);
    try {
      const { videoApi } = await import('../services/api');
      const response = await videoApi.aiSuggestTitle(description, category);
      if (response.data.success) {
        setTitle(response.data.suggestion);
      }
    } catch (err) {
      console.error('AI Suggestion error:', err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setEndTime(duration);

      const video = videoRef.current;
      const width = video.videoWidth;
      const height = video.videoHeight;
      setVideoResolution(`${width}x${height}`);

      // التحقق من نسبة العرض إلى الارتفاع 16:9
      const aspectRatio = width / height;
      const is16by9 = Math.abs(aspectRatio - 16 / 9) < 0.1;

      if (!is16by9) {
        console.warn('Video aspect ratio is not 16:9');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError(t('pleaseSelectVideoFirst'));
      return;
    }

    if (!user) {
      setError(t('authenticationRequiredDetails'));
      return;
    }

    // التحقق من مدة الفيديو
    if (videoDuration > 300) { // 5 دقائق كحد أقصى
      setError(t('videoDurationTooLong'));
      return;
    }

    // التحقق من حجم الملف (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('preparing');

    try {
      const formData = new FormData();
      formData.append('video', file);

      if (description.trim()) {
        formData.append('description', description.trim());
      }

      formData.append('category', category);

      // أضف العنوان والمدة
      formData.append('title', file.name);
      formData.append('duration', videoDuration.toString());

      if (user && user.id) {
        formData.append('userId', user.id.toString());
      }

      if (isVideoOwner && currentVideoId) {
        formData.append('replaceVideoId', currentVideoId.toString());
      }

      // أضف بارامترات التعديل
      if (startTime > 0) formData.append('startTime', startTime.toString());
      if (endTime < videoDuration) formData.append('endTime', endTime.toString());
      if (filter) formData.append('filter', filter);
      if (audioPath) formData.append('audioPath', audioPath);
      formData.append('thumbnailTimestamp', thumbnailTimestamp.toString());

      setUploadStage('uploading');

      // ✅ استخدام axios مباشرة مع إعدادات محسنة
      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true, // ✅ إضافة هذا السطر
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setUploadProgress(Math.round(progress));

            if (progress >= 90) {
              setUploadStage('processing');
            }
          }
        },
        timeout: 120000,
      });

      setUploadProgress(100);
      setUploadStage('complete');

      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('✅ Video uploaded successfully:', response.data);
      onUploadSuccess();
      resetForm();
      onClose();

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      setUploading(false);

      let errorMessage = t('uploadFailed');
      let errorDetails = '';

      if (error.response) {
        const status = error.response.status;

        if (status === 413) {
          errorMessage = t('fileTooLargeError');
          errorDetails = t('fileTooLargeDetails');
        } else if (status === 415) {
          errorMessage = t('unsupportedFileType');
          errorDetails = t('unsupportedFileTypeDetails');
        } else if (status === 401) {
          errorMessage = t('authenticationRequired');
          errorDetails = t('authenticationRequiredDetails');
        } else if (status === 429) {
          errorMessage = t('uploadLimitReached');
          errorDetails = t('uploadLimitReachedDetails');
        } else if (status === 500) {
          errorMessage = t('serverError');
          errorDetails = t('serverErrorDetails');
        } else {
          errorMessage = t('uploadFailed');
          errorDetails = error.response.data?.message || t('uploadFailedDetails');
        }
      } else if (error.request) {
        errorMessage = t('connectionError');
        errorDetails = t('connectionErrorDetails');
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = t('uploadTimeout');
        errorDetails = t('uploadTimeoutDetails');
      } else if (error.message?.includes('Network Error')) {
        errorMessage = t('networkError');
        errorDetails = t('networkErrorDetails');
      }

      setError(`${errorMessage}\n${errorDetails}`);
    } finally {
      if (!error) {
        setUploading(false);
        setUploadProgress(0);
        setUploadStage('preparing');
      }
    }
  };

  const resetForm = () => {
    setDescription('');
    setCategory('general');
    setPreviewUrl('');
    setUploadProgress(0);
    setVideoDuration(0);
    setVideoResolution('');
    setUploadStage('preparing');
    setError('');
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-white/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300">
      <div className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-2xl p-4 sm:p-6 w-full max-w-md mx-auto border border-gray-100 dark:border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {uploading ? (
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <div className="w-2 h-2 bg-purple-600 dark:bg-blue-500 rounded-full animate-ping"></div>
                  <span className="truncate">
                    {uploadStage === 'preparing' && t('preparing')}
                    {uploadStage === 'uploading' && t('uploading')}
                    {uploadStage === 'processing' && t('processing')}
                    {uploadStage === 'complete' && t('complete')}
                  </span>
                </div>
              ) : (
                t('uploadVideo')
              )}
            </h2>
            {isVideoOwner && (
              <p className="text-purple-600 dark:text-green-400 text-xs sm:text-sm mt-1 flex items-center font-bold">
                <span className="ml-1 sm:ml-2">🎬</span>
                {t('videoOwnerMode')}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50 ml-2 sm:ml-4 border border-gray-200 dark:border-gray-700 font-bold"
            disabled={uploading}
            aria-label={t('searchPage.clear')}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 sm:p-4">
              <div className="flex items-start space-x-2 rtl:space-x-reverse">
                <span className="text-red-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-red-400 text-sm font-medium whitespace-pre-line">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Video Preview */}
          {previewUrl && (
            <div className="bg-black rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner">
              <video
                ref={videoRef}
                src={previewUrl}
                className={`w-full h-32 sm:h-48 object-cover bg-black ${filter === 'grayscale' ? 'grayscale' : filter === 'sepia' ? 'sepia' : filter === 'brightness' ? 'brightness-125' : filter === 'contrast' ? 'contrast-125' : ''}`}
                controls
                playsInline
                onLoadedMetadata={handleVideoLoaded}
              />
              <div className="p-2 sm:p-3 bg-gray-100/80 dark:bg-gray-800/50 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700/50">
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 font-bold flex-wrap gap-1">
                  <span>{t('duration')}: {formatDuration(endTime - startTime)}</span>
                  {videoResolution && (
                    <span>{t('resolution')}: {videoResolution}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Video Editing Tools */}
          {uploadStage === 'editing' && previewUrl && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Trimming Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700 dark:text-white flex items-center gap-2">
                    <span>✂️</span>
                    {t('trimVideo')}
                  </label>
                  <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                    {formatDuration(startTime)} - {formatDuration(endTime)}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={startTime}
                    onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.5))}
                    className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer z-20 pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={endTime}
                    onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.5))}
                    className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer z-10 pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-pink-600 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <div
                    className="absolute h-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                    style={{ left: `${(startTime / videoDuration) * 100}%`, width: `${((endTime - startTime) / videoDuration) * 100}%` }}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 dark:text-white flex items-center gap-2">
                  <span>✨</span>
                  {t('applyFilters')}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { id: '', label: t('filterNormal') },
                    { id: 'grayscale', label: t('filterGrayscale') },
                    { id: 'sepia', label: t('filterSepia') },
                    { id: 'brightness', label: t('filterBright') },
                    { id: 'contrast', label: t('filterContrast') }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f.id ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thumbnail Pick */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 dark:text-white flex items-center gap-2">
                  <span>🖼️</span>
                  {t('selectThumbnail')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 10, 15].map(ts => (
                    ts < videoDuration && (
                      <button
                        key={ts}
                        onClick={() => {
                          setThumbnailTimestamp(ts);
                          if (videoRef.current) videoRef.current.currentTime = ts;
                        }}
                        className={`aspect-video rounded-lg border-2 overflow-hidden transition-all ${thumbnailTimestamp === ts ? 'border-purple-600 scale-105' : 'border-transparent opacity-60'}`}
                      >
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-[10px] text-gray-500">
                          {ts}s
                        </div>
                      </button>
                    )
                  ))}
                </div>
              </div>

              {/* Music Selection */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 dark:text-white flex items-center gap-2">
                  <span>🎵</span>
                  {t('addMusic')}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { id: '', label: t('musicOriginal') },
                    { id: 'public/music/upbeat.mp3', label: t('musicUpbeat') },
                    { id: 'public/music/chill.mp3', label: t('musicChill') },
                    { id: 'public/music/dance.mp3', label: t('musicDance') }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setAudioPath(m.id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${audioPath === m.id ? 'bg-pink-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {audioPath && (
                  <p className="text-[10px] text-pink-500 font-bold animate-pulse">
                    ✨ {t('musicApplied')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* File Info */}
          <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-700/30 shadow-sm">
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 font-medium">{t('fileName')}:</span>
                <span className="text-gray-900 dark:text-white font-bold truncate text-right ml-2 max-w-[180px] sm:max-w-[200px]">
                  {file?.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-medium">{t('fileSize')}:</span>
                <span className="text-gray-900 dark:text-white font-bold">
                  {file ? formatFileSize(file.size) : '0 Bytes'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-medium">{t('fileType')}:</span>
                <span className="text-gray-900 dark:text-white font-bold capitalize">
                  {file?.type.replace('video/', '') || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Title Input */}
          <div className="relative">
            <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">{t('title')}</label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:text-white transition-all pr-12"
                placeholder={t('videoTitlePlaceholder')}
              />
              <button
                type="button"
                onClick={handleSuggestTitle}
                disabled={isSuggesting}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-xl transition-all shadow-lg hover:shadow-purple-500/20 group"
                title={t('aiSuggestTitle')}
              >
                <span className={`block transition-all ${isSuggesting ? 'animate-spin' : 'group-hover:rotate-12'}`}>
                  {isSuggesting ? '⏳' : '🪄'}
                </span>
              </button>
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-white mb-2 sm:mb-3">
              <span className="flex items-center space-x-2 rtl:space-x-reverse">
                <span>{t('videoCaption')}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                  {t('optional')}
                </span>
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('describeVideo')}
              className="w-full h-20 sm:h-24 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none text-sm transition-all duration-200 backdrop-blur-sm shadow-inner"
              maxLength={150}
              disabled={uploading || !user}
            />
            <div className="flex justify-between items-center mt-1 sm:mt-2">
              <div className="text-xs text-gray-400">
                {t('charactersCount', { count: description.length })}
              </div>
              {description.length > 0 && (
                <div className="text-xs text-blue-400">
                  {t('remaining', { count: 150 - description.length })}
                </div>
              )}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-white">
              <span>{t('videoCategory')}</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm transition-all duration-200 backdrop-blur-sm shadow-inner"
              disabled={uploading || !user}
            >
              <option value="general">{t('catGeneral')}</option>
              <option value="gaming">{t('catGaming')}</option>
              <option value="entertainment">{t('catEntertainment')}</option>
              <option value="education">{t('catEducation')}</option>
              <option value="music">{t('catMusic')}</option>
              <option value="tech">{t('catTech')}</option>
              <option value="lifestyle">{t('catLifestyle')}</option>
              <option value="comedy">{t('catComedy')}</option>
              <option value="sports">{t('catSports')}</option>
              <option value="nature">{t('catNature')}</option>
            </select>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3 sm:space-y-4 bg-purple-50 dark:bg-gray-800/30 rounded-xl p-3 sm:p-4 border border-purple-100 dark:border-gray-700/30 shadow-sm">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-purple-700 dark:text-gray-300 font-bold truncate">
                  {uploadStage === 'preparing' && t('preparingUpload')}
                  {uploadStage === 'uploading' && t('uploadingVideo')}
                  {uploadStage === 'processing' && t('processingVideo')}
                  {uploadStage === 'complete' && t('uploadComplete')}
                </span>
                <span className="text-purple-600 dark:text-white font-black flex-shrink-0 ml-2">
                  {uploadProgress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 sm:h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 sm:h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              {/* Stage Indicators */}
              <div className="flex justify-between text-xs text-gray-400">
                <span className={`text-center flex-1 ${uploadStage === 'preparing' ? 'text-blue-400 font-medium' : ''}`}>
                  {t('preparing').replace('...', '')}
                </span>
                <span className={`text-center flex-1 ${uploadStage === 'uploading' ? 'text-blue-400 font-medium' : ''}`}>
                  {t('uploading').replace('...', '')}
                </span>
                <span className={`text-center flex-1 ${uploadStage === 'processing' ? 'text-blue-400 font-medium' : ''}`}>
                  {t('processing').replace('...', '')}
                </span>
                <span className={`text-center flex-1 ${uploadStage === 'complete' ? 'text-green-400 font-medium' : ''}`}>
                  {t('complete').replace('!', '')}
                </span>
              </div>

              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center pt-1 sm:pt-2 font-bold italic">
                {isVideoOwner
                  ? '📹 ' + t('replacingCurrentVideo')
                  : '🎬 ' + t('uploadingNewVideo')}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold border border-gray-200 dark:border-gray-700 text-sm sm:text-base shadow-sm"
            >
              {t('cancel')}
            </button>

            <button
              onClick={handleSubmit}
              disabled={uploading || !file || !user}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-purple-600 dark:bg-white text-white dark:text-black rounded-xl hover:bg-purple-700 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold shadow-lg shadow-purple-500/20 dark:shadow-none flex items-center justify-center space-x-2 text-sm sm:text-base border-none"
            >
              {uploading ? (
                <>
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>{uploadProgress}%</span>
                </>
              ) : (
                <>
                  <span>📹</span>
                  <span>{t('uploadVideo')}</span>
                </>
              )}
            </button>
          </div>

          {/* Tips & Information */}
          <div className="bg-purple-50 dark:bg-blue-500/10 border border-purple-100 dark:border-blue-500/20 rounded-xl p-3 sm:p-4">
            <div className="flex items-start space-x-2 sm:space-x-3 rtl:space-x-reverse">
              <div className="text-purple-600 dark:text-blue-400 text-base sm:text-lg flex-shrink-0">💡</div>
              <div className="text-xs text-purple-700 dark:text-blue-300 font-medium">
                <p className="font-bold mb-1 opacity-80 underline">{t('uploadTips')}:</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  <li>• {t('maxFileSize')}</li>
                  <li>• {t('supportedFormats')}</li>
                  <li>• {t('recommendedAspectRatio')}</li>
                  <li>• {t('maxDuration')}</li>
                  <li>• {t('stableConnection')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error Message for non-logged in users */}
          {!user && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 sm:p-4">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="text-red-400">⚠️</span>
                <p className="text-red-400 text-xs sm:text-sm">
                  {t('pleaseLoginToUpload')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
