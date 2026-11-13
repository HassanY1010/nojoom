import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface TenantStats {
    total_users: number;
    total_videos: number;
    total_comments: number;
    pending_reports: number;
}

interface StorageStats {
    storage_used_gb: number;
    storage_limit_gb: number;
    bandwidth_used_gb: number;
    bandwidth_limit_gb: number;
}

interface TenantAdminDashboardProps {
    setActiveTab?: (tab: string) => void;
}

const TenantAdminDashboard: React.FC<TenantAdminDashboardProps> = ({ setActiveTab }) => {
    const { t } = useTranslation();
    const navigate = useNavigate(); // Keep for backup but prefer setActiveTab
    const [stats, setStats] = useState<TenantStats | null>(null);
    const [storage, setStorage] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await api.get('/admin/tenant/dashboard');
            setStats(response.data.stats);
            setStorage(response.data.storage);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    const storagePercentage = storage
        ? (storage.storage_used_gb / storage.storage_limit_gb) * 100
        : 0;

    const bandwidthPercentage = storage
        ? (storage.bandwidth_used_gb / storage.bandwidth_limit_gb) * 100
        : 0;

    return (
        <div className="min-h-screen bg-transparent p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">Tenant Admin Dashboard</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('tenantStatsTotalUsers')}</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.total_users || 0}</p>
                            </div>
                            <div className="bg-blue-100 p-3 rounded-full">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t('tenantStatsTotalVideos')}</p>
                                <p className="text-3xl font-bold text-gray-900">{stats?.total_videos || 0}</p>
                            </div>
                            <div className="bg-purple-100 p-3 rounded-full">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t('tenantStatsTotalComments')}</p>
                                <p className="text-3xl font-bold text-gray-900">{stats?.total_comments || 0}</p>
                            </div>
                            <div className="bg-green-100 p-3 rounded-full">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t('tenantStatsPendingReports')}</p>
                                <p className="text-3xl font-bold text-gray-900">{stats?.pending_reports || 0}</p>
                            </div>
                            <div className="bg-red-100 p-3 rounded-full">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('tenantStorageUsage')}</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600">{t('tenantStorage')}</span>
                                    <span className="font-medium">
                                        {Number(storage?.storage_used_gb || 0).toFixed(2)} / {storage?.storage_limit_gb} GB
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all ${storagePercentage > 90 ? 'bg-red-600' : storagePercentage > 70 ? 'bg-yellow-600' : 'bg-green-600'
                                            }`}
                                        style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600">{t('tenantBandwidth')}</span>
                                    <span className="font-medium">
                                        {Number(storage?.bandwidth_used_gb || 0).toFixed(2)} / {storage?.bandwidth_limit_gb} GB
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all ${bandwidthPercentage > 90 ? 'bg-red-600' : bandwidthPercentage > 70 ? 'bg-yellow-600' : 'bg-blue-600'
                                            }`}
                                        style={{ width: `${Math.min(bandwidthPercentage, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('tenantQuickActions')}</h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => setActiveTab ? setActiveTab('users') : navigate('/admin/users')}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-left font-medium"
                            >
                                {t('tenantManageUsers')}
                            </button>
                            <button
                                onClick={() => setActiveTab ? setActiveTab('videos') : navigate('/admin/videos')}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-left font-medium"
                            >
                                {t('tenantManageVideos')}
                            </button>
                            <button
                                onClick={() => setActiveTab ? setActiveTab('reports') : navigate('/admin/reports')}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-left font-medium"
                            >
                                {t('tenantViewReports')}
                            </button>
                            <button
                                onClick={() => setActiveTab ? setActiveTab('settings') : navigate('/admin/settings')}
                                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-left font-medium"
                            >
                                {t('tenantSettingsBranding')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantAdminDashboard;
