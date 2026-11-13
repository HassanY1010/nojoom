-- ============================================================
-- MULTI-TENANT SAAS MIGRATION - PART 2: Add tenant_id to existing tables
-- ============================================================

-- Add tenant_id to users table
ALTER TABLE `users` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `users_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

-- Update existing users to default tenant
UPDATE `users` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL;

-- Make tenant_id NOT NULL after migration
ALTER TABLE `users` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add composite unique index for email per tenant
ALTER TABLE `users` DROP INDEX `email`;
ALTER TABLE `users` ADD UNIQUE KEY `unique_tenant_email` (`tenant_id`, `email`);

-- Add composite unique index for username per tenant
ALTER TABLE `users` DROP INDEX `username`;
ALTER TABLE `users` DROP INDEX `username_2`;
ALTER TABLE `users` ADD UNIQUE KEY `unique_tenant_username` (`tenant_id`, `username`);

-- Add tenant_id to videos table
ALTER TABLE `videos` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `videos_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `videos` v 
INNER JOIN `users` u ON v.user_id = u.id 
SET v.tenant_id = u.tenant_id 
WHERE v.tenant_id IS NULL;

ALTER TABLE `videos` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to comments table
ALTER TABLE `comments` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `comments_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `comments` c 
INNER JOIN `users` u ON c.user_id = u.id 
SET c.tenant_id = u.tenant_id 
WHERE c.tenant_id IS NULL;

ALTER TABLE `comments` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to likes table
ALTER TABLE `likes` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `user_id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `likes_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `likes` l 
INNER JOIN `users` u ON l.user_id = u.id 
SET l.tenant_id = u.tenant_id 
WHERE l.tenant_id IS NULL;

ALTER TABLE `likes` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to follows table
ALTER TABLE `follows` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `follows_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `follows` f 
INNER JOIN `users` u ON f.follower_id = u.id 
SET f.tenant_id = u.tenant_id 
WHERE f.tenant_id IS NULL;

ALTER TABLE `follows` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to notifications table
ALTER TABLE `notifications` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `notifications_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `notifications` n 
INNER JOIN `users` u ON n.user_id = u.id 
SET n.tenant_id = u.tenant_id 
WHERE n.tenant_id IS NULL;

ALTER TABLE `notifications` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to direct_messages table
ALTER TABLE `direct_messages` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `direct_messages_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `direct_messages` dm 
INNER JOIN `users` u ON dm.sender_id = u.id 
SET dm.tenant_id = u.tenant_id 
WHERE dm.tenant_id IS NULL;

ALTER TABLE `direct_messages` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to messages table
ALTER TABLE `messages` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `messages_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `messages` m 
INNER JOIN `users` u ON m.sender_id = u.id 
SET m.tenant_id = u.tenant_id 
WHERE m.tenant_id IS NULL;

ALTER TABLE `messages` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to reports table
ALTER TABLE `reports` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `reports_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `reports` r 
INNER JOIN `users` u ON r.user_id = u.id 
SET r.tenant_id = u.tenant_id 
WHERE r.tenant_id IS NULL;

ALTER TABLE `reports` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to watch_history (user_watch_time)
ALTER TABLE `user_watch_time` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `user_watch_time_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `user_watch_time` wt 
INNER JOIN `users` u ON wt.user_id = u.id 
SET wt.tenant_id = u.tenant_id 
WHERE wt.tenant_id IS NULL;

ALTER TABLE `user_watch_time` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to user_interactions table
ALTER TABLE `user_interactions` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `user_interactions_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `user_interactions` ui 
INNER JOIN `users` u ON ui.user_id = u.id 
SET ui.tenant_id = u.tenant_id 
WHERE ui.tenant_id IS NULL;

ALTER TABLE `user_interactions` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to search_history table
ALTER TABLE `search_history` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `search_history_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `search_history` sh 
INNER JOIN `users` u ON sh.user_id = u.id 
SET sh.tenant_id = u.tenant_id 
WHERE sh.tenant_id IS NULL;

ALTER TABLE `search_history` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to ai_user_profiles table
ALTER TABLE `ai_user_profiles` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `ai_user_profiles_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `ai_user_profiles` aup 
INNER JOIN `users` u ON aup.user_id = u.id 
SET aup.tenant_id = u.tenant_id 
WHERE aup.tenant_id IS NULL;

ALTER TABLE `ai_user_profiles` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to challenges table
ALTER TABLE `challenges` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `challenges_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `challenges` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL;
ALTER TABLE `challenges` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to broadcasts table
ALTER TABLE `broadcasts` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `broadcasts_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `broadcasts` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL;
ALTER TABLE `broadcasts` MODIFY `tenant_id` INT(11) NOT NULL;
