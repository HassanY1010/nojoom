import axios from 'axios';
import { authSession } from './authSession';
import { ApiResponse, PaginatedResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

// ============ أنواع التحديات ============
export interface Challenge {
  id: number;
  title: string;
  title_ar: string;
  description: string;
  description_ar: string;
  type: 'video' | 'photo' | 'text' | 'creative' | '10_second_video' | 'best_editing' | 'best_comment';
  category: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  participant_count: number;
  entry_count: number;
  status: string;
  entries_count: number;
  reward?: string;
  badge?: string;
  rules?: string[];
  requirements?: ChallengeRequirements;
  winner_username?: string;
  winner_avatar?: string;
  user_submitted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChallengeRequirements {
  min_duration?: number;
  max_duration?: number;
  aspect_ratio?: number;
  allowed_formats?: string[];
  max_file_size?: number;
  hashtags?: string[];
}

export interface ChallengeEntry {
  id: number;
  challenge_id: number;
  user_id: number;
  title: string;
  description?: string;
  media_url: string;
  media_type: 'video' | 'photo';
  thumbnail_url?: string;
  duration?: number;
  aspect_ratio?: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_winner: boolean;
  ranking?: number;
  created_at: string;
  updated_at: string;

  // العلاقات
  user?: {
    id: number;
    username: string;
    avatar?: string;
  };
  challenge?: {
    id: number;
    title: string;
    type: string;
  };
}

export interface ChallengeSubmission {
  challengeId: number;
  title: string;
  description?: string;
  mediaFile: File;
  thumbnailFile?: File;
  aspectRatio?: number;
  duration?: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked_at: string;
  challenge_id?: number;
}

export interface ChallengeStats {
  total_challenges: number;
  total_participations: number;
  wins_count: number;
  badges_count: number;
  ranking: number;
  success_rate: number;
}

// ============ الحصول على التحديات النشطة ============
export const getActiveChallenges = async (): Promise<ApiResponse<Challenge[]>> => {
  try {
    const token = authSession.getAccessToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const response = await axios.get(`${API_URL}/challenges/active`, config);
    return response.data;
  } catch (error) {
    console.error('Get active challenges error:', error);
    throw error;
  }
};

// ============ الحصول على التحديات السابقة ============
export const getPastChallenges = async (limit: number = 10): Promise<ApiResponse<PaginatedResponse<Challenge>>> => {
  try {
    const response = await axios.get(`${API_URL}/challenges/past`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Get past challenges error:', error);
    throw error;
  }
};

// ============ الحصول على تفاصيل تحدي ============
export const getChallengeById = async (id: number): Promise<ApiResponse<Challenge>> => {
  try {
    const token = authSession.getAccessToken();
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const response = await axios.get(`${API_URL}/challenges/${id}`, config);
    return response.data;
  } catch (error) {
    console.error('Get challenge by ID error:', error);
    throw error;
  }
};

// ============ إضافة مشاركة في التحدي ============
export const submitChallengeEntry = async (
  challengeId: number,
  entryData: ChallengeSubmission
): Promise<ApiResponse<ChallengeEntry>> => {
  try {
    const token = authSession.getAccessToken();

    // إنشاء FormData لرفع الملفات
    const formData = new FormData();
    formData.append('title', entryData.title);
    if (entryData.description) {
      formData.append('description', entryData.description);
    }
    formData.append('mediaFile', entryData.mediaFile);
    if (entryData.thumbnailFile) {
      formData.append('thumbnailFile', entryData.thumbnailFile);
    }
    if (entryData.aspectRatio) {
      formData.append('aspectRatio', entryData.aspectRatio.toString());
    }
    if (entryData.duration) {
      formData.append('duration', entryData.duration.toString());
    }

    const response = await axios.post(
      `${API_URL}/challenges/${challengeId}/submit`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Submit challenge entry error:', error);
    throw error;
  }
};

// ============ الحصول على مشاركات التحدي ============
export const getChallengeEntries = async (
  challengeId: number,
  limit: number = 50
): Promise<ApiResponse<PaginatedResponse<ChallengeEntry>>> => {
  try {
    const response = await axios.get(`${API_URL}/challenges/${challengeId}/entries`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Get challenge entries error:', error);
    throw error;
  }
};

// ============ الحصول على أوسمة المستخدم ============
export const getUserBadges = async (): Promise<ApiResponse<{ badges: Badge[], stats: ChallengeStats }>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.get(`${API_URL}/challenges/user/badges`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Get user badges error:', error);
    throw error;
  }
};

// ============ الحصول على إحصائيات التحدي ============
export const getChallengeStats = async (): Promise<ApiResponse<ChallengeStats>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.get(`${API_URL}/challenges/user/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Get challenge stats error:', error);
    throw error;
  }
};

// ============ حذف مشاركة في التحدي ============
export const deleteChallengeEntry = async (entryId: number): Promise<ApiResponse<void>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.delete(
      `${API_URL}/challenges/entries/${entryId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Delete challenge entry error:', error);
    throw error;
  }
};

// ============ التصويت على مشاركة في التحدي ============
export const voteForEntry = async (entryId: number): Promise<ApiResponse<{ likes_count: number }>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.post(
      `${API_URL}/challenges/entries/${entryId}/vote`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Vote for entry error:', error);
    throw error;
  }
};

// ============ إنشاء تحديات أسبوعية (Admin) ============
export const createWeeklyChallenges = async (): Promise<ApiResponse<Challenge[]>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.post(
      `${API_URL}/challenges/admin/create-weekly`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Create weekly challenges error:', error);
    throw error;
  }
};

// ============ إنهاء التحديات المنتهية (Admin) ============
export const endExpiredChallenges = async (): Promise<ApiResponse<{ ended: number }>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.post(
      `${API_URL}/challenges/admin/end-expired`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('End expired challenges error:', error);
    throw error;
  }
};

// ============ إنشاء تحدي جديد (Admin) ============
export const createChallenge = async (challengeData: Partial<Challenge>): Promise<ApiResponse<Challenge>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.post(
      `${API_URL}/challenges/admin/create`,
      challengeData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Create challenge error:', error);
    throw error;
  }
};

// ============ تحديث تحدي (Admin) ============
export const updateChallenge = async (
  challengeId: number,
  challengeData: Partial<Challenge>
): Promise<ApiResponse<Challenge>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.put(
      `${API_URL}/challenges/admin/${challengeId}`,
      challengeData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Update challenge error:', error);
    throw error;
  }
};

// ============ حذف تحدي (Admin) ============
export const deleteChallenge = async (challengeId: number): Promise<ApiResponse<void>> => {
  try {
    const token = authSession.getAccessToken();
    const response = await axios.delete(
      `${API_URL}/challenges/admin/${challengeId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Delete challenge error:', error);
    throw error;
  }
};