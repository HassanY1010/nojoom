import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

// استيراد مكونات الإدارة
import ReportManagement from '../components/admin/ReportManagement.jsx';
import UserManagement from '../components/admin/UserManagement.jsx';
import VideoManagement from '../components/admin/VideoManagement.jsx';
import SystemSettings from '../components/admin/SystemSettings.jsx';
import SuperAdminDashboard from '../components/admin/SuperAdminDashboard';
import TenantAdminDashboard from '../components/admin/TenantAdminDashboard';

// الأنواع (Types)
interface Stats {
  totalUsers: number;
  totalVideos: number;
  totalMessages: number;
  activeUsers: number;
  storageUsed: number;
  dailyUploads: number;
  serverLoad: number;
  responseTime: number;
  pendingReports: number;
  totalReports: number;
  bannedUsers: number;
  pinnedVideos: number;
  totalViews: number;
  totalLikes: number;
  todayUsers: number;
  todayReports: number;
  resolvedReports: number;
  rejectedReports: number;
}

interface Activity {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  user: string;
}

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  action: () => void;
}

interface Notification {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

const Admin = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguageStore();
  const { user, isAdmin, isSuperAdmin, isModerator } = useAuthStore();
  const navigate = useNavigate();
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalVideos: 0,
    totalMessages: 0,
    activeUsers: 0,
    storageUsed: 0,
    dailyUploads: 0,
    serverLoad: 0,
    responseTime: 0,
    pendingReports: 0,
    totalReports: 0,
    bannedUsers: 0,
    pinnedVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    todayUsers: 0,
    todayReports: 0,
    resolvedReports: 0,
    rejectedReports: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [aiTrends, setAiTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notification, setNotification] = useState<Notification>({
    message: '',
    type: 'success',
    visible: false
  });

  useEffect(() => {
    if (user && !isModerator) {
      console.warn('⚠️ User is not authorized for admin panel, redirecting to home');
      navigate('/');
      return;
    }

    if (isModerator) {
      fetchDashboardData(); // Combined fetch for stats, activity, and AI trends
      setupRealTimeUpdates();
    }
  }, [user, isModerator, navigate]);

  const setupRealTimeUpdates = () => {
    let socket = socketService.getSocket();

    if (!socket) {
      socket = socketService.connect();
    }

    if (socket) {
      socket.on('admin_stats_update', (updatedStats) => {
        setStats(prev => ({ ...prev, ...updatedStats }));
      });

      socket.on('admin_activity', (activity) => {
        setRecentActivity(prev => [activity, ...prev.slice(0, 14)]);
      });

      socket.on('broadcast_sent', (data) => {
        if (data.success) {
          showNotification(t('adminBroadcastSuccess'), 'success');
        } else {
          showNotification(t('adminBroadcastFailed'), 'error');
        }
      });

      socket.on('new_report', (reportData) => {
        const newActivity = {
          id: Date.now(),
          type: 'report',
          message: t('adminActivityReport', { reason: reportData.reason, username: reportData.video_owner_username }),
          timestamp: new Date().toISOString(),
          user: reportData.reporter_username
        };

        setRecentActivity(prev => [newActivity, ...prev.slice(0, 14)]);

        setStats(prev => ({
          ...prev,
          pendingReports: prev.pendingReports + 1,
          totalReports: prev.totalReports + 1
        }));
      });

      socket.on('report_resolved', (reportData) => {
        setStats(prev => ({
          ...prev,
          pendingReports: Math.max(0, prev.pendingReports - 1)
        }));
      });

      socket.on('user_banned', (data) => {
        const newActivity = {
          id: Date.now(),
          type: 'user',
          message: t('adminActivityUserBanned', { username: data.username }),
          timestamp: new Date().toISOString(),
          user: data.admin_username
        };
        setRecentActivity(prev => [newActivity, ...prev.slice(0, 14)]);
        setStats(prev => ({ ...prev, bannedUsers: prev.bannedUsers + 1 }));
      });

      socket.on('video_deleted', (data) => {
        const newActivity = {
          id: Date.now(),
          type: 'upload',
          message: t('adminActivityVideoDeleted', { description: data.video_description }),
          timestamp: new Date().toISOString(),
          user: data.admin_username
        };
        setRecentActivity(prev => [newActivity, ...prev.slice(0, 14)]);
      });
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data.stats);
      setRecentActivity(statsRes.data.recentActivity || []);

      const trendsRes = await api.get('/admin/ai-trends');
      setAiTrends(trendsRes.data.stats || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      showNotification(t('adminStatsFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Removed fetchStats and fetchRecentActivity as their logic is merged into fetchDashboardData
  // const fetchStats = async () => { ... };
  // const fetchRecentActivity = async () => { ... };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      showNotification(t('adminEnterBroadcast'), 'error');
      return;
    }

    try {
      let socket = socketService.getSocket();

      if (!socket) {
        socket = socketService.connect();
      }

      if (socket) {
        socket.emit('broadcast_admin', {
          content: broadcastMessage.trim(),
          timestamp: new Date().toISOString(),
          admin: user?.username
        });

        const newActivity = {
          id: Date.now(),
          type: 'broadcast',
          message: t('adminActivityBroadcast', { message: broadcastMessage.trim() }),
          timestamp: new Date().toISOString(),
          user: user?.username || 'Admin'
        };

        setRecentActivity(prev => [newActivity, ...prev.slice(0, 14)]);
        setBroadcastMessage('');
      } else {
        showNotification(t('socketError'), 'error');
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      showNotification(t('adminBroadcastFailed'), 'error');
    }
  };

  const sendTestBroadcast = () => {
    const testMessages = [
      "🎉 Welcome to our platform! Enjoy the new features!",
      "⚠️ System maintenance scheduled for tonight at 2 AM",
      "🚀 New update coming soon with amazing features!",
      "❤️ Thank you for being an active member of our community!",
      "📢 Important announcement: Check out our new guidelines"
    ];

    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
    setBroadcastMessage(randomMessage);
  };

  const clearBroadcast = () => {
    setBroadcastMessage('');
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type, visible: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const quickActions: QuickAction[] = [
    {
      icon: '🚩',
      label: t('adminTabReports'),
      description: t('adminActionReportsDesc'),
      action: () => setActiveTab('reports')
    },
    {
      icon: '🎥',
      label: t('adminTabVideos'),
      description: t('adminActionVideosDesc'),
      action: () => setActiveTab('videos')
    },
    {
      icon: '👥',
      label: t('adminTabUsers'),
      description: t('adminActionUsersDesc'),
      action: () => setActiveTab('users')
    },
    {
      icon: '⚙️',
      label: t('adminTabSettings'),
      description: t('adminActionSettingsDesc'),
      action: () => setActiveTab('settings')
    }
  ];

  const statCards = [
    {
      icon: '👥',
      value: stats.totalUsers,
      label: t('adminStatsTotalUsers'),
      color: 'from-blue-400 to-indigo-600',
      bgColor: 'bg-blue-500/5'
    },
    {
      icon: '🎥',
      value: stats.totalVideos,
      label: t('adminStatsTotalVideos'),
      color: 'from-emerald-400 to-teal-600',
      bgColor: 'bg-emerald-500/5'
    },
    {
      icon: '💬',
      value: stats.totalMessages,
      label: t('adminStatsMessages'),
      color: 'from-fuchsia-400 to-purple-600',
      bgColor: 'bg-purple-500/5'
    },
    {
      icon: '⚡',
      value: stats.activeUsers,
      label: t('adminStatsActiveNow'),
      color: 'from-amber-400 to-orange-600',
      bgColor: 'bg-orange-500/5'
    },
    {
      icon: '🚩',
      value: stats.pendingReports,
      label: t('adminStatsPendingReports'),
      color: 'from-rose-400 to-red-600',
      bgColor: 'bg-red-500/5'
    },
    {
      icon: '📊',
      value: stats.totalReports,
      label: t('adminStatsTotalReports'),
      color: 'from-orange-400 to-yellow-600',
      bgColor: 'bg-yellow-500/5'
    },
    {
      icon: '💾',
      value: `${(stats.storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB`,
      label: t('adminStatsStorageUsed'),
      color: 'from-cyan-400 to-blue-600',
      bgColor: 'bg-cyan-500/5'
    },
    {
      icon: '📈',
      value: stats.dailyUploads,
      label: t('adminStatsTodayUploads'),
      color: 'from-pink-400 to-rose-600',
      bgColor: 'bg-pink-500/5'
    },
    {
      icon: '🚫',
      value: stats.bannedUsers,
      label: t('adminStatsBannedUsers'),
      color: 'from-gray-500 to-slate-800',
      bgColor: 'bg-gray-500/5'
    },
    {
      icon: '📌',
      value: stats.pinnedVideos,
      label: t('adminStatsPinnedVideos'),
      color: 'from-yellow-400 to-amber-600',
      bgColor: 'bg-yellow-500/5'
    },
    {
      icon: '👁️',
      value: stats.totalViews,
      label: t('adminStatsTotalViews'),
      color: 'from-indigo-400 to-blue-600',
      bgColor: 'bg-indigo-500/5'
    },
    {
      icon: '❤️',
      value: stats.totalLikes,
      label: t('adminStatsTotalLikes'),
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/5'
    },
  ];

  if (!user || !isModerator) {
    return (
      <div className="min-h-screen bg-white dark:bg-black pt-16 flex items-center justify-center px-4 transition-colors duration-300">
        <div className="text-center max-w-md w-full">
          <div className="text-4xl sm:text-6xl mb-4">🚫</div>
          <h2 className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">{t('adminAccessDenied')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
            {t('adminAuthRequired')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="ui-button ui-button--primary ui-button--lg interactive px-4 sm:px-6 rounded-[var(--radius-pill)] font-bold text-sm sm:text-base"
          >
            {t('goHome')}
          </button>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'reports':
        return <ReportManagement showNotification={showNotification} />;
      case 'videos':
        return <VideoManagement showNotification={showNotification} />;
      case 'users':
        return <UserManagement showNotification={showNotification} />;
      case 'tenants':
        return <SuperAdminDashboard />;
      case 'settings':
        // Tenant Admins will see SystemSettings but we might need to customize it or pass a prop
        return <SystemSettings showNotification={showNotification} />;
      default:
        // Default views based on role
        if (activeTab === 'dashboard') {
          if (isSuperAdmin) return <SuperAdminDashboard />;
          if (isAdmin) return <TenantAdminDashboard setActiveTab={setActiveTab} />; // Pass setActiveTab
        }
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4 mb-8">
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            className={`${stat.bgColor} backdrop-blur-md rounded-2xl p-4 border border-white/5 dark:border-white/5 hover:border-white/20 transition-all relative overflow-hidden shadow-2xl group`}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl sm:text-3xl opacity-80 group-hover:opacity-100 transition-opacity">
                {stat.icon}
              </div>
              {loading && (
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black mb-1 truncate text-gray-900 dark:text-white tracking-tight">
              {typeof stat.value === 'number' && stat.value > 9999
                ? `${(stat.value / 1000).toFixed(1)}k`
                : stat.value}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</div>

            {/* Gradient Accent */}
            <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,0,0,0.2)]`}></div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Broadcast & Actions */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Broadcast Section */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">📢 {t('adminBroadcastTitle')}</h2>

            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder={t('adminBroadcastPlaceholder')}
                  className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-200 dark:border-gray-600 resize-none h-24 sm:h-32 placeholder-gray-400 transition-colors text-sm sm:text-base shadow-inner"
                  maxLength={200}
                />
                <div className="absolute bottom-2 right-2 text-xs sm:text-sm text-gray-400">
                  {broadcastMessage.length}/200
                </div>
              </div>

              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                <button
                  onClick={sendBroadcast}
                  disabled={!broadcastMessage.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-400 transition-all font-medium flex items-center justify-center space-x-2 disabled:cursor-not-allowed text-sm sm:text-base flex-1"
                >
                  <span>📢</span>
                  <span>{t('adminSendBroadcast')}</span>
                </button>

                <button
                  onClick={sendTestBroadcast}
                  className="bg-white dark:bg-gray-800 text-gray-700 dark:text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold border border-gray-200 dark:border-gray-600 text-xs sm:text-sm shadow-sm"
                >
                  {t('adminTestMessage')}
                </button>

                <button
                  onClick={clearBroadcast}
                  className="bg-white dark:bg-gray-800 text-gray-700 dark:text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium border border-gray-200 dark:border-gray-600 text-xs sm:text-sm shadow-sm"
                >
                  {t('adminClear')}
                </button>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 sm:p-3">
                <p className="text-yellow-400 text-xs sm:text-sm">
                  <strong>{t('note')}:</strong> {t('adminBroadcastNote')}
                </p>
                <ul className="text-yellow-400/80 text-xs sm:text-sm mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                  <li>• {t('adminBroadcastDetail1')}</li>
                  <li>• {t('adminBroadcastDetail2')}</li>
                  <li>• {t('adminBroadcastDetail3')}</li>
                  <li>• {t('adminBroadcastDetail4')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* AI Content Trends */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white">📈</span>
                {t('adminAiTrendAnalysis')}
              </h2>
            </div>
            <div className="space-y-4">
              {aiTrends.map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">#{idx + 1}</span>
                    <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider">{trend.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-[rgb(var(--primary-accent))]">{t('viewsCount', { count: trend.total_views })}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">{t('videosCount', { count: trend.count })}</div>
                  </div>
                </div>
              ))}
              {aiTrends.length === 0 && (
                <p className="text-center text-gray-500 py-4 italic">{t('noTrendData') || 'No trend data available yet.'}</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">🚀 {t('adminQuickActions')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.label}
                  onClick={action.action}
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 sm:p-4 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group border border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-gray-600 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3 mb-1 sm:mb-2">
                    <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                      {action.icon}
                    </span>
                    <span className="font-bold text-sm sm:text-base">{action.label}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{action.description}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 h-full shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">📝 {t('adminRecentActivity')}</h2>
              <button
                onClick={fetchDashboardData}
                className="text-[var(--text-secondary)] hover:text-[rgb(var(--primary-accent))] transition-colors text-xs sm:text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] px-2 sm:px-3 py-1 rounded shadow-sm"
              >
                {t('adminRefresh')}
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-400">
                  <div className="text-3xl sm:text-4xl mb-2">📝</div>
                  <p className="text-sm sm:text-base">{t('adminNoActivity')}</p>
                  <p className="text-xs sm:text-sm mt-1">{t('adminActivitiesWillAppear')}</p>
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <motion.div
                    key={activity.id}
                    className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group border border-gray-100 dark:border-gray-700 shadow-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mt-1.5 sm:mt-2 flex-shrink-0 ${activity.type === 'broadcast' ? 'bg-yellow-400' :
                      activity.type === 'upload' ? 'bg-green-400' :
                        activity.type === 'user' ? 'bg-blue-400' :
                          activity.type === 'report' ? 'bg-red-400' :
                            'bg-purple-400'
                      }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white text-xs sm:text-sm group-hover:text-[rgb(var(--primary-accent))] dark:group-hover:text-white/90 leading-relaxed font-medium">
                        {activity.message}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 sm:mt-1">
                        {new Date(activity.timestamp).toLocaleTimeString()} • {activity.user}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="mt-4 sm:mt-6 bg-gradient-to-r from-green-500/10 to-emerald-500/20 rounded-lg p-3 sm:p-4 border border-green-500/20">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-400 font-medium text-sm sm:text-base">{t('adminSystemStatus')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-400">{t('adminWebServer')}</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-400">{t('adminDatabase')}</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-400">{t('adminSocketServer')}</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-400">{t('adminFileStorage')}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white pt-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 sm:mb-8">
          <div className="text-center lg:text-left mb-4 lg:mb-0">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-white">{t('adminDashboard')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              {t('adminWelcome')}, <span className="text-gray-900 dark:text-white font-bold">{user.username}</span>
              <span className="ml-2 bg-[rgb(var(--primary-accent))] px-2 py-0.5 sm:py-1 rounded text-xs text-white">
                {isSuperAdmin ? t('adminRoleSuperAdmin') : (isAdmin ? t('adminAdminRole') : t('adminModeratorRole'))}
              </span>
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 sm:space-x-2 mb-4 lg:mb-0 overflow-x-auto pb-2">
            {[
              { key: 'dashboard', label: t('adminTabDashboard'), roles: ['super_admin', 'admin', 'moderator'] },
              { key: 'reports', label: t('adminTabReports'), roles: ['super_admin', 'admin', 'moderator'], badge: stats.pendingReports },
              { key: 'videos', label: t('adminTabVideos'), roles: ['super_admin', 'admin', 'moderator'] },
              { key: 'users', label: t('adminTabUsers'), roles: ['super_admin', 'admin'] },
              { key: 'tenants', label: t('adminTabTenants') || 'Tenants', roles: ['super_admin'] },
              { key: 'settings', label: t('adminTabSettings'), roles: ['super_admin', 'admin'] }
            ].filter(tab => {
              if (tab.roles.includes('super_admin') && isSuperAdmin) return true;
              if (tab.roles.includes('admin') && isAdmin) {
                // Explicitly allow these tabs for Tenant Admin
                return ['dashboard', 'users', 'videos', 'reports', 'settings'].includes(tab.key);
              }
              if (tab.roles.includes('moderator') && isModerator) return true;
              return false;
            }).map((tab) => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors whitespace-nowrap relative text-xs sm:text-sm font-bold ${activeTab === tab.key
                  ? 'bg-[rgb(var(--primary-accent))] dark:bg-white text-white dark:text-black shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-5 flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 justify-center lg:justify-start">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="bg-white dark:bg-gray-800 text-gray-700 dark:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-1 sm:space-x-2 disabled:opacity-50 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 shadow-sm font-bold"
            >
              <span>🔄</span>
              <span>{loading ? t('adminRefreshing') : t('adminRefresh')}</span>
            </button>

            {/* Language Toggle Button */}
            <button
              onClick={() => {
                const newLang = currentLanguage === 'ar' ? 'en' : 'ar';
                changeLanguage(newLang);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm font-medium"
              title={currentLanguage === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <span>🌐</span>
              <span>{currentLanguage === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            <div className="text-xs sm:text-sm text-gray-400 hidden sm:block">
              {t('adminLastUpdated')}: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Render Active Tab */}
        {renderActiveTab()}
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification.visible && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className={`fixed top-16 sm:top-20 right-3 sm:right-6 p-3 sm:p-4 rounded-lg font-medium z-50 shadow-lg text-sm sm:text-base ${notification.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
              }`}
          >
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <span>✅</span>
              ) : (
                <span>❌</span>
              )}
              <span>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
