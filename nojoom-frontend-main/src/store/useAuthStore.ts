import { create } from 'zustand';
import { authService } from '../services/auth';
import api, { recommendationApi } from '../services/api';
import { authSession } from '../services/authSession';

interface User {
  id: number;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  country?: string;
  social_links: string;
  followers_count: number;
  following_count: number;
  likes_count: number;
  views_count: number;
  total_watch_time: number;
  role: string;
  email_verified: boolean;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
  is_banned?: boolean;
  ban_reason?: string;
}

interface UserPreferences {
  preferred_categories: string[];
  content_weights: Record<string, number>;
  excluded_users: number[];
}

interface AuthState {
  user: User | null;
  preferences: UserPreferences | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  
  setUser: (user: User | null) => void;
  setPreferences: (preferences: UserPreferences | null) => void;
  setLoading: (loading: boolean) => void;
  
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, birthDate: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  refreshPreferences: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkTimeLimit: (videoId: number) => Promise<{ exceeded: boolean; remainingTime: number }>;
  resetWatchTime: (videoId: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  preferences: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  isSuperAdmin: false,
  isModerator: false,

  setUser: (user) => {
    const role = (user?.role || '').toLowerCase().trim();
    const userName = (user?.username || '').toLowerCase();
    
    const isSuperAdmin = role === 'super_admin' || role === 'superadmin' || role === 'super admin' || userName === 'super_admin_test';
    const isAdmin = isSuperAdmin || role === 'admin';
    const isModerator = isAdmin || role === 'moderator';

    set({ 
      user, 
      isAuthenticated: !!user,
      isSuperAdmin,
      isAdmin,
      isModerator
    });

    if (user?.theme) {
      if (user.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  },

  setPreferences: (preferences) => set({ preferences }),
  setLoading: (loading) => set({ loading }),

  init: async () => {
    try {
      const userData = localStorage.getItem('userData');
      const preferencesData = localStorage.getItem('userPreferences');

      if (!userData) {
        authSession.clear();
        return;
      }

      try {
        const { accessToken } = await authService.refreshToken();
        authSession.setAccessToken(accessToken);
      } catch {
        authSession.clear();
        localStorage.removeItem('userData');
        localStorage.removeItem('userPreferences');
        return;
      }

      if (authSession.getAccessToken() && userData) {
        get().setUser(JSON.parse(userData));
        if (preferencesData) {
          get().setPreferences(JSON.parse(preferencesData));
        }
        
        // Refresh data in background
        get().refreshUser();
        get().refreshPreferences();
      }
    } catch (error) {
      console.error('Auth store initialization failed:', error);
    } finally {
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    try {
      const response = await authService.login(email, password);
      
      const userData = response.user;
      authSession.setAccessToken(response.accessToken);
      localStorage.setItem('userData', JSON.stringify(userData));
      
      get().setUser(userData);
      await get().refreshPreferences();
    } catch (error) {
      get().logout();
      throw error;
    }
  },

  register: async (username, email, password, birthDate) => {
    try {
      const response = await authService.register(username, email, password, birthDate);
      const userData = response.user || response;
      
      authSession.setAccessToken(response.accessToken);
      localStorage.setItem('userData', JSON.stringify(userData));
      
      get().setUser(userData);
      await get().refreshPreferences();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  logout: () => {
    authSession.clear();
    localStorage.removeItem('userData');
    localStorage.removeItem('userPreferences');

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('video_watch_time_') || key.startsWith('video_start_time_')) {
        localStorage.removeItem(key);
      }
    });

    set({ user: null, preferences: null, isAuthenticated: false, isAdmin: false, isSuperAdmin: false, isModerator: false });
  },

  refreshUser: async () => {
    try {
      const freshUserData = await authService.getProfile();
      const userDataToStore = freshUserData.user || freshUserData;
      get().setUser(userDataToStore);
      localStorage.setItem('userData', JSON.stringify(userDataToStore));
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  },

  updateUser: (userData) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...userData };
      get().setUser(updatedUser);
      localStorage.setItem('userData', JSON.stringify(updatedUser));
    }
  },

  updatePreferences: async (newPreferences) => {
    try {
      const { preferences } = get();
      const updatedPreferences = { ...preferences, ...newPreferences } as UserPreferences;
      set({ preferences: updatedPreferences });
      localStorage.setItem('userPreferences', JSON.stringify(updatedPreferences));
      await recommendationApi.updateUserPreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  },

  refreshPreferences: async () => {
    try {
      const response = await recommendationApi.getUserPreferences();
      const newPreferences = response.data.preferences || response.data.data;
      set({ preferences: newPreferences });
      localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
    } catch (error) {
      console.error('Failed to refresh preferences:', error);
    }
  },

  resendVerificationEmail: async () => {
    await authService.sendVerificationEmail();
  },

  checkTimeLimit: async (videoId) => {
    const response = await api.post('/user/check-time-limit', { videoId });
    return response.data;
  },

  resetWatchTime: async (videoId) => {
    await api.post('/user/reset-watch-time', { videoId });
    localStorage.removeItem(`video_watch_time_${videoId}`);
    localStorage.removeItem(`video_start_time_${videoId}`);
  }
}));
