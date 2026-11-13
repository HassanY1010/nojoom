-- ============================================================
-- MIGRATION 006: Performance Indexes
-- Purpose: Add missing indexes for frequently queried fields
-- Compatible with MySQL 5.7+ and MariaDB
-- The migration runner ignores ER_DUP_KEYNAME, so safe to re-run
-- ============================================================

-- ============================================================
-- TABLE: videos
-- ============================================================

-- Composite: tenant + public + created_at (Main feed query)
ALTER TABLE videos ADD INDEX idx_videos_tenant_public_created (tenant_id, is_public, created_at);

-- Composite: tenant + user_id + created_at (Profile page videos)
ALTER TABLE videos ADD INDEX idx_videos_tenant_user (tenant_id, user_id, created_at);

-- Composite: tenant + country + created_at (Trending by region)
ALTER TABLE videos ADD INDEX idx_videos_tenant_country_created (tenant_id, country, created_at);

-- category filter
ALTER TABLE videos ADD INDEX idx_videos_category (category);

-- boost_score sorting
ALTER TABLE videos ADD INDEX idx_videos_boost_score (boost_score);

-- Composite: deleted + public + views (Most viewed active videos)
ALTER TABLE videos ADD INDEX idx_videos_active_views (deleted_by_admin, is_public, views);

-- ============================================================
-- TABLE: users
-- ============================================================

-- tenant_id scoping
ALTER TABLE users ADD INDEX idx_users_tenant_id (tenant_id);

-- Composite: tenant + role (Admin filtering by role)
ALTER TABLE users ADD INDEX idx_users_tenant_role (tenant_id, role);

-- Composite: tenant + followers (Top creators)
ALTER TABLE users ADD INDEX idx_users_tenant_followers (tenant_id, followers_count);

-- last_login analytics
ALTER TABLE users ADD INDEX idx_users_last_login (last_login);

-- created_at for new user reports
ALTER TABLE users ADD INDEX idx_users_created_at (created_at);

-- ============================================================
-- TABLE: comments
-- ============================================================

-- user_id for user's own comments
ALTER TABLE comments ADD INDEX idx_comments_user_id (user_id);

-- Composite: video_id + created_at (Paginated comments)
ALTER TABLE comments ADD INDEX idx_comments_video_created (video_id, created_at);

-- Nested replies
ALTER TABLE comments ADD INDEX idx_comments_reply_id (video_reply_id);

-- ============================================================
-- TABLE: likes
-- ============================================================

-- Composite: video_id + user_id (Is video liked?)
ALTER TABLE likes ADD INDEX idx_likes_video_user (video_id, user_id);

-- ============================================================
-- TABLE: follows
-- ============================================================

-- Composite: following_id + follower_id
ALTER TABLE follows ADD INDEX idx_follows_following_follower (following_id, follower_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================

-- Composite: user_id + is_read + created_at
ALTER TABLE notifications ADD INDEX idx_notif_user_read_created (user_id, is_read, created_at);

-- tenant scoping
ALTER TABLE notifications ADD INDEX idx_notif_tenant_id (tenant_id);

-- ============================================================
-- TABLE: video_views
-- ============================================================

-- Composite: video_id + created_at (Trending time window)
ALTER TABLE video_views ADD INDEX idx_vviews_video_created (video_id, created_at);

-- ============================================================
-- TABLE: explore_views
-- ============================================================

ALTER TABLE explore_views ADD INDEX idx_eviews_video_created (video_id, created_at);

-- ============================================================
-- TABLE: user_interactions
-- ============================================================

-- interaction type filter
ALTER TABLE user_interactions ADD INDEX idx_interactions_type (interaction_type);

-- Composite: user + type + date (Recommendation engine)
ALTER TABLE user_interactions ADD INDEX idx_interactions_user_type_created (user_id, interaction_type, created_at);

-- Composite: video + type (Engagement stats)
ALTER TABLE user_interactions ADD INDEX idx_interactions_video_type (video_id, interaction_type);

-- ============================================================
-- TABLE: watch_history
-- ============================================================

-- Composite: user_id + updated_at (Recent history)
ALTER TABLE watch_history ADD INDEX idx_wh_user_updated (user_id, updated_at);

-- completed flag
ALTER TABLE watch_history ADD INDEX idx_wh_completed (completed);

-- ============================================================
-- TABLE: search_history
-- ============================================================

-- Composite: user_id + created_at
ALTER TABLE search_history ADD INDEX idx_sh_user_created (user_id, created_at);

-- query prefix (autocomplete)
ALTER TABLE search_history ADD INDEX idx_sh_query (query(50));

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================

-- user_id for logout all
ALTER TABLE refresh_tokens ADD INDEX idx_rt_user_id (user_id);

-- expires_at for cleanup cron
ALTER TABLE refresh_tokens ADD INDEX idx_rt_expires (expires_at);

-- ============================================================
-- TABLE: direct_messages
-- ============================================================

-- Composite: receiver + is_read (Unread count)
ALTER TABLE direct_messages ADD INDEX idx_dm_receiver_read (receiver_id, is_read);

-- Composite: conversation thread
ALTER TABLE direct_messages ADD INDEX idx_dm_conversation (sender_id, receiver_id, created_at);

-- ============================================================
-- TABLE: reports
-- ============================================================

-- Composite: status + created_at
ALTER TABLE reports ADD INDEX idx_reports_status_created (status, created_at);

-- reported_user_id
ALTER TABLE reports ADD INDEX idx_reports_reported_user (reported_user_id);

-- ============================================================
-- TABLE: video_manifests
-- ============================================================

-- Composite: status + updated_at (Detect stuck jobs)
ALTER TABLE video_manifests ADD INDEX idx_manifests_status_updated (processing_status, updated_at);
