-- Create new RBAC and Tenant tables

-- Ensure 'tenants' table exists
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) NOT NULL UNIQUE,
  custom_domain VARCHAR(255) DEFAULT NULL UNIQUE,
  subscription_plan ENUM('basic', 'pro', 'enterprise') DEFAULT 'basic',
  storage_limit_gb INT DEFAULT 10,
  storage_used_gb DECIMAL(10,2) DEFAULT 0.00,
  bandwidth_limit_gb INT DEFAULT 100,
  bandwidth_used_gb DECIMAL(10,2) DEFAULT 0.00,
  max_users INT DEFAULT 100,
  is_active TINYINT(1) DEFAULT 1,
  is_trial TINYINT(1) DEFAULT 0,
  trial_ends_at DATETIME DEFAULT NULL,
  settings JSON DEFAULT NULL,
  branding JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subdomain (subdomain),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure 'roles' table exists
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_tenant (tenant_id, slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Check and Add missing columns to 'roles' if needed
SELECT count(*) INTO @exist FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'is_system';
SET @query = IF(@exist=0, 'ALTER TABLE roles ADD COLUMN is_system BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure 'permissions' table exists
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Ensure 'user_roles' table exists with correct structure
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Tenant if not exists
INSERT INTO tenants (id, name, subdomain, subscription_plan, is_active)
SELECT 1, 'Default', 'default', 'enterprise', 1
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 1);

-- Insert Default Roles for Tenant 1
INSERT INTO roles (tenant_id, name, slug, description, is_system)
SELECT 1, 'Admin', 'admin', 'Administrator with full access', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = 1 AND slug = 'admin');

INSERT INTO roles (tenant_id, name, slug, description, is_system)
SELECT 1, 'Moderator', 'moderator', 'Moderator can manage content', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = 1 AND slug = 'moderator');

INSERT INTO roles (tenant_id, name, slug, description, is_system)
SELECT 1, 'User', 'user', 'Regular user', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = 1 AND slug = 'user');
