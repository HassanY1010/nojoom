-- Migration: 004_add_tenant_id_to_tracking_tables.sql
-- Description: Adds tenant_id to tracking, behavior, and auxiliary tables for full multi-tenant isolation.

-- 1. Reset Codes
ALTER TABLE reset_codes ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE reset_codes ADD INDEX idx_tenant_id (tenant_id);

-- 2. Email Verification Tokens
ALTER TABLE email_verification_tokens ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE email_verification_tokens ADD INDEX idx_tenant_id (tenant_id);

-- 3. User Preferences
ALTER TABLE user_preferences ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE user_preferences ADD INDEX idx_tenant_id (tenant_id);

-- 4. Video Views
ALTER TABLE video_views ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE video_views ADD INDEX idx_tenant_id (tenant_id);

-- 5. Explore Views
ALTER TABLE explore_views ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE explore_views ADD INDEX idx_tenant_id (tenant_id);

-- 6. Watch History
ALTER TABLE watch_history ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE watch_history ADD INDEX idx_tenant_id (tenant_id);

-- 7. User Interactions
ALTER TABLE user_interactions ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE user_interactions ADD INDEX idx_tenant_id (tenant_id);

-- 8. Refresh Tokens
ALTER TABLE refresh_tokens ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE refresh_tokens ADD INDEX idx_tenant_id (tenant_id);

-- 9. Search History
ALTER TABLE search_history ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE search_history ADD INDEX idx_tenant_id (tenant_id);

-- 10. Search Interactions
ALTER TABLE search_interactions ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE search_interactions ADD INDEX idx_tenant_id (tenant_id);

-- 11. Eye Tracking
ALTER TABLE eye_tracking ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE eye_tracking ADD INDEX idx_tenant_id (tenant_id);

-- 12. Scroll Behavior
ALTER TABLE scroll_behavior ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE scroll_behavior ADD INDEX idx_tenant_id (tenant_id);

-- 13. Voice Interactions
ALTER TABLE voice_interactions ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE voice_interactions ADD INDEX idx_tenant_id (tenant_id);

-- 14. AI User Profiles
ALTER TABLE ai_user_profiles ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE ai_user_profiles ADD INDEX idx_tenant_id (tenant_id);

-- 15. AI Training Data
ALTER TABLE ai_training_data ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE ai_training_data ADD INDEX idx_tenant_id (tenant_id);

-- 16. Video Chunks
ALTER TABLE video_chunks ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE video_chunks ADD INDEX idx_tenant_id (tenant_id);

-- 17. Video Manifests
ALTER TABLE video_manifests ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE video_manifests ADD INDEX idx_tenant_id (tenant_id);

-- 18. Challenge Entries
ALTER TABLE challenge_entries ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE challenge_entries ADD INDEX idx_tenant_id (tenant_id);

-- 19. User Badges
ALTER TABLE user_badges ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE user_badges ADD INDEX idx_tenant_id (tenant_id);

-- 20. Video Shares
ALTER TABLE video_shares ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE video_shares ADD INDEX idx_tenant_id (tenant_id);

-- 21. Group Members
ALTER TABLE group_members ADD COLUMN tenant_id INT DEFAULT 1;
ALTER TABLE group_members ADD INDEX idx_tenant_id (tenant_id);
