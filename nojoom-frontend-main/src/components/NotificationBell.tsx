import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { socketService } from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { getMediaUrl } from '../utils/urlUtils';

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

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchUnreadCount();
        fetchRecentNotifications();
        setupSocketListeners();
    }, []);

    const setupSocketListeners = () => {
        const socket = socketService.getSocket();
        if (socket) {
            socket.on('new_notification', (notification: Notification) => {
                setNotifications(prev => [notification, ...prev.slice(0, 4)]);
                setUnreadCount(prev => prev + 1);
            });

            socket.on('notification_read', ({ notificationId }) => {
                setNotifications(prev =>
                    prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            });
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            setUnreadCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    };

    const fetchRecentNotifications = async () => {
        try {
            setLoading(true);
            const response = await api.get('/notifications?limit=5');
            setNotifications(response.data.notifications);
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
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        const icons = {
            follow: '👤',
            like: '❤️',
            comment: '💬',
            mention: '📢'
        };
        return icons[type as keyof typeof icons] || '🔔';
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

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return notifTime.toLocaleDateString();
    };

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
                aria-label="Notifications"
            >
                <span className="text-2xl">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-white font-bold">Notifications</h3>
                            <Link
                                to="/notifications"
                                className="text-blue-400 text-sm hover:text-blue-300"
                                onClick={() => setShowDropdown(false)}
                            >
                                View All
                            </Link>
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2">🔔</div>
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <Link
                                        key={notification.id}
                                        to={getNotificationLink(notification)}
                                        onClick={() => {
                                            if (!notification.is_read) {
                                                markAsRead(notification.id);
                                            }
                                            setShowDropdown(false);
                                        }}
                                        className={`block p-4 hover:bg-gray-800 transition-colors border-b border-gray-800 ${!notification.is_read ? 'bg-blue-500/10' : ''
                                            }`}
                                    >
                                        <div className="flex items-start space-x-3">
                                            {/* Avatar */}
                                            <img
                                                src={getMediaUrl(notification.actor_avatar, { width: 80, height: 80, crop: 'fill' })}
                                                alt={notification.actor_username}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="text-lg">
                                                        {getNotificationIcon(notification.type)}
                                                    </span>
                                                    {!notification.is_read && (
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                    )}
                                                </div>
                                                <p className="text-white text-sm leading-snug">
                                                    {notification.message}
                                                </p>
                                                <p className="text-gray-400 text-xs mt-1">
                                                    {formatTime(notification.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 border-t border-gray-700 bg-gray-800">
                                <Link
                                    to="/notifications"
                                    className="block text-center text-blue-400 text-sm hover:text-blue-300"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    See all notifications
                                </Link>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Backdrop */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
};

export default NotificationBell;
