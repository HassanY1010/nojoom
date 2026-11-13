import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Video,
    HardDrive,
    Activity,
    Plus,
    MoreVertical,
    Globe,
    Server,
    Shield,
    Trash2,
    Edit2
} from 'lucide-react';

interface Tenant {
    id: number;
    name: string;
    subdomain: string;
    custom_domain: string | null;
    subscription_plan: string;
    storage_used_gb: number;
    storage_limit_gb: number;
    is_active: boolean;
    total_users: number;
    total_videos: number;
    created_at: string;
}

const SuperAdminDashboard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTenant, setNewTenant] = useState({
        name: '',
        subdomain: '',
        customDomain: '',
        subscriptionPlan: 'basic',
        storageLimit: 10,
        maxUsers: 100,
        isTrial: false
    });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        customDomain: '',
        subscriptionPlan: '',
        storageLimit: 0,
        maxUsers: 0
    });

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            const response = await api.get('/admin/super/tenants');
            setTenants(response.data.tenants);
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const createTenant = async () => {
        try {
            await api.post('/admin/super/tenants', newTenant);
            setShowCreateModal(false);
            fetchTenants();
            setNewTenant({
                name: '',
                subdomain: '',
                customDomain: '',
                subscriptionPlan: 'basic',
                storageLimit: 10,
                maxUsers: 100,
                isTrial: false
            });
        } catch (error) {
            console.error('Error creating tenant:', error);
        }
    };

    const handleEditTenant = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setEditForm({
            name: tenant.name,
            customDomain: tenant.custom_domain || '',
            subscriptionPlan: tenant.subscription_plan,
            storageLimit: tenant.storage_limit_gb,
            maxUsers: tenant.total_users // This assumes max_users is available or we use total_users as placeholder if API doesn't return max_users
        });
        setShowEditModal(true);
    };

    const updateTenant = async () => {
        if (!editingTenant) return;
        try {
            await api.put(`/admin/super/tenants/${editingTenant.id}`, {
                name: editForm.name,
                customDomain: editForm.customDomain,
                subscriptionPlan: editForm.subscriptionPlan,
                storageLimit: Number(editForm.storageLimit),
                maxUsers: Number(editForm.maxUsers)
            });
            setShowEditModal(false);
            setEditingTenant(null);
            fetchTenants();
        } catch (error) {
            console.error('Error updating tenant:', error);
        }
    };

    const toggleTenantStatus = async (id: number, isActive: boolean) => {
        try {
            await api.put(`/admin/super/tenants/${id}`, { isActive: !isActive });
            fetchTenants();
        } catch (error) {
            console.error('Error updating tenant:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-transparent p-4 sm:p-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-blue-500" />
                            {t('superAdminDashboard')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {t('manage')} {tenants.length} {t('tenants')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        {t('createTenant')}
                    </button>
                </div>

                {/* Tenants Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tenants.map((tenant) => (
                        <div key={tenant.id} className="relative group bg-white dark:bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/50 p-6 transition-all hover:border-blue-500/50 hover:shadow-2xl hover:-translate-y-1">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-start gap-3">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                        <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tenant.name}</h3>
                                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            <Globe className="w-3 h-3" />
                                            {tenant.subdomain}.nojoom.app
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tenant.is_active
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                                            }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        {tenant.is_active ? t('tenantActive') : t('tenantInactive')}
                                    </span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        {t('plan')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                        {tenant.subscription_plan}
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {t('users')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                        {tenant.total_users}
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Video className="w-3 h-3" />
                                        {t('videos')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                        {tenant.total_videos}
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        {t('storage')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white text-xs">
                                        {(Number(tenant.storage_used_gb) || 0).toFixed(2)} / {tenant.storage_limit_gb} GB
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-gray-500 dark:text-gray-400">{t('storage')}</span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {Math.round(((Number(tenant.storage_used_gb) || 0) / tenant.storage_limit_gb) * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(((Number(tenant.storage_used_gb) || 0) / tenant.storage_limit_gb) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                <button
                                    onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${tenant.is_active
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                                        : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                                        }`}
                                >
                                    {tenant.is_active ? t('deactivate') : t('activate')}
                                </button>
                                <button
                                    onClick={() => handleEditTenant(tenant)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition duration-200"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    {t('manage')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-6 h-6 text-blue-500" />
                                {t('createTenant')}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tenantName')}</label>
                                    <input
                                        type="text"
                                        value={newTenant.name}
                                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                        placeholder={t('groupNamePlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('subdomain')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newTenant.subdomain}
                                            onChange={(e) => setNewTenant({ ...newTenant, subdomain: e.target.value })}
                                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white ${isRTL ? 'pl-24' : 'pr-24'}`}
                                            placeholder="my-app"
                                        />
                                        <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none ${isRTL ? 'left-4' : 'right-4'}`}>
                                            .nojoom.app
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('plan')}</label>
                                    <select
                                        value={newTenant.subscriptionPlan}
                                        onChange={(e) => setNewTenant({ ...newTenant, subscriptionPlan: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                    >
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newTenant.isTrial}
                                            onChange={(e) => setNewTenant({ ...newTenant, isTrial: e.target.checked })}
                                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                        />
                                    </div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t('tenantTrial')} (30 {t('daysAgo')})
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition font-medium"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={createTenant}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-500/20"
                                >
                                    {t('create')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && editingTenant && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                                <Edit2 className="w-6 h-6 text-blue-500" />
                                {t('manage')} {t('tenant')}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tenantName')}</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customDomain')} ({t('optional')})</label>
                                    <input
                                        type="text"
                                        value={editForm.customDomain}
                                        onChange={(e) => setEditForm({ ...editForm, customDomain: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                        placeholder="example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('plan')}</label>
                                    <select
                                        value={editForm.subscriptionPlan}
                                        onChange={(e) => setEditForm({ ...editForm, subscriptionPlan: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                    >
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storage')} (GB)</label>
                                        <input
                                            type="number"
                                            value={editForm.storageLimit}
                                            onChange={(e) => setEditForm({ ...editForm, storageLimit: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('usersLimit')}</label>
                                        <input
                                            type="number"
                                            value={editForm.maxUsers}
                                            onChange={(e) => setEditForm({ ...editForm, maxUsers: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition font-medium"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={updateTenant}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-500/20"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
