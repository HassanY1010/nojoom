import api from './api';
import { authSession } from './authSession';

export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (
    username: string,
    email: string,
    password: string,
    birthDate: string
  ) => {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      birthDate,
    });
    return response.data;
  },

  checkUsernameAvailability: async (username: string) => {
    const response = await api.post('/auth/check-username', { username });
    return response.data;
  },

  async getProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  async getProfileWithRetry() {
    try {
      return await this.getProfile();
    } catch (error: any) {
      if (error.response?.status === 401) {
        const { accessToken } = await this.refreshToken();
        authSession.setAccessToken(accessToken);
        return await this.getProfile();
      }
      throw error;
    }
  },

  async refreshToken(refreshToken?: string) {
    const response = await api.post('/auth/refresh', refreshToken ? { refreshToken } : {});
    return response.data;
  },

  async updateProfile(profileData: FormData) {
    const response = await api.put('/auth/profile', profileData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async updateSocialLinks(socialLinks: string) {
    const response = await api.put('/auth/social-links', { social_links: socialLinks });
    return response.data;
  },

  async updatePreferences(preferences: { language: string; theme: string }) {
    const response = await api.put('/auth/preferences', preferences);
    return response.data;
  },

  async changePassword(passwordData: { currentPassword: string; newPassword: string }) {
    const response = await api.put('/auth/change-password', passwordData);
    return response.data;
  },

  async sendVerificationEmail() {
    const response = await api.post('/auth/send-verification-email');
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  async deleteAccount(password: string) {
    const response = await api.delete('/auth/account', { data: { password } });
    return response.data;
  },

  async logout(refreshToken?: string) {
    try {
      const response = await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
      authSession.clear();
      return response.data;
    } catch (error) {
      console.error('Logout API error:', error);
      authSession.clear();
      return { message: 'Logout completed locally' };
    }
  },

  async checkEmailVerification() {
    const response = await api.get('/auth/check-email-verification');
    return response.data;
  },

  async validateToken() {
    try {
      await this.getProfile();
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        return false;
      }
      throw error;
    }
  },

  async autoRefreshToken() {
    try {
      const { accessToken } = await this.refreshToken();
      authSession.setAccessToken(accessToken);
      return accessToken;
    } catch (error) {
      console.error('Auto token refresh failed:', error);
      throw error;
    }
  },

  async checkAdminAccess() {
    try {
      const profile = await this.getProfile();
      return profile.user && ['super_admin', 'admin', 'moderator'].includes(profile.user.role);
    } catch (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
  },

  async createAdminAccount() {
    try {
      const response = await api.post('/auth/create-admin');
      return response.data;
    } catch (error) {
      console.error('Error creating admin account:', error);
      throw error;
    }
  }
};
