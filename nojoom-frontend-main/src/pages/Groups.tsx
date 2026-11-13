import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { groupApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { getMediaUrl } from '../utils/urlUtils';
import { Plus, Users } from 'lucide-react';
import './Groups.css';

interface Group {
    id: number;
    name: string;
    description: string;
    image: string;
    member_count: number;
    is_member?: boolean;
}

const Groups: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [groups, setGroups] = useState<Group[]>([]);
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [activeTab, setActiveTab] = useState<'discover' | 'my-groups'>('discover');
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [newGroupImage, setNewGroupImage] = useState<File | null>(null);

    useEffect(() => {
        fetchGroups();
        if (user) fetchMyGroups();
    }, [user]);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await groupApi.listGroups();
            setGroups(response.data.data || []);
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyGroups = async () => {
        try {
            const response = await groupApi.myGroups();
            setMyGroups(response.data.data || []);
        } catch (error) {
            console.error('Error fetching my groups:', error);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName) return;

        try {
            const formData = new FormData();
            formData.append('name', newGroupName);
            formData.append('description', newGroupDesc);
            if (newGroupImage) formData.append('image', newGroupImage);

            const response = await groupApi.createGroup(formData);
            if (response.data.success) {
                setShowCreateModal(false);
                setNewGroupName('');
                setNewGroupDesc('');
                setNewGroupImage(null);
                fetchGroups();
                fetchMyGroups();
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert(t('failedCreateGroup') || 'Failed to create group');
        }
    };

    const handleJoinLeave = async (group: Group) => {
        try {
            if (group.is_member) {
                await groupApi.leaveGroup(group.id);
            } else {
                await groupApi.joinGroup(group.id);
            }
            fetchGroups();
            fetchMyGroups();
        } catch (error) {
            console.error('Error join/leave group:', error);
        }
    };

    return (
        <div className="groups-page p-4 lg:p-6 bg-[var(--bg-base)] text-[var(--text-primary)]">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-2"><Users className="w-6 h-6 text-[rgb(var(--primary-accent))]" /> {t('groupsTitle') || 'Groups'}</h1>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="ui-button ui-button--primary interactive px-5 active:scale-95 inline-flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> {t('createGroup') || 'Create Group'}
                </button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => setActiveTab('discover')}
                    className={`ui-chip ${activeTab === 'discover' ? 'is-active' : ''}`}
                >
                    {t('discoverGroups') || 'Discover'}
                </button>
                <button
                    onClick={() => setActiveTab('my-groups')}
                    className={`ui-chip ${activeTab === 'my-groups' ? 'is-active' : ''}`}
                >
                    {t('myGroups') || 'My Groups'}
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20">{t('loadingGroups') || 'Loading groups...'}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(activeTab === 'discover' ? groups : myGroups).map((group) => (
                        <div key={group.id} className="group-card bg-[var(--bg-card)] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border-subtle)] shadow-sm">
                            <div className="h-32 bg-[color-mix(in_srgb,var(--primary)_12%,var(--bg-card))] relative">
                                {group.image && (
                                    <img src={getMediaUrl(group.image)} alt={group.name} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="p-4">
                                <h3 className="text-base sm:text-lg font-extrabold mb-1 text-[var(--text-primary)]">{group.name}</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-3 h-10 overflow-hidden line-clamp-2">
                                    {group.description}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-[var(--text-secondary)]">{t('membersCount', { count: group.member_count }) || `${group.member_count} members`}</span>
                                    <button
                                        onClick={() => handleJoinLeave(group)}
                                        className={`ui-button ${group.is_member ? 'ui-button--secondary' : 'ui-button--primary'} interactive px-4 rounded-[var(--radius-md)] active:scale-95`}
                                    >
                                        {group.is_member ? t('joinedGroup') || 'Joined' : t('joinGroup') || 'Join'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="ui-card w-full max-w-md"
                        >
                            <h2 className="text-lg font-extrabold mb-4 text-[var(--text-primary)]">{t('createNewGroup') || 'Create New Group'}</h2>
                            <form onSubmit={handleCreateGroup} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">{t('groupNameLabel') || 'Group Name'}</label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="w-full ui-input px-4 focus:ring-0"
                                        placeholder={t('groupNamePlaceholder') || 'Enter group name'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">{t('descriptionLabel') || 'Description'}</label>
                                    <textarea
                                        value={newGroupDesc}
                                        onChange={(e) => setNewGroupDesc(e.target.value)}
                                        className="w-full ui-input px-4 h-24 focus:ring-0"
                                        placeholder={t('groupDescriptionPlaceholder') || 'What is this group about?'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">{t('groupImageLabel') || 'Group Image'}</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setNewGroupImage(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-[var(--text-secondary)] rounded-lg"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 ui-button ui-button--secondary interactive active:scale-95"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 ui-button ui-button--primary interactive active:scale-95"
                                    >
                                        {t('create')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Groups;

