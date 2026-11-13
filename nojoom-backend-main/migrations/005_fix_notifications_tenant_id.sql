-- ============================================================
-- FIX notifications tenant_id mismatch (idempotent-safe style)
-- ============================================================
-- Note: This migration assumes MySQL 8+ for IF EXISTS / IF NOT EXISTS in DDL.

-- 1) Ensure tenant_id exists
ALTER TABLE `notifications`
  ADD COLUMN IF NOT EXISTS `tenant_id` INT(11) DEFAULT NULL AFTER `id`;

-- 2) Remove orphan notifications that reference deleted users
DELETE n
FROM `notifications` n
LEFT JOIN `users` u ON n.user_id = u.id
WHERE u.id IS NULL;

-- 3) Backfill tenant_id from users
UPDATE `notifications` n
INNER JOIN `users` u ON n.user_id = u.id
SET n.tenant_id = u.tenant_id
WHERE n.tenant_id IS NULL;

-- 4) Add index and FK
ALTER TABLE `notifications`
  ADD INDEX IF NOT EXISTS `idx_tenant_id` (`tenant_id`);

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_tenant_fk`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

-- 5) Enforce NOT NULL
ALTER TABLE `notifications`
  MODIFY `tenant_id` INT(11) NOT NULL;
