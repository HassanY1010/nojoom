import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { socketService } from '../services/socket';
import { motion } from 'framer-motion';
import { getMediaUrl } from '../utils/urlUtils';
import EmptyState from '../components/EmptyState';
import { AtSign, Bell, Heart, MessageCircle, UserPlus } from 'lucide-react';

interface Notification {
    id: number;
    type: 'follow' | 'like' | 'comment' | 'mention';
    actor_username: string;
    actor_avatar: string;
    message: string;
    target_id: number;
    target_type: 'video' | 'comment' | 'user';
    is_read: boolean;
    created_at: string;
}

import { formatNumber } from '../utils/numberUtils';

const Notifications: React.FC = () => {
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'follow' | 'like' | 'comment' | 'mention'>('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
        setupSocketListeners();
    }, [filter]);

    const setupSocketListeners = () => {
        const socket = socketService.getSocket();
        if (socket) {
            socket.on('new_notification', (notification: Notification) => {
                if (filter === 'all' || filter === notification.type) {
                    setNotifications(prev => [notification, ...prev]);
                }
            });
        }
    };

    const fetchNotifications = async (pageNum = 1) => {
        try {
            setLoading(true);
            const response = await api.get(`/notifications?page=${pageNum}&limit=20&type=${filter}`);

            if (pageNum === 1) {
                setNotifications(response.data.notifications);
            } else {
                setNotifications(prev => [...prev, ...response.data.notifications]);
            }

            setHasMore(response.data.pagination.page < response.data.pagination.totalPages);
            setPage(pageNum);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: number) => {
        try {
            await api.put(`/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (notificationId: number) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        const icons = {
            follow: UserPlus,
            like: Heart,
            comment: MessageCircle,
            mention: AtSign
        };
        return icons[type as keyof typeof icons] || Bell;
    };

    const getNotificationLink = (notification: Notification) => {
        if (notification.target_type === 'video') {
            return `/video/${notification.target_id}`;
        } else if (notification.target_type === 'user') {
            return `/profile/${notification.actor_username}`;
        }
        return '/notifications';
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        const notifTime = new Date(timestamp);
        const diffMs = now.getTime() - notifTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('notificationJustNow');
        if (diffMins < 60) return t('notificationAgo', { time: t('chatMinutesAgo', { count: diffMins }) });
        if (diffHours < 24) return t('notificationAgo', { time: t('chatHoursAgo', { count: diffHours }) });
        if (diffDays < 7) return t('notificationAgo', { time: t('chatDaysAgo', { count: diffDays }) });
        return notifTime.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pt-16 transition-colors duration-300">
            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)]">{t('notificationsTitle')}</h1>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-[rgb(var(--primary-accent))] text-xs hover:opacity-80 font-extrabold uppercase tracking-wider"
                            >
                                {t('markAllRead')}
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex space-x-2 overflow-x-auto pb-2">
                        {(['all', 'follow', 'like', 'comment', 'mention'] as const).map((filterType) => (
                            <button
                                key={filterType}
                                onClick={() => {
                                    setFilter(filterType);
                                    setPage(1);
                                }}
                                className={`ui-chip ${filter === filterType ? 'is-active' : ''} `}
                            >
                                {t(`notificationFilter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications List */}
                {loading && page === 1 ? (
                    <div className="flex justify-center py-12">
                        <div className="w-12 h-12 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <EmptyState
                        icon="🔔"
                        title={t('noNotifications')}
                        description={filter === 'all'
                            ? t('notificationEmptyAll')
                            : t('notificationEmptyFilter', { filter: t(`notificationFilter${filter.charAt(0).toUpperCase() + filter.slice(1)}`) })}
                    />
                ) : (
                    <div className="space-y-2">
                        {notifications.map((notification) => (
                            <motion.div
                                key={notification.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`ui-card--sm hover:bg-[color-mix(in_srgb,var(--bg-card)_75%,transparent)] transition-all ${!notification.is_read ? 'border-l-4 border-[rgb(var(--primary-accent))]' : ''}`}
                            >
                                <div className="flex items-start space-x-3">
                                    {/* Avatar */}
                                    <Link to={`/profile/${notification.actor_username}`}>
                                        <img
                                            src={getMediaUrl(notification.actor_avatar)}
                                            alt={notification.actor_username}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm"
                                        />
                                    </Link>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            to={getNotificationLink(notification)}
                                            onClick={() => {
                                                if (!notification.is_read) {
                                                    markAsRead(notification.id);
                                                }
                                            }}
                                            className="block"
                                        >
                                            <div className="flex items-center space-x-2 mb-1">
                                                {React.createElement(getNotificationIcon(notification.type), { className: 'w-4 h-4 text-[rgb(var(--primary-accent))]' })}
                                                {!notification.is_read && (
                                                    <span className="w-2 h-2 bg-[rgb(var(--primary-accent))] rounded-full"></span>
                                                )}
                                            </div>
                                            <p className="text-[var(--text-primary)] leading-snug text-sm font-bold">
                                                {notification.message}
                                            </p>
                                            <p className="text-[var(--text-secondary)] text-[10px] mt-1 font-bold">
                                                {formatTime(notification.created_at)}
                                            </p>
                                        </Link>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => deleteNotification(notification.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-2"
                                        aria-label={t('deleteNotification')}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Load More */}
                {hasMore && !loading && notifications.length > 0 && (
                    <div className="text-center mt-6">
                        <button
                            onClick={() => fetchNotifications(page + 1)}
                            className="ui-button ui-button--primary ui-button--lg interactive px-8 active:scale-95"
                        >
                            {t('searchPage.loadMore')}
                        </button>
                    </div>
                )}

                {loading && page > 1 && (
                    <div className="flex justify-center py-6">
                        <div className="w-8 h-8 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
