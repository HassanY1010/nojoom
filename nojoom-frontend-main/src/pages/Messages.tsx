import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from "../store/useAuthStore";
import { useSocketStore } from '../store/useSocketStore';
import { messagesApi, userApi } from '../services/api';
import { getMediaUrl } from '../utils/urlUtils';
import { ArrowLeft, MessageCircle, Mic, Smile } from 'lucide-react';

interface User {
    id: number;
    username: string;
    avatar: string;
    is_online: boolean;
    bio?: string;
}

interface Conversation {
    id: number;
    username: string;
    avatar: string;
    is_online: boolean;
    last_message_content: string;
    last_message: string;
    last_message_at: string;
    last_message_time: string;
    last_message_sender_id: number;
    unread_count: number;
    other_user_id: number;
}

interface Message {
    id: number;
    sender_id: number;
    receiver_id: number;
    content: string;
    message_type: 'text' | 'voice';
    media_url: string | null;
    is_read: boolean;
    created_at: string;
    sender_username: string;
    sender_avatar: string;
    receiver_username: string;
    receiver_avatar: string;
}

import VoiceRecorder from '../components/VoiceRecorder';
import { groupApi, storyApi } from '../services/api';

const Messages: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuthStore();
    const { socket } = useSocketStore();

    const [activeTab, setActiveTab] = useState<'conversations' | 'search'>('conversations');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'incoming' | 'sent'>('all');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // معالجة إرسال رسالة صوتية
    const handleVoiceStop = async (audioBlob: Blob) => {
        if (!selectedConversation) return;

        try {
            setLoading(true);
            const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

            const response = await messagesApi.sendMessage(
                selectedConversation.other_user_id,
                undefined,
                audioFile
            );

            if (response.data.success) {
                const sentMsg = response.data.data;
                setMessages(prev => [...prev, sentMsg]);

                // تحديث قائمة المحادثات
                setConversations(prev => {
                    const existingIndex = prev.findIndex(c => c.other_user_id === sentMsg.receiver_id);
                    const updated = [...prev];
                    if (existingIndex > -1) {
                        const conv = { ...updated[existingIndex] };
                        conv.last_message_content = t('voiceMessage');
                        conv.last_message_at = sentMsg.created_at;
                        updated.splice(existingIndex, 1);
                        return [conv, ...updated];
                    }
                    return updated;
                });
            }
        } catch (error) {
            console.error('Error sending voice message:', error);
            alert('Failed to send voice message');
        } finally {
            setLoading(false);
            setIsRecording(false);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '👋', '🔥', '🎉', '✨', '🤔', '👀', '🤝', '✅', '❌', '😊', '😎', '🙌', '💪', '🌹'];

    // تصفية المحادثات
    const filteredConversations = conversations.filter(conv => {
        if (filter === 'all') return true;
        if (filter === 'incoming') return conv.last_message_sender_id === conv.other_user_id;
        if (filter === 'sent') return conv.last_message_sender_id === user?.id;
        return true;
    });

    // تحميل المحادثات
    const loadConversations = async () => {
        try {
            setLoading(true);
            const response = await messagesApi.getConversations();
            setConversations(response.data.data || []);

            // تحميل عدد الرسائل غير المقروءة
            const unreadResponse = await messagesApi.getUnreadCount();
            setUnreadCount(unreadResponse.data.data?.unread_count || 0);
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    // تحميل محادثة محددة
    const loadConversation = async (conversation: Conversation) => {
        try {
            setSelectedConversation(conversation);
            const response = await messagesApi.getConversation(conversation.other_user_id);
            const conversationMessages = response.data.data?.messages || [];
            setMessages(conversationMessages);

            // تحديد الرسائل كمقروءة
            await messagesApi.markAsRead(conversation.other_user_id);

            // تحديث الحالة المحلية بدلاً من إعادة التحميل الكامل
            setConversations(prev => prev.map(c => {
                if (c.other_user_id === conversation.other_user_id) {
                    const newUnread = 0;
                    if (c.unread_count > 0) {
                        setUnreadCount(total => Math.max(0, total - c.unread_count));
                    }
                    return { ...c, unread_count: newUnread };
                }
                return c;
            }));
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    // إرسال رسالة جديدة
    const sendMessage = async () => {
        const messageContent = newMessage.trim() || messageInput.trim();
        if (!messageContent || !selectedConversation) return;

        try {
            // استخدام Socket إذا كان متاحاً
            if (socket) {
                socket.emit('private_message', {
                    receiver_id: selectedConversation.other_user_id,
                    content: messageContent
                });
            } else {
                // استخدام API كبديل
                const response = await messagesApi.sendMessage(
                    selectedConversation.other_user_id,
                    messageContent
                );

                // إضافة الرسالة الجديدة للقائمة
                if (response.data.data) {
                    const sentMsg = response.data.data;
                    setMessages(prev => [...prev, sentMsg]);

                    // تحديث قائمة المحادثات
                    setConversations(prev => {
                        const existingIndex = prev.findIndex(c => c.other_user_id === sentMsg.receiver_id);
                        if (existingIndex > -1) {
                            const updated = [...prev];
                            const conv = { ...updated[existingIndex] };
                            conv.last_message_content = sentMsg.content;
                            conv.last_message_at = sentMsg.created_at;
                            conv.last_message_sender_id = sentMsg.sender_id;
                            updated.splice(existingIndex, 1);
                            return [conv, ...updated];
                        }
                        loadConversations();
                        return prev;
                    });
                }
            }

            setNewMessage('');
            setMessageInput('');
            stopTyping();
        } catch (error) {
            console.error('Error sending message:', error);
            alert(t('sendMessageError') || 'فشل إرسال الرسالة');
        }
    };

    // البحث عن مستخدمين
    const searchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await userApi.searchUsers(query);
            setSearchResults(response.data.users || []);
        } catch (error) {
            console.error('Error searching users:', error);
        }
    };

    // بدء محادثة جديدة
    const startNewConversation = async (userData: User) => {
        const newConversation: Conversation = {
            id: Date.now(), // مؤقت
            username: userData.username,
            avatar: userData.avatar,
            is_online: userData.is_online,
            last_message_content: '',
            last_message: '',
            last_message_at: new Date().toISOString(),
            last_message_time: new Date().toISOString(),
            last_message_sender_id: 0,
            unread_count: 0,
            other_user_id: userData.id
        };

        setSelectedConversation(newConversation);
        setMessages([]);
        setSearchQuery('');
        setSearchResults([]);
        setActiveTab('conversations');
    };

    // إدارة الكتابة
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessage(value);
        setMessageInput(value);

        if (!socket || !selectedConversation) return;

        // إرسال مؤشر الكتابة
        if (!isTyping) {
            setIsTyping(true);
            socket.emit('typing_private', {
                receiver_id: selectedConversation.other_user_id,
                isTyping: true
            });
        }

        // إيقاف مؤشر الكتابة بعد 2 ثانية من عدم الكتابة
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            stopTyping();
        }, 2000);
    };

    const stopTyping = () => {
        if (isTyping && socket && selectedConversation) {
            setIsTyping(false);
            socket.emit('typing_private', {
                receiver_id: selectedConversation.other_user_id,
                isTyping: false
            });
        }
    };

    // إضافة إيموجي
    const addEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setMessageInput(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // التمرير للأسفل تلقائياً
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // تنسيق الوقت
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) {
            const minutes = Math.floor(diff / (1000 * 60));
            return minutes < 1 ? t('chatNow') : t('chatMinutesAgo', { count: minutes });
        } else if (hours < 24) {
            return t('chatHoursAgo', { count: hours });
        } else {
            const days = Math.floor(hours / 24);
            return t('chatDaysAgo', { count: days });
        }
    };

    // تجميع الرسائل حسب التاريخ
    const groupMessagesByDate = (msgs: Message[]) => {
        const groups: { [key: string]: Message[] } = {};
        msgs.forEach(msg => {
            const date = new Date(msg.created_at).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(msg);
        });
        return groups;
    };

    const getDateLabel = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return t('chatToday');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return t('yesterday');
        } else {
            return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    };

    // الاستماع لأحداث Socket
    useEffect(() => {
        if (!socket) return;

        // استقبال رسالة جديدة
        socket.on('private_message_received', (message: Message) => {
            // تحديث قائمة المحادثات أولاً (نقلها للأعلى وتحديث المحتوى)
            setConversations(prev => {
                const existingIndex = prev.findIndex(c => c.other_user_id === message.sender_id);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    const conv = { ...updated[existingIndex] };
                    conv.last_message_content = message.content;
                    conv.last_message_at = message.created_at;
                    conv.last_message_sender_id = message.sender_id;

                    // زيادة العداد إذا لم تكن هي المحادثة المفتوحة حالياً
                    if (!selectedConversation || selectedConversation.other_user_id !== message.sender_id) {
                        conv.unread_count += 1;
                        setUnreadCount(p => p + 1);
                    }

                    updated.splice(existingIndex, 1);
                    return [conv, ...updated];
                } else {
                    // إذا كانت محادثة جديدة غير موجودة في القائمة، يفضل التحميل من جديد لضمان الحصول على بيانات المستخدم كاملة
                    loadConversations();
                    return prev;
                }
            });

            if (selectedConversation && message.sender_id === selectedConversation.other_user_id) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();

                // وضع علامة مقروء
                socket.emit('mark_messages_read', {
                    sender_id: message.sender_id
                });
            }
        });

        // تأكيد إرسال الرسالة
        socket.on('private_message_sent', (message: Message) => {
            setMessages(prev => {
                // تجنب التكرار إذا كانت الرسالة أضيفت مسبقاً (في حالة الـ API)
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
            scrollToBottom();

            // تحديث قائمة المحادثات
            setConversations(prev => {
                const existingIndex = prev.findIndex(c => c.other_user_id === message.receiver_id);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    const conv = { ...updated[existingIndex] };
                    conv.last_message_content = message.content;
                    conv.last_message_at = message.created_at;
                    conv.last_message_sender_id = message.sender_id;
                    updated.splice(existingIndex, 1);
                    return [conv, ...updated];
                }
                loadConversations(); // إذا كانت محادثة جديدة
                return prev;
            });
        });

        // مؤشر الكتابة
        socket.on('user_typing_private', (data: {
            sender_id: number;
            username: string;
            isTyping: boolean
        }) => {
            if (selectedConversation && data.sender_id === selectedConversation.other_user_id) {
                setTypingUser(data.isTyping ? data.username : null);
            }
        });

        // تحديث حالة القراءة
        socket.on('messages_read', () => {
            setMessages(prev => prev.map(msg => ({ ...msg, is_read: true })));
        });

        return () => {
            socket.off('private_message_received');
            socket.off('private_message_sent');
            socket.off('user_typing_private');
            socket.off('messages_read');
        };
    }, [socket, selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const timeoutId = setTimeout(() => searchUsers(searchQuery), 500);
            return () => clearTimeout(timeoutId);
        }
    }, [searchQuery]);

    if (!user) {
        return (
            <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white flex items-center justify-center transition-colors duration-300">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔐</div>
                    <h2 className="text-xl font-bold mb-2">
                        {t('loginRequired')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        {t('loginToUseMessages')}
                    </p>
                </div>
            </div>
        );
    }

    if (loading && conversations.length === 0) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pt-20 px-4 transition-colors duration-300">
                <div className="max-w-6xl mx-auto flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--primary-accent))] mx-auto"></div>
                        <p className="mt-4 text-[var(--text-secondary)] font-bold">
                            {t('loading')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const messageGroups = groupMessagesByDate(messages);

    return (
        <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pt-16 pb-20 lg:pb-4 transition-colors duration-300">
            <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex gap-4 px-4">

                {/* الشريط الجانبي للمحادثات */}
                <div className={`w-full lg:w-96 bg-[var(--bg-card)] rounded-[var(--radius-lg)] flex flex-col overflow-hidden border border-[var(--border-subtle)] shadow-xl ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>

                    {/* رأس الشريط الجانبي */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[rgb(var(--primary-accent))]" /> {t('messages')}
                            </h1>
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </div>

                        {/* أزرار التبويب */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setActiveTab('conversations')}
                                className={`flex-1 ui-chip ui-chip--sm ${activeTab === 'conversations' ? 'is-active' : ''}`}
                            >
                                {t('conversations')}
                            </button>
                            <button
                                onClick={() => setActiveTab('search')}
                                className={`flex-1 ui-chip ui-chip--sm ${activeTab === 'search' ? 'is-active' : ''}`}
                            >
                                {t('searchTab')}
                            </button>
                        </div>

                        {/* شريط البحث */}
                        {activeTab === 'search' && (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('searchUsersPlaceHolder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full ui-input px-4 focus:ring-0"
                                />
                            </div>
                        )}

                        {/* أزرار التصفية */}
                        {activeTab === 'conversations' && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`flex-1 ui-chip ui-chip--sm ${filter === 'all' ? 'is-active' : ''}`}
                                >
                                    {t('allFilter')}
                                </button>
                                <button
                                    onClick={() => setFilter('incoming')}
                                    className={`flex-1 ui-chip ui-chip--sm ${filter === 'incoming' ? 'is-active' : ''}`}
                                >
                                    {t('incomingFilter')}
                                </button>
                                <button
                                    onClick={() => setFilter('sent')}
                                    className={`flex-1 ui-chip ui-chip--sm ${filter === 'sent' ? 'is-active' : ''}`}
                                >
                                    {t('sentFilter')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* قائمة المحادثات أو نتائج البحث */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <AnimatePresence>
                            {activeTab === 'conversations' ? (
                                <div className="space-y-2">
                                    {filteredConversations.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-center py-8 text-gray-400 dark:text-gray-500"
                                        >
                                            <div className="text-4xl mb-2 flex justify-center"><MessageCircle className="w-10 h-10 text-[var(--text-secondary)]" /></div>
                                            <p className="font-bold">{t('noConversations')}</p>
                                        </motion.div>
                                    ) : (
                                        filteredConversations.map((conversation) => (
                                            <motion.div
                                                key={conversation.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                onClick={() => loadConversation(conversation)}
                                                className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedConversation?.other_user_id === conversation.other_user_id
                                                    ? 'bg-[color-mix(in_srgb,var(--primary)_26%,transparent)] text-[var(--text-primary)] border-[color-mix(in_srgb,var(--primary)_45%,var(--border-subtle))] shadow-md'
                                                    : 'bg-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img
                                                            src={getMediaUrl(conversation.avatar)}
                                                            alt={conversation.username}
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm"
                                                        />
                                                        {conversation.is_online && (
                                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-right">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h3 className={`font-bold truncate ${selectedConversation?.other_user_id === conversation.other_user_id ? 'text-white dark:text-black' : 'text-gray-900 dark:text-white'}`}>
                                                                {conversation.username}
                                                            </h3>
                                                            <span className={`text-xs ${selectedConversation?.other_user_id === conversation.other_user_id ? 'text-white/80 dark:text-black/60' : 'text-gray-500 dark:text-gray-400'} font-bold`}>
                                                                {formatTime(conversation.last_message_at)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <p className={`text-sm truncate max-w-[70%] font-medium ${selectedConversation?.other_user_id === conversation.other_user_id ? 'text-white/90 dark:text-black/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                {conversation.last_message_sender_id === user.id && t('you')}
                                                                {conversation.last_message_content || conversation.last_message}
                                                            </p>
                                                            {conversation.unread_count > 0 && (
                                                                <span className="bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                                                                    {conversation.unread_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {searchResults.map((user) => (
                                        <motion.div
                                            key={user.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            onClick={() => startNewConversation(user)}
                                            className="p-3 rounded-xl cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-800 shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={getMediaUrl(user.avatar)}
                                                        alt={user.username}
                                                        className="w-12 h-12 rounded-full object-cover"
                                                    />
                                                    {user.is_online && (
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <h3 className="font-bold text-gray-900 dark:text-white">{user.username}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{user.bio}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* منطقة المحادثة الرئيسية */}
                <div className={`flex-1 bg-white dark:bg-gray-900 rounded-2xl flex-col overflow-hidden border border-gray-100 dark:border-gray-800 shadow-xl ${selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
                    {selectedConversation ? (
                        <>
                            {/* رأس المحادثة */}
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedConversation(null)}
                                    className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div className="relative">
                                    <img
                                        src={getMediaUrl(selectedConversation.avatar)}
                                        alt={selectedConversation.username}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm"
                                    />
                                    {selectedConversation.is_online && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg text-gray-900 dark:text-white">{selectedConversation.username}</h2>
                                    <p className="text-sm font-bold">
                                        {typingUser === selectedConversation.username
                                            ? <span className="text-[rgb(var(--primary-accent))]">{t('typingNow')}</span>
                                            : selectedConversation.is_online ? <span className="text-green-500">{t('onlineNow')}</span> : <span className="text-gray-400">{t('offline')}</span>}
                                    </p>
                                </div>
                            </div>

                            {/* منطقة الرسائل */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {Object.keys(messageGroups).length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                                        <div className="text-4xl mb-2 flex justify-center"><MessageCircle className="w-10 h-10 text-[var(--text-secondary)]" /></div>
                                        <p className="font-bold">{t('noMessagesInConversation')}</p>
                                        <p className="text-sm mt-2 font-medium">{t('startConversation')}</p>
                                    </div>
                                ) : (
                                    Object.keys(messageGroups).map(date => (
                                        <div key={date}>
                                            {/* فاصل التاريخ */}
                                            <div className="flex justify-center mb-4">
                                                <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full font-bold border border-gray-200 dark:border-gray-700">
                                                    {getDateLabel(date)}
                                                </span>
                                            </div>

                                            {/* رسائل هذا التاريخ */}
                                            {messageGroups[date].map((message) => (
                                                <motion.div
                                                    key={message.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'} mb-2`}
                                                >
                                                    <div
                                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm font-medium ${message.sender_id === user.id
                                                            ? 'bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] text-[var(--text-primary)] rounded-br-none border border-[color-mix(in_srgb,var(--primary)_45%,var(--border-subtle))]'
                                                            : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border-subtle)]'
                                                            }`}
                                                    >
                                                        {message.message_type === 'voice' ? (
                                                            <div className="flex items-center gap-2 min-w-[200px] py-1">
                                                                <Mic className="w-4 h-4" />
                                                                <audio
                                                                    src={getMediaUrl(message.media_url!)}
                                                                    controls
                                                                    className={`h-8 w-full ${message.sender_id === user.id ? 'invert-0' : 'dark:invert'}`}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm break-words">{message.content}</p>
                                                        )}
                                                        <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${message.sender_id === user.id ? 'text-white/70 dark:text-black/50' : 'text-gray-500 dark:text-gray-400'
                                                            }`}>
                                                            <span>
                                                                {new Date(message.created_at).toLocaleTimeString('ar-EG', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                            {message.sender_id === user.id && (
                                                                <span>
                                                                    {message.is_read ? '✓✓' : '✓'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* منطقة إرسال الرسالة */}
                            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                                {isRecording ? (
                                    <VoiceRecorder
                                        onStop={handleVoiceStop}
                                        onCancel={() => setIsRecording(false)}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 relative">
                                        {/* منتقي الإيموجي */}
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                        >
                                            <Smile className="w-5 h-5" />
                                        </button>

                                        {/* زر التسجيل الصوتي */}
                                        <button
                                            onClick={() => setIsRecording(true)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                            title="Record Voice Message"
                                        >
                                            <Mic className="w-5 h-5" />
                                        </button>

                                        <AnimatePresence>
                                            {showEmojiPicker && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute bottom-14 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-xl grid grid-cols-5 gap-1 w-64 z-50"
                                                >
                                                    {COMMON_EMOJIS.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => addEmoji(emoji)}
                                                            className="text-2xl p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <input
                                            type="text"
                                            value={newMessage || messageInput}
                                            onChange={handleTyping}
                                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                            placeholder={t('typeMessage')}
                                            className="flex-1 ui-input px-4 focus:ring-0"
                                            maxLength={1000}
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!newMessage.trim() && !messageInput.trim()}
                                            className="ui-button ui-button--primary ui-button--lg interactive px-6 rounded-[var(--radius-pill)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                        >
                                            {t('send')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                <MessageCircle className="w-10 h-10 text-[var(--text-secondary)]" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {t('privateMessages')}
                            </h2>
                            <p className="font-medium">
                                {t('selectConversationToStart')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
