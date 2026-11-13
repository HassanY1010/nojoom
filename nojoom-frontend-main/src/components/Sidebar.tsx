import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { motion } from 'framer-motion';
import { Bell, Compass, House, MessageCircle, Plus, Radio, Shield, User, Users, Wallet } from 'lucide-react';

const Sidebar: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const { user, isModerator, isSuperAdmin } = useAuthStore();
    const { isRTL } = useLanguageStore();

    const menuItems = [
        { path: '/', label: t('home'), icon: House },
        { path: '/explore', label: t('explore'), icon: Compass },
        { path: '/friends', label: t('following'), icon: Users },
        { path: '/live', label: t('live'), icon: Radio },
        { path: '/messages', label: t('chat'), icon: MessageCircle },
        { path: '/notifications', label: t('notifications'), icon: Bell },
        { path: '/upload', label: t('upload'), icon: Plus },
        { path: `/profile/${user?.username}`, label: t('profile'), icon: User },
        { path: '/groups', label: t('groups'), icon: Users },
        { path: '/wallet', label: t('wallet'), icon: Wallet },
        ...(isModerator ? [{
            path: '/admin',
            label: isSuperAdmin ? t('superAdminPanel') : t('adminPanel'),
            icon: Shield
        }] : []),
    ];

    return (
        <aside className={`hidden lg:flex flex-col w-64 h-screen fixed top-0 ${isRTL ? 'right-0' : 'left-0'} glass-panel z-40 overflow-y-auto pt-24 pb-20 custom-scrollbar border-none shadow-[var(--shadow-card)]`}>
            <div className="flex flex-col space-y-2 px-4">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={!user && item.path !== '/' ? '/login' : item.path}
                            className={`ui-nav-item flex items-center gap-4 px-6 transition-all duration-300 group relative overflow-hidden ${isActive
                                ? 'is-active active-glow'
                                : 'hover:text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] opacity-90 hover:opacity-100'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidebarActive"
                                    className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-2 bottom-2 w-1.5 bg-[rgb(var(--primary-accent))] rounded-full shadow-[0_0_12px_rgba(var(--primary-accent),0.45)]`}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}

                            <span className={`transition-all duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                                <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`} strokeWidth={2} />
                            </span>

                            <span className={`text-sm font-bold ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {item.label}
                            </span>

                            {/* Hover Backdrop Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--primary-accent))]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </Link>
                    );
                })}
            </div>


        </aside>
    );
};

export default Sidebar;
