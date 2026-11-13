import { pool } from '../config/db.js';

const TenantRepository = {
    async getAllTenants() {
        const [tenants] = await pool.query(`
            SELECT t.*, 
                   sp.name as plan_name,
                   COUNT(DISTINCT u.id) as total_users,
                   COUNT(DISTINCT v.id) as total_videos
            FROM tenants t
            LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id AND ts.status = 'active'
            LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
            LEFT JOIN users u ON t.id = u.tenant_id
            LEFT JOIN videos v ON t.id = v.tenant_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        return tenants;
    },

    async findTenantBySubdomainOrDomain(subdomain, customDomain) {
        const [rows] = await pool.query(
            'SELECT id FROM tenants WHERE subdomain = ? OR custom_domain = ?',
            [subdomain, customDomain]
        );
        return rows[0];
    },

    async createTenant({ name, subdomain, customDomain, subscriptionPlan, storageLimit, maxUsers, isTrial, trialEndsAt }) {
        const [result] = await pool.query(
            `INSERT INTO tenants (name, subdomain, custom_domain, subscription_plan, storage_limit_gb, max_users, is_trial, trial_ends_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, subdomain, customDomain || null, subscriptionPlan || 'basic', storageLimit || 10, maxUsers || 100, isTrial ? 1 : 0, trialEndsAt]
        );
        return result.insertId;
    },

    async findPlanBySlug(slug) {
        const [rows] = await pool.query(
            'SELECT id FROM subscription_plans WHERE slug = ? LIMIT 1',
            [slug]
        );
        return rows[0];
    },

    async createSubscription({ tenantId, planId, status, currentPeriodStart, currentPeriodEnd }) {
        const [result] = await pool.query(
            `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
             VALUES (?, ?, ?, ?, ?)`,
            [tenantId, planId, status, currentPeriodStart, currentPeriodEnd]
        );
        return result.insertId;
    },

    async getSystemAnalytics() {
        const [rows] = await pool.query(`
            SELECT 
              COUNT(DISTINCT t.id) as total_tenants,
              COUNT(DISTINCT u.id) as total_users,
              COUNT(DISTINCT v.id) as total_videos,
              SUM(t.storage_used_gb) as total_storage_used,
              SUM(t.bandwidth_used_gb) as total_bandwidth_used
            FROM tenants t
            LEFT JOIN users u ON t.id = u.tenant_id
            LEFT JOIN videos v ON t.id = v.tenant_id
        `);
        return rows[0];
    },

    async getActiveTenantsCount() {
        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) as count FROM tenants WHERE is_active = 1'
        );
        return count;
    },

    async getSubscriptionStats() {
        const [rows] = await pool.query(`
            SELECT sp.name, COUNT(ts.id) as count
            FROM subscription_plans sp
            LEFT JOIN tenant_subscriptions ts ON sp.id = ts.plan_id AND ts.status = 'active'
            GROUP BY sp.id
        `);
        return rows;
    },

    async updateFeatureFlag({ tenantId, featureKey, isEnabled, config }) {
        const [result] = await pool.query(
            `INSERT INTO feature_flags (tenant_id, feature_key, is_enabled, config)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE is_enabled = ?, config = ?`,
            [tenantId, featureKey, isEnabled ? 1 : 0, JSON.stringify(config || {}), isEnabled ? 1 : 0, JSON.stringify(config || {})]
        );
        return result.affectedRows;
    },
    async getDashboardStats(tenantId, userExclusion = '') {
        const [rows] = await pool.query(`
            SELECT 
              (SELECT COUNT(*) FROM users WHERE tenant_id = ?${userExclusion}) as total_users,
              (SELECT COUNT(*) FROM videos WHERE tenant_id = ?) as total_videos,
              (SELECT COUNT(*) FROM comments WHERE tenant_id = ?) as total_comments,
              (SELECT COUNT(*) FROM reports WHERE tenant_id = ? AND status = 'pending') as pending_reports
        `, [tenantId, tenantId, tenantId, tenantId]);
        return rows[0];
    },

    async getTenantStorageStats(tenantId) {
        const [rows] = await pool.query(
            'SELECT storage_used_gb, storage_limit_gb, bandwidth_used_gb, bandwidth_limit_gb FROM tenants WHERE id = ?',
            [tenantId]
        );
        return rows[0];
    },

    async getUsers({ tenantId, limit, offset, search = '', hideSuperAdmin = false }) {
        let query = 'SELECT * FROM users WHERE tenant_id = ?';
        let params = [tenantId];

        if (hideSuperAdmin) {
            query += ' AND role != "super_admin"';
        }

        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await pool.query(query, params);
        return users;
    },

    async getUsersCount({ tenantId, search = '', hideSuperAdmin = false }) {
        let countQuery = 'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?';
        const countParams = [tenantId];

        if (hideSuperAdmin) {
            countQuery += ' AND role != "super_admin"';
        }

        if (search) {
            countQuery += ' AND (username LIKE ? OR email LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [rows] = await pool.query(countQuery, countParams);
        return rows[0].count;
    },

    async findUserByIdAndTenant(userId, tenantId) {
        const [rows] = await pool.query(
            'SELECT id, is_banned FROM users WHERE id = ? AND tenant_id = ?',
            [userId, tenantId]
        );
        return rows[0];
    },

    async updateUserBanStatus({ userId, tenantId, isBanned, banReason }) {
        const [result] = await pool.query(
            'UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ? AND tenant_id = ?',
            [isBanned ? 1 : 0, isBanned ? banReason : null, userId, tenantId]
        );
        return result.affectedRows;
    },

    async getTenantSettings(tenantId) {
        const [rows] = await pool.query(
            'SELECT id, name, subdomain, custom_domain, settings, branding FROM tenants WHERE id = ?',
            [tenantId]
        );
        return rows[0];
    },

    async createRole({ tenantId, name, slug, description }) {
        const [result] = await pool.query(
            'INSERT INTO roles (tenant_id, name, slug, description) VALUES (?, ?, ?, ?)',
            [tenantId, name, slug, description]
        );
        return result.insertId;
    }
};

export default TenantRepository;
