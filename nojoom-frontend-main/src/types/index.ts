// src/types/index.ts

// ==================== أنواع المستخدمين ====================
export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
  role: 'user' | 'admin' | 'moderator';
  followers_count: number;
  following_count: number;
  total_watch_time: number;
  is_online: boolean;
  is_banned: boolean;
  ban_reason?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  is_following?: boolean;
  last_seen?: string;
  is_owner?: boolean;
  social_links?: SocialLinks;
}

export interface UserProfile extends User {
  profile_stats?: UserStats;
  recent_videos?: Video[];
  is_editable?: boolean;
}

export interface SocialLinks {
  website?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
}

// ==================== أنواع الفيديوهات ====================
export interface Video {
  id: number;
  user_id: number;
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration: number;
  file_size: number;
  aspect_ratio: number;
  views: number;
  likes: number;
  shares: number;
  is_private: boolean;
  is_pinned: boolean;
  deleted_by_admin: boolean;
  deletion_reason?: string;
  created_at: string;
  updated_at: string;

  // بيانات العلاقات
  owner?: VideoOwner;
  username?: string;
  avatar?: string;
  is_liked?: boolean;
  is_owner?: boolean;

  // حقول من النوع الأول
  path?: string;
  comment_count?: number;
  is_following?: boolean;
  hashtags?: string[];
  music?: string;
  // حقول إضافية للـ Explore
  engagement_rate?: number;
  trending_score?: number;
  video_url?: string;
  thumbnail_url?: string;

  // AI Fields
  ai_title_suggestion?: string;
  ai_moderation_score?: number;
  ai_moderation_flags?: string;
  subtitles_path?: string;
  ai_transcription?: string;
}

export interface VideoOwner {
  id: number;
  username: string;
  avatar?: string;
  role: string;
}

export interface VideoUploadData {
  file: File;
  title: string;
  description?: string;
  is_private?: boolean;
  aspect_ratio?: number;
}

export interface VideoStats {
  video_id: number;
  total_views: number;
  total_likes: number;
  total_shares: number;
  avg_watch_time: number;
  completion_rate: number;
  peak_viewers: number;
}

// ==================== أنواع الدردشة والرسائل ====================
export interface BaseMessage {
  id: number;
  sender_id: number;
  video_id?: number;
  receiver_id?: number;
  content: string;
  type: 'user' | 'admin' | 'system';
  is_read: boolean;
  read_at?: string;
  display_count?: number;
  timestamp?: number;
  created_at: string;
  updated_at?: string;

  // بيانات العلاقات
  username?: string;
  avatar?: string;
  role?: string;
  video_title?: string;
  sender_username?: string;
  sender_avatar?: string;
  receiver_username?: string;
  receiver_avatar?: string;
}

export interface ChatMessage extends BaseMessage {
  video_id: number;
  display_count: number;
  timestamp: number;
}

export interface BroadcastMessage extends BaseMessage {
  type: 'admin';
  target: 'all' | 'specific';
  admin_username: string;
  admin_avatar?: string;
}

export interface DirectMessage extends BaseMessage {
  receiver_id: number;
  is_read: boolean;
  read_at?: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  username: string;
  avatar?: string;
  role: string;
  is_online: boolean;
  last_message?: string;
  last_message_time: string;
  unread_count: number;
  is_typing?: boolean;
}

export interface ChatRoom {
  video_id: number;
  video_title: string;
  owner_id: number;
  owner_username: string;
  participant_count: number;
  message_count: number;
  last_activity: string;
  is_active: boolean;
}

// ==================== أنواع نظام التدوير ====================
export interface MessageDisplay {
  id: number;
  message_id: number;
  user_id: number;
  display_count: number;
  displayed_at: string;
  created_at: string;
}

export interface BroadcastDisplay {
  id: number;
  broadcast_id: number;
  user_id: number;
  display_count: number;
  displayed_at: string;
  created_at: string;
}

// ==================== أنواع الإعجابات والمتابعة ====================
export interface Like {
  id: number;
  user_id: number;
  video_id: number;
  created_at: string;
}

export interface Follow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: string;
}

export interface FollowStatus {
  is_following: boolean;
  followers_count: number;
  following_count: number;
}

// ==================== أنواع الإشعارات ====================
export interface Notification {
  id: number;
  user_id: number;
  type: 'like' | 'follow' | 'comment' | 'message' | 'broadcast' | 'system';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  email_likes: boolean;
  email_follows: boolean;
  email_messages: boolean;
  email_broadcasts: boolean;
  push_likes: boolean;
  push_follows: boolean;
  push_messages: boolean;
  push_broadcasts: boolean;
}

// ==================== أنواع الإحصائيات ====================
export interface UserStats {
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_followers: number;
  total_following: number;
  avg_engagement_rate: number;
  total_watch_time: number;
}

export interface SystemStats {
  total_users: number;
  total_videos: number;
  total_messages: number;
  total_broadcasts: number;
  active_users: number;
  storage_used: number;
  daily_uploads: number;
  daily_messages: number;
}

export interface ChatStats {
  active_chats: number;
  total_messages: number;
  active_users: number;
  popular_videos: Array<{
    id: number;
    title: string;
    message_count: number;
  }>;
  top_chatters: Array<{
    id: number;
    username: string;
    message_count: number;
  }>;
  message_frequency: Array<{
    hour: number;
    message_count: number;
  }>;
  emoji_stats: Array<{
    emoji: string;
    count: number;
  }>;
}

// ==================== أنواع Explore ====================
export interface ExploreStats {
  total_videos: number;
  total_users: number;
  trending_hashtags: string[];
  daily_views: number;
}

export interface Hashtag {
  name: string;
  count: number;
  trending: boolean;
}

// ==================== أنواع التحميل والملفات ====================
export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'complete';
  progress: number;
  file?: File;
  video?: Video;
  error?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  duration?: number;
  resolution?: string;
  aspect_ratio?: number;
}

// ==================== أنواع نظام التوقيت ====================
export interface WatchTime {
  user_id: number;
  video_id: number;
  watch_time: number;
  session_date: string;
  created_at: string;
}

export interface TimeLimit {
  exceeded: boolean;
  usedTime: number;
  remainingTime: number;
  limit: number;
}

// ==================== أنواع البث المباشر ====================
export interface Broadcast {
  id: number;
  admin_id: number;
  content: string;
  target: 'all' | 'specific';
  display_count: number;
  created_at: string;

  // بيانات العلاقات
  admin_username?: string;
  admin_avatar?: string;
  total_displays?: number;
  unique_viewers?: number;
}

// ==================== أنواع نظام الصلاحيات ====================
export interface AdminPermissions {
  user_id: number;
  can_broadcast: boolean;
  can_manage_users: boolean;
  can_manage_videos: boolean;
  can_manage_messages: boolean;
  can_view_stats: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  maintenance_mode: boolean;
  chat_enabled: boolean;
  upload_enabled: boolean;
  max_video_size: number;
  max_video_duration: number;
  max_message_length: number;
  max_login_attempts: number;
  session_timeout: number;
}

// ==================== أنواع الاستجابة من API ====================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// ==================== أنواع الأحداث في الوقت الحقيقي ====================
export interface SocketEvent {
  type: 'message' | 'broadcast' | 'typing' | 'user_online' | 'video_update' | 'like_update';
  data: any;
  timestamp: string;
}

export interface TypingEvent {
  video_id: number;
  user_id: number;
  username: string;
  avatar?: string;
  is_typing: boolean;
}

export interface OnlineStatusEvent {
  user_id: number;
  username: string;
  avatar?: string;
  is_online: boolean;
  timestamp: string;
}

// ==================== أنواع البحث والتصفية ====================
export interface SearchFilters {
  query?: string;
  type?: 'videos' | 'users' | 'messages';
  sort_by?: 'recent' | 'popular' | 'alphabetical';
  date_range?: DateRange;
  duration_range?: DurationRange;
  aspect_ratio?: number[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DurationRange {
  min: number;
  max: number;
}

export interface SearchResults {
  videos: Video[];
  users: User[];
  messages: BaseMessage[];
  total: number;
  query: string;
}

// ==================== أنواع النماذج (Forms) ====================
export interface LoginForm {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  agree_to_terms: boolean;
}

export interface ProfileForm {
  username: string;
  email: string;
  bio?: string;
  avatar?: File;
  social_links?: SocialLinks;
}

export interface VideoForm {
  title: string;
  description?: string;
  file: File;
  is_private: boolean;
  aspect_ratio?: number;
}

export interface MessageForm {
  content: string;
  video_id?: number;
  receiver_id?: number;
  type: 'user' | 'admin';
}

// ==================== أنواع حالة التطبيق ====================
export interface AppState {
  user: User | null;
  videos: Video[];
  currentVideo: Video | null;
  messages: ChatMessage[];
  broadcasts: BroadcastMessage[];
  conversations: Conversation[];
  notifications: Notification[];
  onlineUsers: number[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatState {
  activeVideoId: number | null;
  messages: ChatMessage[];
  broadcasts: BroadcastMessage[];
  typingUsers: string[];
  isConnected: boolean;
  isPaused: boolean;
  unreadCount: number;
}

// ==================== أنواع الدفع والإشتراكات ====================
export interface Subscription {
  id: number;
  user_id: number;
  plan: 'basic' | 'premium' | 'pro';
  status: 'active' | 'canceled' | 'expired';
  start_date: string;
  end_date: string;
  features: string[];
}

export interface Payment {
  id: number;
  user_id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

// ==================== أنواع التقارير والإبلاغ ====================
export interface Report {
  id: number;
  reporter_id: number;
  target_type: 'user' | 'video' | 'message';
  target_id: number;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  created_at: string;
  resolved_at?: string;
  resolved_by?: number;
}

// ==================== أنواع التصدير والاستيراد ====================
export interface ExportData {
  type: 'videos' | 'messages' | 'stats';
  format: 'json' | 'csv' | 'pdf';
  date_range: DateRange;
  filters?: ExportFilters;
}

export interface ExportFilters {
  aspect_ratios?: AspectRatios;
  video_types?: string[];
  user_roles?: string[];
}

export interface AspectRatios {
  '1:1': number;
  '4:3': number;
  '21:9': number;
}

// ==================== الثوابت ====================
export const VIDEO_TYPES = {
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  OGG: 'video/ogg'
} as const;

export const MESSAGE_TYPES = {
  USER: 'user',
  ADMIN: 'admin',
  SYSTEM: 'system'
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user'
} as const;

export const VIDEO_ASPECT_RATIOS = {
  SQUARE: 1,
  PORTRAIT: 0.75,
  LANDSCAPE: 1.77,
  CINEMATIC: 2.33
} as const;

// ==================== أنواع الأدوات المساعدة ====================
export type ApiError = {
  code: string;
  message: string;
  details?: any;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ValidationError {
  field: string;
  message: string;
}

// ==================== أنواع المكونات ====================
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export interface ModalProps extends ComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}