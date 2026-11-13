-- ============================================================
-- MULTI-TENANT SAAS MIGRATION - PART 1: Core Tables
-- ============================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `subdomain` VARCHAR(100) NOT NULL UNIQUE,
  `custom_domain` VARCHAR(255) DEFAULT NULL UNIQUE,
  `subscription_plan` ENUM('basic', 'pro', 'enterprise') DEFAULT 'basic',
  `storage_limit_gb` INT(11) DEFAULT 10,
  `storage_used_gb` DECIMAL(10,2) DEFAULT 0.00,
  `bandwidth_limit_gb` INT(11) DEFAULT 100,
  `bandwidth_used_gb` DECIMAL(10,2) DEFAULT 0.00,
  `max_users` INT(11) DEFAULT 100,
  `is_active` TINYINT(1) DEFAULT 1,
  `is_trial` TINYINT(1) DEFAULT 0,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `settings` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings`)),
  `branding` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`branding`)),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_subdomain` (`subdomain`),
  KEY `idx_custom_domain` (`custom_domain`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Subscription Plans
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `price_monthly` DECIMAL(10,2) DEFAULT 0.00,
  `price_yearly` DECIMAL(10,2) DEFAULT 0.00,
  `storage_limit_gb` INT(11) DEFAULT 10,
  `bandwidth_limit_gb` INT(11) DEFAULT 100,
  `max_users` INT(11) DEFAULT 100,
  `max_videos` INT(11) DEFAULT 1000,
  `features` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`features`)),
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tenant Subscriptions
CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` INT(11) NOT NULL,
  `plan_id` INT(11) NOT NULL,
  `status` ENUM('active', 'cancelled', 'expired', 'suspended') DEFAULT 'active',
  `billing_cycle` ENUM('monthly', 'yearly') DEFAULT 'monthly',
  `current_period_start` DATETIME NOT NULL,
  `current_period_end` DATETIME NOT NULL,
  `cancel_at_period_end` TINYINT(1) DEFAULT 0,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `payment_gateway_id` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `tenant_subscriptions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tenant_subscriptions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Usage Metrics
CREATE TABLE IF NOT EXISTS `usage_metrics` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` INT(11) NOT NULL,
  `metric_date` DATE NOT NULL,
  `storage_used_gb` DECIMAL(10,2) DEFAULT 0.00,
  `bandwidth_used_gb` DECIMAL(10,2) DEFAULT 0.00,
  `active_users` INT(11) DEFAULT 0,
  `total_videos` INT(11) DEFAULT 0,
  `total_views` INT(11) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_date` (`tenant_id`, `metric_date`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_metric_date` (`metric_date`),
  CONSTRAINT `usage_metrics_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` INT(11) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_slug` (`tenant_id`, `slug`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_slug` (`slug`),
  CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Permissions
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(50) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_slug` (`slug`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Role Permissions
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role_id`, `permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. User Roles
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `role_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`, `role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Feature Flags
CREATE TABLE IF NOT EXISTS `feature_flags` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` INT(11) DEFAULT NULL,
  `feature_key` VARCHAR(100) NOT NULL,
  `is_enabled` TINYINT(1) DEFAULT 0,
  `config` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config`)),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_feature` (`tenant_id`, `feature_key`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_feature_key` (`feature_key`),
  CONSTRAINT `feature_flags_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Subscription Plans
INSERT INTO `subscription_plans` (`name`, `slug`, `price_monthly`, `price_yearly`, `storage_limit_gb`, `bandwidth_limit_gb`, `max_users`, `max_videos`, `features`, `is_active`) VALUES
('Basic', 'basic', 29.00, 290.00, 10, 100, 100, 1000, '{"ai_recommendations": false, "custom_branding": false, "priority_support": false, "analytics": "basic"}', 1),
('Pro', 'pro', 99.00, 990.00, 100, 1000, 1000, 10000, '{"ai_recommendations": true, "custom_branding": true, "priority_support": false, "analytics": "advanced"}', 1),
('Enterprise', 'enterprise', 299.00, 2990.00, 1000, 10000, 10000, 100000, '{"ai_recommendations": true, "custom_branding": true, "priority_support": true, "analytics": "premium"}', 1);

-- Insert System Permissions
INSERT INTO `permissions` (`name`, `slug`, `category`, `description`) VALUES
-- User Management
('View Users', 'users.view', 'users', 'View users list'),
('Create Users', 'users.create', 'users', 'Create new users'),
('Edit Users', 'users.edit', 'users', 'Edit user details'),
('Delete Users', 'users.delete', 'users', 'Delete users'),
('Ban Users', 'users.ban', 'users', 'Ban/unban users'),

-- Video Management
('View Videos', 'videos.view', 'videos', 'View videos'),
('Upload Videos', 'videos.upload', 'videos', 'Upload videos'),
('Edit Videos', 'videos.edit', 'videos', 'Edit video details'),
('Delete Videos', 'videos.delete', 'videos', 'Delete videos'),
('Moderate Videos', 'videos.moderate', 'videos', 'Moderate video content'),

-- Comment Management
('View Comments', 'comments.view', 'comments', 'View comments'),
('Create Comments', 'comments.create', 'comments', 'Create comments'),
('Edit Comments', 'comments.edit', 'comments', 'Edit comments'),
('Delete Comments', 'comments.delete', 'comments', 'Delete comments'),

-- Reports
('View Reports', 'reports.view', 'reports', 'View reports'),
('Manage Reports', 'reports.manage', 'reports', 'Manage reports'),

-- Settings
('View Settings', 'settings.view', 'settings', 'View tenant settings'),
('Edit Settings', 'settings.edit', 'settings', 'Edit tenant settings'),

-- Analytics
('View Analytics', 'analytics.view', 'analytics', 'View analytics'),

-- Subscription
('View Subscription', 'subscription.view', 'subscription', 'View subscription details'),
('Manage Subscription', 'subscription.manage', 'subscription', 'Manage subscription');

-- Create Default Tenant
INSERT INTO `tenants` (`name`, `subdomain`, `subscription_plan`, `storage_limit_gb`, `is_active`) VALUES
('Default Tenant', 'default', 'enterprise', 1000, 1);
