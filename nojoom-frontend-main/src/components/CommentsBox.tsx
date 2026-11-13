import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { commentApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { socketService } from '../services/socket';
import { useTranslation } from 'react-i18next';

interface Comment {
  id: number;
  video_id: number;
  user_id: number;
  username: string;
  avatar: string;
  content: string;
  video_reply_id?: number;
  video_reply_thumbnail?: string;
  video_reply_title?: string;
  created_at: string;
  is_owner?: boolean;
}

import { videoApi } from '../services/api';
import { getMediaUrl } from '../utils/urlUtils';

interface CommentsBoxProps {
  videoId: number;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

const CommentsBox: React.FC<CommentsBoxProps> = ({
  videoId,
  isOpen,
  onClose,
  onCommentAdded,
  onCommentDeleted
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [selectedVideoReply, setSelectedVideoReply] = useState<any | null>(null);
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔹 في CommentsBox.tsx - تحسين تحميل عدد التعليقات
  useEffect(() => {
    if (isOpen && videoId && !commentsLoaded) {
      loadComments();
      setupSocketListeners();
      setCommentsLoaded(true);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('new_comment');
        socket.off('comment_deleted');
      }

      // 🔹 إعادة تعيين حالة التحميل عند الإغلاق
      if (!isOpen) {
        setCommentsLoaded(false);
      }
    };
  }, [isOpen, videoId]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('new_comment', (comment: Comment) => {
      if (comment.video_id === videoId) {
        setComments(prev => {
          // ✅ إضافة التعليق الجديد في البداية (المقدمة)
          const updatedComments = [comment, ...prev];
          // ✅ تجنب التكرار
          return updatedComments.filter((c, index, self) =>
            index === self.findIndex((t) => t.id === c.id)
          );
        });
        handleCommentAdded();
      }
    });

    socket.on('comment_deleted', (data: { commentId: number, videoId: number }) => {
      if (data.videoId === videoId) {
        setComments(prev => prev.filter(comment => comment.id !== data.commentId));
        handleCommentDeleted();
      }
    });
  };

  // 🔹 تعديل loadComments لمنع التكرار
  const loadComments = async () => {
    try {
      // 🔹 التحقق من عدم التحميل حالياً
      if (loading) return;

      setLoading(true);
      const response = await commentApi.getComments(videoId);

      // 🔹 عكس الترتيب لعرض الجديد أولاً
      const reversedComments = (response.data.comments || []).reverse();
      setComments(reversedComments);
      setCommentCount(reversedComments.length);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVideos = async () => {
    if (!user) return;
    try {
      const response = await videoApi.getUserVideos(user.id);
      setUserVideos(response.data.videos || []);
    } catch (error) {
      console.error('Failed to fetch user videos:', error);
    }
  };

  const toggleVideoSelector = () => {
    if (!showVideoSelector) fetchUserVideos();
    setShowVideoSelector(!showVideoSelector);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim() || !user) return;

    try {
      setSending(true);
      const response = await commentApi.postComment(
        videoId,
        newComment.trim(),
        selectedVideoReply?.id
      );

      handleCommentAdded();

      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('new_comment', {
          videoId,
          comment: response.data.comment
        });
      }

      // ✅ إضافة التعليق فوراً في الواجهة (في المقدمة)
      const newCommentObj: Comment = {
        ...response.data.comment,
        username: user.username,
        avatar: user.avatar,
        is_owner: true
      };

      setComments(prev => [newCommentObj, ...prev]);

      // ✅ مسح الحقل فقط (لا يتم إخفاؤه)
      setNewComment('');
      setSelectedVideoReply(null);
      setShowVideoSelector(false);

      // ✅ إعادة التركيز على حقل الإدخال بعد الإرسال
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      console.log('✅ Comment added successfully');
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert(t('failedPostComment'));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await commentApi.deleteComment(commentId);
      handleCommentDeleted();

      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('delete_comment', {
          commentId,
          videoId
        });
      }

      // ✅ تحديث الواجهة فوراً
      setComments(prev => prev.filter(comment => comment.id !== commentId));

      console.log('🗑️ Comment deleted successfully');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert(t('failedDeleteComment'));
    }
  };

  const handleEditComment = async (commentId: number, newContent: string) => {
    try {
      await commentApi.updateComment(commentId, newContent);

      // ✅ تحديث التعليق في الواجهة
      setComments(prev => prev.map(comment =>
        comment.id === commentId
          ? { ...comment, content: newContent }
          : comment
      ));

      console.log('✏️ Comment updated successfully');
    } catch (error) {
      console.error('Failed to edit comment:', error);
      alert(t('failedEditComment'));
    }
  };

  // 🔹 إزالة fetchCommentCount من useEffect الخارجي
  // واستبداله بـ:
  const handleCommentAdded = () => {
    setCommentCount(prev => prev + 1);
    onCommentAdded?.();
  };

  const handleCommentDeleted = () => {
    setCommentCount(prev => Math.max(0, prev - 1));
    onCommentDeleted?.();
  };

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('chatNow');
    if (diffMins < 60) return t('notificationAgo', { time: t('chatMinutesAgo', { count: diffMins }) });
    if (diffHours < 24) return t('notificationAgo', { time: t('chatHoursAgo', { count: diffHours }) });
    if (diffDays < 7) return t('notificationAgo', { time: t('chatDaysAgo', { count: diffDays }) });

    return date.toLocaleDateString();
  };

  // ✅ حالة التعديل
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const startEditing = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const saveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;

    await handleEditComment(commentId, editContent.trim());
    setEditingCommentId(null);
    setEditContent('');
  };

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewComment(e.target.value);

    const socket = socketService.getSocket();
    if (socket && user) {
      socket.emit('typing_comment', { videoId, isTyping: true });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_comment', { videoId, isTyping: false });
        setIsTyping(false);
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-2xl w-full max-w-md h-[90vh] sm:h-96 flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700 transition-colors"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white transition-colors">
                {t('commentsTitle')} ({commentCount})
              </h3>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {loading ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <div className="text-3xl sm:text-4xl mb-2">💬</div>
                  <p className="text-sm sm:text-base">{t('noCommentsYet')}</p>
                  <p className="text-xs sm:text-sm">{t('beFirstComment')}</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3 rtl:space-x-reverse">
                    <div className="flex-shrink-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {comment.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-2 sm:p-3 border border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-xs sm:text-sm text-gray-800 dark:text-white">
                            {comment.username}
                            {comment.user_id === user?.id && (
                              <span className="text-xs text-blue-500 mr-1 sm:mr-2">({t('you')})</span>
                            )}
                          </span>
                          <div className="flex items-center space-x-1 sm:space-x-2 rtl:space-x-reverse">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTime(comment.created_at)}
                            </span>
                            {/* ✅ أزرار التحكم للمالك فقط */}
                            {user && comment.user_id === user.id && (
                              <div className="flex space-x-1 rtl:space-x-reverse">
                                {editingCommentId === comment.id ? (
                                  <>
                                    <button
                                      onClick={() => saveEdit(comment.id)}
                                      className="text-xs text-green-500 hover:text-green-700 transition-colors"
                                      title={t('save')}
                                    >
                                      💾
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                      title={t('cancel')}
                                    >
                                      ❌
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditing(comment)}
                                      className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                                      title={t('edit')}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                                      title={t('delete')}
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ✅ عرض محتوى التعليق أو حقل التعديل */}
                        {editingCommentId === comment.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs sm:text-sm border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm break-words">
                              {comment.content}
                            </p>
                            {comment.video_reply_id && (
                              <div
                                className="mt-2 p-2 bg-black/20 rounded-xl border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-black/30 transition"
                                onClick={() => {
                                  const event = new CustomEvent('navigateToVideo', {
                                    detail: { videoId: comment.video_reply_id }
                                  });
                                  window.dispatchEvent(event);
                                  onClose();
                                }}
                              >
                                <div className="w-12 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                                  <img
                                    src={getMediaUrl(comment.video_reply_thumbnail || '')}
                                    alt="Reply"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Video Reply</p>
                                  <p className="text-xs text-white truncate font-medium">{comment.video_reply_title || 'Watch Video'}</p>
                                </div>
                                <span className="ml-auto text-white/50">▶</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* ✅ Comment Input - يظل ظاهراً دائماً */}
            {user && (
              <form onSubmit={handleSubmitComment} className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/50 backdrop-blur-sm">

                {/* Selected Video Preview */}
                {selectedVideoReply && (
                  <div className="mb-3 flex items-center justify-between bg-purple-600/20 p-2 rounded-xl border border-purple-500/30">
                    <div className="flex items-center gap-2">
                      <img src={getMediaUrl(selectedVideoReply.thumbnail_url)} className="w-8 h-10 object-cover rounded-lg" alt="Preview" />
                      <span className="text-xs text-white font-medium truncate max-w-[150px]">Replying with: {selectedVideoReply.title}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedVideoReply(null)} className="text-white hover:text-red-400">✕</button>
                  </div>
                )}

                {/* Video Selector Dropdown */}
                <AnimatePresence>
                  {showVideoSelector && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-3 overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-xl max-h-40 overflow-y-auto"
                    >
                      <div className="p-2 grid grid-cols-4 gap-2">
                        {userVideos.map(video => (
                          <div
                            key={video.id}
                            onClick={() => {
                              setSelectedVideoReply(video);
                              setShowVideoSelector(false);
                            }}
                            className="aspect-[9/16] cursor-pointer hover:scale-105 transition rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500"
                          >
                            <img src={getMediaUrl(video.thumbnail_url)} className="w-full h-full object-cover" alt={video.title} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex space-x-2 rtl:space-x-reverse items-center">
                  <button
                    type="button"
                    onClick={toggleVideoSelector}
                    className={`p-2 rounded-full transition ${showVideoSelector ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-purple-500'}`}
                    title="Reply with a video"
                  >
                    📽️
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newComment}
                    onChange={handleInputChange}
                    placeholder={t('writeCommentPlaceholder')}
                    className="flex-1 px-4 py-2 text-xs sm:text-sm border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white transition-all shadow-inner"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={(!newComment.trim() && !selectedVideoReply) || sending}
                    className="px-5 py-2 text-xs sm:text-sm bg-purple-600 dark:bg-white text-white dark:text-black rounded-full hover:bg-purple-700 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-md"
                  >
                    {sending ? (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      t('send')
                    )}
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-2 text-center">
                  {newComment.length}/500
                </div>
              </form>
            )}

            {!user && (
              <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {t('loginToComment')}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommentsBox;
