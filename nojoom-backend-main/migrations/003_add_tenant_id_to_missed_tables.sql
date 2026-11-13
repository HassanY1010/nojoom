-- ============================================================
-- MULTI-TENANT SAAS MIGRATION - PART 3: Add tenant_id to missed tables
-- ============================================================

-- Add tenant_id to active_conversations table
ALTER TABLE `active_conversations` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `active_conversations_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `active_conversations` ac 
INNER JOIN `users` u ON ac.user1_id = u.id 
SET ac.tenant_id = u.tenant_id 
WHERE ac.tenant_id IS NULL;

ALTER TABLE `active_conversations` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to groups table
ALTER TABLE `groups` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `groups_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `groups` g 
INNER JOIN `users` u ON g.creator_id = u.id 
SET g.tenant_id = u.tenant_id 
WHERE g.tenant_id IS NULL;

ALTER TABLE `groups` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to live_streams table
ALTER TABLE `live_streams` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `live_streams_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `live_streams` ls 
INNER JOIN `users` u ON ls.host_id = u.id 
SET ls.tenant_id = u.tenant_id 
WHERE ls.tenant_id IS NULL;

ALTER TABLE `live_streams` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to live_gifts table
ALTER TABLE `live_gifts` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `live_gifts_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `live_gifts` lg 
INNER JOIN `users` u ON lg.sender_id = u.id 
SET lg.tenant_id = u.tenant_id 
WHERE lg.tenant_id IS NULL;

ALTER TABLE `live_gifts` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to stories table
ALTER TABLE `stories` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `stories_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `stories` s 
INNER JOIN `users` u ON s.user_id = u.id 
SET s.tenant_id = u.tenant_id 
WHERE s.tenant_id IS NULL;

ALTER TABLE `stories` MODIFY `tenant_id` INT(11) NOT NULL;

-- Add tenant_id to animated_messages table
ALTER TABLE `animated_messages` 
  ADD COLUMN `tenant_id` INT(11) DEFAULT NULL AFTER `id`,
  ADD KEY `idx_tenant_id` (`tenant_id`),
  ADD CONSTRAINT `animated_messages_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

UPDATE `animated_messages` am 
INNER JOIN `users` u ON am.sender_id = u.id 
SET am.tenant_id = u.tenant_id 
WHERE am.tenant_id IS NULL;

ALTER TABLE `animated_messages` MODIFY `tenant_id` INT(11) NOT NULL;
