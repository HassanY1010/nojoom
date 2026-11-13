import api from './api';
import { Video, User } from '../types';

export interface SearchParams {
  query: string;
  type: 'all' | 'videos' | 'users';
  filter: 'relevance' | 'trending' | 'latest' | 'hashtags';
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  videos: Video[];
  users: User[];
  hashtags: string[];
  hasMore: boolean;
  totalCount: number;
}

export interface InteractionData {
  videoId: number;
  type: 'like' | 'share' | 'watch' | 'comment' | 'report' | 'follow' | 'unfollow';
  weight?: number;
  metadata?: any;
}

export const searchService = {
  // البحث الأساسي
  async search(params: SearchParams): Promise<SearchResponse> {
    const response = await api.get('/search', { params });
    return response.data;
  },

  // البحث في الهاشتاجات
  async searchHashtags(hashtag: string, page: number = 1, limit: number = 10) {
    const response = await api.get('/search/hashtags', {
      params: { hashtag, page, limit }
    });
    return response.data;
  },

  // الحصول على الهاشتاجات الرائجة
  async getTrendingHashtags(limit: number = 10) {
    const response = await api.get('/search/trending-hashtags', {
      params: { limit }
    });
    return response.data;
  },

  // البحث المقترح (Auto-complete)
  async getSuggestions(query: string, limit: number = 5) {
    const response = await api.get('/search/suggestions', {
      params: { q: query, limit }
    });
    return response.data;
  },

  // تسجيل تفاعل المستخدم للتوصيات
  async recordInteraction(data: InteractionData) {
    return await api.post('/search/interaction', data);
  },

  // الحصول على تاريخ البحث
  async getSearchHistory(limit: number = 10) {
    const response = await api.get('/search/history', {
      params: { limit }
    });
    return response.data;
  },

  // مسح تاريخ البحث
  async clearSearchHistory() {
    return await api.delete('/search/history');
  },

  // الحصول على التوصيات بناءً على البحث
  async getSearchRecommendations(query: string, limit: number = 5) {
    const response = await api.get('/search/recommendations', {
      params: { q: query, limit }
    });
    return response.data;
  },

  // الحصول على الترندات المحلية (فيديوهات + هاشتاجات)
  async getTrendingLocalized(country: string = 'Global', limit: number = 10) {
    const response = await api.get('/search/trending-localized', {
      params: { country, limit }
    });
    return response.data;
  }
};

export default searchService;