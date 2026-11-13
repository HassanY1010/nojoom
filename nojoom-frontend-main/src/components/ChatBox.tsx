import React, { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../utils/urlUtils';

interface Message {
  id: number;
  sender_id: number;
  video_id: number;
  content: string;
  type: 'user' | 'admin' | 'broadcast';
  created_at: string;
  username?: string;
  avatar?: string;
  display_count?: number;
  timestamp?: number;
}

interface ChatBoxProps {
  videoId: number;
  videoOwnerId: number;
  isVideoOwner: boolean;
  onClose: () => void;
  isPaused?: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  videoId,
  videoOwnerId,
  isVideoOwner,
  onClose,
  isPaused = false
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isChatPaused, setIsChatPaused] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [messageDisplayCounts, setMessageDisplayCounts] = useState<{ [key: number]: number }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ تعديل هنا لتجنب مشاكل TypeScript
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuthStore();
  const { t } = useTranslation();

  const animatedEmojis = ['😂', '❤️', '🔥', '👏', '😍', '🎉', '👍', '🙏', '😢', '🤔', '👀', '💀'];

  useEffect(() => {
    setIsChatPaused(isPaused);
    if (isPaused) {
      const socket = socketService.getSocket();
      socket?.emit('chat_paused', { videoId, paused: true });
    }
  }, [isPaused, videoId]);

  useEffect(() => {
    initializeSocket();
    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('leave_video', videoId);
        socket.off('chat_message');
        socket.off('broadcast_message');
        socket.off('user_typing');
        socket.off('user_stopped_typing');
        socket.off('chat_paused');
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [videoId]);

  const initializeSocket = async () => {
    try {
      const socket = await socketService.connect();
      setIsConnected(true);
      socket?.emit('join_video', videoId);

      socket?.on('chat_message', (message: Message) => {
        if (!isChatPaused) addMessageWithRotation(message);
      });

      socket?.on('broadcast_message', (broadcast: Message) => {
        if (!isChatPaused) addMessageWithRotation({ ...broadcast, type: 'admin' });
      });

      socket?.on('user_typing', (data: { username: string; userId: number }) => {
        setTypingUsers(prev => (!prev.includes(data.username) ? [...prev, data.username] : prev));
      });

      socket?.on('user_stopped_typing', (data: { userId: number }) => {
        setTypingUsers(prev => prev.filter(username => {
          const typingUser = messages.find(msg => msg.sender_id === data.userId);
          return typingUser?.username !== username;
        }));
      });

      socket?.on('chat_paused', (data: { videoId: number; paused: boolean }) => {
        if (data.videoId === videoId) setIsChatPaused(data.paused);
      });

      socket?.on('connect_error', () => setIsConnected(false));
    } catch {
      setIsConnected(false);
    }
  };

  const addMessageWithRotation = (message: Message) => {
    const messageId = message.id || Date.now();
    setMessages(prev => {
      const existingMessageIndex = prev.findIndex(
        msg => msg.id === messageId || (msg.content === message.content && msg.sender_id === message.sender_id)
      );

      if (existingMessageIndex !== -1) {
        const updatedMessages = [...prev];
        const currentDisplayCount = messageDisplayCounts[messageId] || 1;
        const newDisplayCount = currentDisplayCount + 1;

        if (newDisplayCount >= 4) {
          updatedMessages.splice(existingMessageIndex, 1);
          setMessageDisplayCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[messageId];
            return newCounts;
          });
        } else {
          updatedMessages[existingMessageIndex] = {
            ...updatedMessages[existingMessageIndex],
            display_count: newDisplayCount,
            timestamp: Date.now()
          };
          setMessageDisplayCounts(prev => ({ ...prev, [messageId]: newDisplayCount }));
          const randomIndex = Math.floor(Math.random() * updatedMessages.length);
          const [movedMessage] = updatedMessages.splice(existingMessageIndex, 1);
          updatedMessages.splice(randomIndex, 0, movedMessage);
        }

        return updatedMessages;
      } else {
        const newMessageWithData = { ...message, id: messageId, display_count: 1, timestamp: Date.now() };
        setMessageDisplayCounts(prev => ({ ...prev, [messageId]: 1 }));
        const randomIndex = Math.floor(Math.random() * (prev.length + 1));
        const newMessages = [...prev];
        newMessages.splice(randomIndex, 0, newMessageWithData);
        return newMessages.slice(-100);
      }
    });
  };

  useEffect(() => scrollToBottom(), [messages]);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !isConnected || isChatPaused) return;

    try {
      const socket = socketService.getSocket();
      socket?.emit('chat_message', { videoId, content: newMessage.trim() });
      setNewMessage('');
      setShowEmojiPicker(false);

      socket?.emit('typing_stop', { videoId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = () => {
    if (!isConnected || isChatPaused) return;
    const socket = socketService.getSocket();
    if (socket && newMessage.trim()) {
      socket.emit('typing_start', { videoId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { videoId });
        typingTimeoutRef.current = null;
      }, 3000);
    }
  };

  const addEmoji = (emoji: string) => {
    if (!isChatPaused) {
      setNewMessage(prev => prev + emoji);
      setShowEmojiPicker(false);
      handleTyping();
    }
  };

  const getMessageStyle = (message: Message, index: number) => {
    const isLeft = Math.random() > 0.5;
    if (message.type === 'admin') return 'bg-yellow-500/20 border border-yellow-500/30 mx-auto max-w-xs text-yellow-300';
    if (message.sender_id === user?.id) return 'bg-blue-500/30 border border-blue-500/50 ml-auto mr-2 max-w-xs text-white';
    return isLeft
      ? 'bg-green-500/20 border border-green-500/30 mr-auto ml-2 max-w-xs text-gray-100'
      : 'bg-purple-500/20 border border-purple-500/30 ml-auto mr-2 max-w-xs text-gray-100';
  };

  const renderAnimatedEmojis = (text: string) => {
    const words = text.split(' ');
    return words.map((word, index) => {
      const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu;
      if (word.match(emojiRegex)) {
        return (
          <span
            key={index}
            className="inline-block animate-bounce mx-0.5 text-base sm:text-lg"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {word}
          </span>
        );
      }
      return <span key={index}>{word} </span>;
    });
  };

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setMessages(prev =>
        prev.filter(message => message.timestamp && now - message.timestamp < 5 * 60 * 1000)
      );
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-black/90 backdrop-blur-md transition-colors duration-300">
      {/* Header مع حالة الدردشة */}
      <div className="border-b border-gray-100 dark:border-gray-700 p-2 sm:p-3 flex justify-between items-center bg-gray-50/50 dark:bg-black/50 transition-colors">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <h3 className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">{t('liveChat')}</h3>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? t('activeParticipants', { count: messages.length }) : t('chatOffline')}
            </span>
          </div>
          {isChatPaused && (
            <span className="bg-red-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full animate-pulse">
              ⏸️ {t('chatPausedTitle')}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-base sm:text-lg transition-all bg-gray-100 dark:bg-black/30 rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold"
        >
          ✕
        </button>
      </div>

      {/* منطقة الشريطين الثابتين للرسائل */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 sm:space-y-2 chat-messages">
        {isChatPaused && (
          <div className="text-center bg-red-500/20 border border-red-500/50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4">
            <p className="text-red-300 text-xs sm:text-sm">
              ⏸️ {t('chatPausedDesc')}
            </p>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-4 sm:mt-8">
            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">💬</div>
            <p className="text-xs sm:text-sm">{t('noCommentsYet')}</p>
            <p className="text-xs mt-0.5 sm:mt-1">{t('startConversation')}</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.id}-${index}-${message.display_count}`}
              className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm backdrop-blur-sm transition-all duration-300 ${getMessageStyle(message, index)}`}
            >
              <div className="flex items-start space-x-1 sm:space-x-2">
                {message.type === 'user' && message.avatar && (
                  <img
                    src={getMediaUrl(message.avatar)}
                    alt={message.username}
                    className="w-4 h-4 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    {message.type === 'user' && (
                      <span className="font-bold text-gray-900 dark:text-white text-xs">
                        {message.username}
                        {message.sender_id === videoOwnerId && (
                          <span className="ml-0.5 sm:ml-1 text-yellow-400">🎬</span>
                        )}
                      </span>
                    )}
                    {message.type === 'admin' && (
                      <span className="font-bold text-yellow-400 text-xs flex items-center">
                        📢 {message.username}
                      </span>
                    )}
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-gray-400 text-xs">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {message.display_count && message.display_count > 1 && (
                        <span className="text-gray-400 text-xs bg-black/30 px-1 rounded">
                          {message.display_count}/4
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-800 dark:text-white text-xs sm:text-sm break-words leading-relaxed font-medium">
                    {renderAnimatedEmojis(message.content)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* مؤشر الكتابة */}
        {typingUsers.length > 0 && (
          <div className="text-center text-gray-400 text-xs italic mt-1 sm:mt-2 animate-pulse">
            {typingUsers.slice(0, 2).join(', ')}
            {typingUsers.length > 2 && t('moreTyping', { count: typingUsers.length - 2 })} {t('typing')}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* منتقي الإيموجي المتحرك */}
      {showEmojiPicker && !isChatPaused && (
        <div className="border-t border-gray-700 p-2 sm:p-3 bg-gray-800/90 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-1 sm:mb-2">
            <span className="text-white text-xs sm:text-sm font-medium">Emojis</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors"
            >
              {t('close')}
            </button>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-0.5 sm:gap-1">
            {animatedEmojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => addEmoji(emoji)}
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-gray-700 rounded text-base sm:text-lg transition-all duration-200 hover:scale-110 animate-pulse"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* إدخال الرسالة */}
      <form onSubmit={sendMessage} className="p-2 sm:p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-black/50 transition-colors">
        <div className="flex space-x-1 sm:space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                if (!isChatPaused) {
                  setNewMessage(e.target.value);
                  handleTyping();
                }
              }}
              onBlur={() => {
                const socket = socketService.getSocket();
                socket?.emit('typing_stop', { videoId });
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
              }}
              placeholder={
                isChatPaused
                  ? t('chatPausedDesc')
                  : isConnected
                    ? t('typeMessage')
                    : t('joiningLive')
              }
              disabled={!isConnected || isChatPaused}
              className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 border border-gray-200 dark:border-gray-600 text-xs sm:text-sm disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 pr-10 sm:pr-12 transition-all duration-200 shadow-inner"
              maxLength={200}
            />
            {!isChatPaused && (
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white text-base sm:text-lg transition-colors"
              >
                😊
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!isConnected || newMessage.trim() === '' || isChatPaused}
            className="bg-purple-600 dark:bg-white text-white dark:text-black px-3 sm:px-6 py-2 sm:py-3 rounded-full hover:bg-purple-700 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-xs sm:text-sm font-bold shadow-lg shadow-purple-500/20 dark:shadow-none min-w-12 sm:min-w-16 flex items-center justify-center"
          >
            <span className="hidden xs:inline">{t('sendAction')}</span>
            <span className="xs:hidden">➤</span>
          </button>
        </div>
        <div className="flex justify-between items-center mt-1 sm:mt-2">
          <div className="text-xs text-gray-400">
            {newMessage.length}/200
          </div>
          {isVideoOwner && (
            <div className="text-xs text-green-400 flex items-center">
              <span className="hidden sm:inline">{t('videoOwnerBadge')}</span>
              <span className="sm:hidden">{t('videoOwnerBadge')}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatBox;
