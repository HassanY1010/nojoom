import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { useThemeStore } from '../store/useThemeStore';
import api from '../services/api';
import NotificationBell from './NotificationBell';
import { getMediaUrl } from '../utils/urlUtils';
import { Bell, Compass, Globe, Home, LogOut, Menu, MessageCircle, Moon, Plus, Radio, Search, Shield, Star, Sun, Upload, User, Users, Wallet } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout, isModerator, isSuperAdmin } = useAuthStore();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, isRTL } = useLanguageStore();

  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    navigate(`/explore?search=${encodeURIComponent(query)}`);
    setSearchQuery('');
  };

  useEffect(() => {
    if (user) {
      checkUserVideo();
    }
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkUserVideo = async () => {
    try {
      const response = await api.get('/videos/user/video');
      setHasVideo(!!response.data.video);
    } catch (error) {
      console.error('Failed to check user video:', error);
      setHasVideo(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const handleLanguageChange = () => {
    const newLanguage = currentLanguage === 'en' ? 'ar' : 'en';
    changeLanguage(newLanguage);
  };


  const navItems = user ? [
    { path: '/', label: t('home'), icon: Home, mobile: true },
    { path: '/search', label: t('search'), icon: Search, mobile: true },
    {
      path: '/upload',
      label: hasVideo ? t('changeVideo') : t('addVideo'),
      icon: hasVideo ? Upload : Plus,
      mobile: true
    },
    { path: '/messages', label: t('chat'), icon: MessageCircle, mobile: true },
    { path: `/profile/${user.username}`, label: t('profile'), icon: User, mobile: true },

    // Menu only items (Mobile 'More' + Desktop consistency)
    { path: '/explore', label: t('explore'), icon: Compass, mobile: false },
    { path: '/friends', label: t('following'), icon: Star, mobile: false },
    { path: '/live', label: t('live'), icon: Radio, mobile: false },
    { path: '/notifications', label: t('notifications'), icon: Bell, mobile: false },
    { path: '/groups', label: t('groups'), icon: Users, mobile: false },
    { path: '/wallet', label: t('wallet'), icon: Wallet, mobile: false },
    ...(isModerator ? [{
      path: '/admin',
      label: isSuperAdmin ? t('superAdminPanel') : t('admin'),
      icon: Shield,
      mobile: false
    }] : [])
  ] : [
    { path: '/', label: t('home'), icon: Home, mobile: true },
    { path: '/search', label: t('search'), icon: Search, mobile: true },
    { path: '/login', label: t('login'), icon: User, mobile: true },
    { path: '/register', label: t('signUp'), icon: Plus, mobile: false }
  ];

  const mobileNavItems = navItems.filter(item => item.mobile);
  const desktopNavItems = navItems;

  return (
    <>
      {/* Desktop Navigation */}
      <nav className={`hidden lg:flex fixed top-0 left-0 right-0 z-50 transition-all duration-500 h-20 glass-panel border-none ${isScrolled ? 'shadow-[var(--shadow-card)]' : ''}`}>
        <div className="max-w-[1920px] mx-auto w-full px-6 lg:px-12">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-3 rtl:space-x-reverse group"
              >
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.15)] group-hover:scale-110 transition-transform duration-500 rotate-3 group-hover:rotate-0">
                  <span className="text-black font-extrabold text-2xl italic">N</span>
                </div>
                <span className="dark:text-white text-gray-900 font-extrabold text-2xl tracking-tight group-hover:tracking-normal transition-all duration-500">Nojoom</span>
              </Link>
            </div>

            {/* Search Section - Premium Glassy Style */}
            <div className="flex-1 max-w-xl mx-12">
              <div className="relative group">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(searchQuery);
                    }
                  }}
                  onFocus={() => !user && navigate('/register')}
                  placeholder={t('search')}
                  className="w-full ui-input px-6 pr-14"
                />
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-0 top-0 h-full px-5 text-[var(--text-secondary)] hover:text-[rgb(var(--primary-accent))] transition-colors text-xl"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center space-x-5 rtl:space-x-reverse">
              {user ? (
                <>
                  <Link
                    to="/upload"
                    className="ui-button ui-button--primary interactive flex items-center space-x-2 rtl:space-x-reverse active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{hasVideo ? t('changeVideo') : t('upload')}</span>
                  </Link>

                  <Link
                    to="/messages"
                    className="text-2xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title={t('chat')}
                  >
                    💬
                  </Link>

                  <NotificationBell />

                  <button
                    onClick={() => navigate(user ? `/profile/${user.username}` : '/register')}
                    className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <img
                      src={getMediaUrl(user.avatar, { width: 80, height: 80, crop: 'fill' })}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="ui-button ui-button--primary interactive px-8 active:scale-95"
                  >
                    {t('login')}
                  </Link>
                </>
              )}

              {/* Settings Toggle */}
              <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-800 mx-2"></div>

              <button
                onClick={handleLanguageChange}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-xl"
                title={t('language')}
              >
                  <Globe className="w-5 h-5" />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-xl"
                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {user && (
                <button onClick={handleLogout} className="text-red-500 p-2 font-bold hover:scale-110 active:scale-95 transition-all">
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t-0 border-none lg:hidden rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 h-20">
          <div className="flex justify-around items-center h-20">
            {mobileNavItems.map((item) => (
              <Link
                key={item.path}
                to={!user && item.path !== '/' ? '/register' : item.path}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-[60px] ${location.pathname === item.path
                  ? 'text-[var(--text-primary)] bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] transform scale-105'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] sm:text-xs mt-1 text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-[60px] ${isMenuOpen
                ? 'text-[var(--text-primary)] bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] transform scale-105'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                }`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-bold uppercase tracking-widest">{t('more')}</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className={`absolute bottom-24 left-6 right-6 glass-panel border-none p-6 shadow-2xl transform transition-all duration-500 ease-out ${isMenuOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col space-y-3">
              {/* Language Toggle in Mobile Menu */}
              <button
                onClick={handleLanguageChange}
                  className="flex items-center justify-between p-3 text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--bg-card))] transition-colors"
              >
                <span className="font-bold">{t('language')}</span>
                <span className="text-lg">
                  {currentLanguage === 'en' ? '🇸🇦 العربية' : '🇬🇧 English'}
                </span>
              </button>


              {/* Theme Toggle in Mobile Menu */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between p-3 text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--bg-card))] transition-colors"
              >
                <span className="font-bold">{t('theme')}</span>
                <span className="text-lg font-bold">
                  {theme === 'dark' ? '☀️ ' + t('light') : '🌙 ' + t('dark')}
                </span>
              </button>

              {/* Additional Navigation Items */}
              {navItems.filter(item => !item.mobile).map((item) => (
                <Link
                  key={item.path}
                  to={!user && item.path !== '/' ? '/register' : item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 rtl:space-x-reverse p-3 rounded-xl transition-colors ${location.pathname === item.path
                    ? 'text-[var(--text-primary)] bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] border border-[color-mix(in_srgb,var(--primary)_45%,transparent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}

              {/* Logout in Mobile Menu */}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 rtl:space-x-reverse p-3 text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-xl transition-colors text-right"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t('logout')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for desktop nav */}
      <div className="hidden lg:block h-20"></div>
      {/* Spacer for mobile nav */}
      <div className="lg:hidden h-20"></div>
    </>
  );
};

export default Navbar;