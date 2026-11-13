import api from './api';

export interface ExploreVideosParams {
  page?: number;
  limit?: number;
  filter?: 'recommended' | 'trending' | 'popular' | 'latest';
  search?: string;
  hashtag?: string;
  userId?: number;
}

export interface ExploreUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  userId?: number;
}

export const exploreApi = {
  // جلب فيديوهات الـ Explore
  getExploreVideos: (params: ExploreVideosParams) => 
    api.get('/explore/videos', { params }),

  // جلب مستخدمي الـ Explore
  getExploreUsers: (params: ExploreUsersParams) => 
    api.get('/explore/users', { params }),

  // البحث الشامل
  searchAll: (query: string, limit?: number) =>
    api.get('/explore/search', { params: { q: query, limit } }),

  // جلب الهاشتاجات الشائعة
  getTrendingHashtags: (limit?: number) =>
    api.get('/explore/hashtags/trending', { params: { limit } }),

  // جلب الإحصائيات
  getExploreStats: () =>
    api.get('/explore/stats')
};

export default exploreApi;