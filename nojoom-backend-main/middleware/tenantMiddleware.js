import { pool } from '../config/db.js';

/**
 * Middleware to resolve tenant from subdomain or custom domain
 */
export const resolveTenant = async (req, res, next) => {
    try {
        const host = req.get('host');

        // Extract subdomain or domain
        let subdomain = null;
        let customDomain = null;

        // Check if it's a custom domain or subdomain
        const parts = host.split('.');

        if (parts.length === 1 || host.includes('localhost')) {
            // Local development - use default tenant or query param
            subdomain = req.query.tenant || 'default';
        } else if (parts.length === 2) {
            // Custom domain (e.g., example.com)
            customDomain = host;
        } else if (parts.length >= 3) {
            // Subdomain (e.g., tenant1.app.com)
            subdomain = parts[0];
        }

        // Query tenant from database
        let query;
        let params;

        if (customDomain) {
            query = 'SELECT * FROM tenants WHERE custom_domain = ? AND is_active = 1 LIMIT 1';
            params = [customDomain];
        } else {
            query = 'SELECT * FROM tenants WHERE subdomain = ? AND is_active = 1 LIMIT 1';
            params = [subdomain];
        }

        const [tenants] = await pool.query(query, params);

        if (!tenants || tenants.length === 0) {
            return res.status(404).json({
                error: 'Tenant not found or inactive',
                message: 'The requested tenant does not exist or has been deactivated.'
            });
        }

        const tenant = tenants[0];

        // Check if trial has expired
        if (tenant.is_trial && tenant.trial_ends_at) {
            const trialEnd = new Date(tenant.trial_ends_at);
            if (trialEnd < new Date()) {
                return res.status(403).json({
                    error: 'Trial expired',
                    message: 'Your trial period has ended. Please upgrade to continue.'
                });
            }
        }

        // Attach tenant to request
        req.tenant = tenant;
        req.tenantId = tenant.id;

        next();
    } catch (error) {
        console.error('Error resolving tenant:', error);
        return res.status(500).json({
            error: 'Server error',
            message: 'Failed to resolve tenant'
        });
    }
};

/**
 * Middleware to check subscription status and limits
 */
export const checkSubscription = async (req, res, next) => {
    try {
        if (!req.tenant) {
            return res.status(400).json({ error: 'Tenant not resolved' });
        }

        const tenantId = req.tenant.id;

        // Get active subscription
        const [subscriptions] = await pool.query(
            `SELECT ts.*, sp.* 
       FROM tenant_subscriptions ts
       INNER JOIN subscription_plans sp ON ts.plan_id = sp.id
       WHERE ts.tenant_id = ? AND ts.status = 'active'
       ORDER BY ts.current_period_end DESC
       LIMIT 1`,
            [tenantId]
        );

        if (!subscriptions || subscriptions.length === 0) {
            return res.status(403).json({
                error: 'No active subscription',
                message: 'Please subscribe to a plan to continue.'
            });
        }

        const subscription = subscriptions[0];

        // Check if subscription has expired
        const periodEnd = new Date(subscription.current_period_end);
        if (periodEnd < new Date()) {
            return res.status(403).json({
                error: 'Subscription expired',
                message: 'Your subscription has expired. Please renew to continue.'
            });
        }

        // Attach subscription to request
        req.subscription = subscription;

        next();
    } catch (error) {
        console.error('Error checking subscription:', error);
        return res.status(500).json({
            error: 'Server error',
            message: 'Failed to check subscription'
        });
    }
};

/**
 * Middleware to check storage limits
 */
export const checkStorageLimit = async (req, res, next) => {
    try {
        if (!req.tenant) {
            return res.status(400).json({ error: 'Tenant not resolved' });
        }

        const tenant = req.tenant;

        if (tenant.storage_used_gb >= tenant.storage_limit_gb) {
            return res.status(403).json({
                error: 'Storage limit exceeded',
                message: `You have reached your storage limit of ${tenant.storage_limit_gb}GB. Please upgrade your plan.`
            });
        }

        next();
    } catch (error) {
        console.error('Error checking storage limit:', error);
        return res.status(500).json({
            error: 'Server error',
            message: 'Failed to check storage limit'
        });
    }
};

// enforceTenantIsolation removed because monkey-patching global pool is an anti-pattern.
