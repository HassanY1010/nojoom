import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { getMediaUrl } from '../../utils/urlUtils';
import { useTranslation } from 'react-i18next';

const UserManagement = ({ showNotification }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchUsers = async (page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/users?page=${page}&limit=10&search=${searchTerm}`);
      setUsers(response.data.users);
      setPagination({
        page: response.data.pagination.page,
        totalPages: response.data.pagination.pages,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      showNotification(t('adminUsersLoadFailed') || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  const handleBan = async (userId, reason = 'Violation of community guidelines') => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;

    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason });
      fetchUsers(pagination.page, search);
      showNotification(t('adminUserBannedSuccess') || 'User banned successfully', 'success');
    } catch (error) {
      console.error('Failed to ban user:', error);
      showNotification(t('adminUserBanFailed') || 'Failed to ban user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId) => {
    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/unban`);
      fetchUsers(pagination.page, search);
      showNotification(t('adminUserUnbannedSuccess') || 'User unbanned successfully', 'success');
    } catch (error) {
      console.error('Failed to unban user:', error);
      showNotification(t('adminUserUnbanFailed') || 'Failed to unban user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    setActionLoading(userId);
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers(pagination.page, search);
      showNotification(t('adminUserDeletedSuccess') || 'User deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete user:', error);
      showNotification(t('adminUserDeleteFailed') || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await api.put(`/admin/users/${userId}`, { role: newRole });
      fetchUsers(pagination.page, search);
      showNotification(t('adminUserRoleUpdated') || 'User role updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update user role:', error);
      showNotification(t('adminUserRoleFailed') || 'Failed to update user role', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (user) => {
    if (user.is_banned) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-200">
          {t('adminBannedStatus')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
        {t('adminActiveStatus')}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { color: 'bg-purple-900 text-purple-200', label: t('adminAdminRole') },
      moderator: { color: 'bg-blue-900 text-blue-200', label: t('adminModeratorRole') },
      user: { color: 'bg-gray-900 text-gray-200', label: t('adminUserRole') }
    };

    const config = roleConfig[role] || roleConfig.user;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6 transition-colors duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('adminUserManagement')}</h2>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('adminSearchUsersPlaceholder')}
                className="w-full bg-white/5 dark:bg-white/5 backdrop-blur-md text-gray-900 dark:text-white pl-11 pr-4 py-3 rounded-2xl border border-white/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-xl placeholder-gray-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-2xl transition-all font-black uppercase tracking-widest shadow-lg shadow-purple-500/30 flex-1 sm:flex-none"
              >
                {t('search')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchUsers(1, '');
                }}
                className="bg-white/5 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-white px-6 py-3 rounded-2xl hover:bg-white/10 transition-all border border-white/10 font-bold flex-1 sm:flex-none"
              >
                {t('adminClear') || t('clear')}
              </button>
            </div>
          </div>
        </form>

        {/* Users Content - Card view for mobile, Table for desktop */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto"></div>
              <p className="mt-4 font-bold tracking-widest uppercase opacity-50">Loading users...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminUserLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminRoleLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminStatusLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminFollowersLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminJoinedLabel')}</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-11 w-11 relative">
                              <img
                                className="h-full w-full rounded-2xl object-cover shadow-lg"
                                src={getMediaUrl(user.avatar) || '/default-avatar.png'}
                                onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                alt={user.username}
                              />
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black ${user.is_banned ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-black text-gray-900 dark:text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">{user.username}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={actionLoading === user.id}
                            className="bg-black/40 text-gray-900 dark:text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                          >
                            <option value="user" className="bg-gray-900">{t('adminUserRole')}</option>
                            <option value="moderator" className="bg-gray-900">{t('adminModeratorRole')}</option>
                            <option value="admin" className="bg-gray-900">{t('adminAdminRole')}</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(user)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-700 dark:text-gray-300">
                          {user.followers_count || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-bold">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          {user.is_banned ? (
                            <button
                              onClick={() => handleUnban(user.id)}
                              disabled={actionLoading === user.id}
                              className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all disabled:opacity-50 font-bold"
                              title={t('adminUnban')}
                            >
                              {actionLoading === user.id ? '...' : '🔓'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBan(user.id)}
                              disabled={actionLoading === user.id}
                              className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 font-bold"
                              title={t('adminBan')}
                            >
                              {actionLoading === user.id ? '...' : '🚫'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={actionLoading === user.id}
                            className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 font-bold"
                            title={t('adminDelete')}
                          >
                            {actionLoading === user.id ? '...' : '🗑️'}
                          </button>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white transition-all font-bold"
                            title={t('adminViewDetails')}
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden p-4 space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="bg-white/5 rounded-3xl p-5 border border-white/5 relative overflow-hidden group">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 relative flex-shrink-0">
                        <img
                          className="h-full w-full rounded-2xl object-cover"
                          src={getMediaUrl(user.avatar) || '/default-avatar.png'}
                          onError={(e) => { e.target.src = '/default-avatar.png'; }}
                          alt={user.username}
                        />
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-black ${user.is_banned ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-black text-white uppercase tracking-tighter truncate">{user.username}</div>
                        <div className="text-sm text-gray-500 truncate">{user.email}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getRoleBadge(user.role)}
                        <span className="text-[10px] font-black text-purple-500">{user.followers_count || 0} followers</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                      <div className="flex gap-2">
                        {user.is_banned ? (
                          <button
                            onClick={() => handleUnban(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-4 py-2 rounded-xl bg-green-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            {t('adminUnban')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            {t('adminBan')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={actionLoading === user.id}
                          className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                        >
                          {t('adminDelete')}
                        </button>
                      </div>
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl"
                      >
                        👁️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {t('adminShowingXOfY', { count: users.length, total: pagination.total })}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchUsers(pagination.page - 1, search)}
                      disabled={pagination.page === 1 || loading}
                      className="px-3 py-1 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold shadow-sm"
                    >
                      {t('previous')}
                    </button>
                    <span className="px-3 py-1 text-gray-900 dark:text-white font-bold">
                      {t('pageOf', { current: pagination.page, total: pagination.totalPages })}
                    </span>
                    <button
                      onClick={() => fetchUsers(pagination.page + 1, search)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="px-3 py-1 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold shadow-sm"
                    >
                      {t('next')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10">
            <div className="relative">
              {/* Header / Cover Area */}
              <div className="h-32 bg-gradient-to-r from-purple-900 to-blue-900 relative">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-all"
                >
                  ✕
                </button>
              </div>

              {/* User Info Overlay */}
              <div className="px-8 pb-8">
                <div className="relative -mt-16 mb-6 flex justify-between items-end">
                  <div className="relative">
                    <img
                      className="h-32 w-32 rounded-3xl border-4 border-gray-900 shadow-2xl object-cover"
                      src={getMediaUrl(selectedUser.avatar) || '/default-avatar.png'}
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                      alt={selectedUser.username}
                    />
                    <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-gray-900 flex items-center justify-center text-xs ${selectedUser.is_banned ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                      {selectedUser.is_banned ? '🚫' : '✓'}
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {getRoleBadge(selectedUser.role)}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">{selectedUser.username}</h3>
                  <p className="text-gray-400 font-medium">{selectedUser.email}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-2xl font-black text-white mb-1">{selectedUser.followers_count || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('adminFollowersLabel')}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-2xl font-black text-white mb-1">{selectedUser.following_count || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('followingTitle')}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-lg font-black text-white mb-1">{formatDate(selectedUser.created_at)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('adminJoinedLabel')}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-lg font-black text-white mb-1">
                      {selectedUser.last_login ? formatDate(selectedUser.last_login) : '-'}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('adminLastLogin')}</div>
                  </div>
                </div>

                {/* Ban Status Area */}
                {selectedUser.is_banned && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-2 text-red-500 font-black uppercase tracking-wider">
                      <span className="text-2xl">🚫</span>
                      {t('adminBannedStatus')}
                    </div>
                    {selectedUser.ban_reason && (
                      <p className="text-red-200/80 text-sm leading-relaxed">
                        <span className="font-bold text-red-400 block mb-1 uppercase text-xs tracking-widest">{t('adminBanReason')}:</span>
                        {selectedUser.ban_reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">{t('adminQuickActions')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUser.is_banned ? (
                      <button
                        onClick={() => {
                          handleUnban(selectedUser.id);
                          setSelectedUser(null);
                        }}
                        className="py-4 bg-green-500 text-white rounded-xl hover:bg-green-400 transition-colors font-black uppercase tracking-widest shadow-lg shadow-green-500/20"
                      >
                        🔓 {t('adminUnban')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleBan(selectedUser.id);
                          setSelectedUser(null);
                        }}
                        className="py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-400 transition-colors font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                      >
                        🚫 {t('adminBan')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleDelete(selectedUser.id);
                        setSelectedUser(null);
                      }}
                      className="py-4 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-black uppercase tracking-widest shadow-lg shadow-red-600/20"
                    >
                      🗑️ {t('adminDelete')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;