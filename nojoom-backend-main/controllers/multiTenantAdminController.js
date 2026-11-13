import TenantRepository from '../repositories/TenantRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { auditService } from '../services/auditService.js';
import logger from '../utils/logger.js';


/**
 * Super Admin Controller - Manage all tenants
 */
export const superAdminController = {

    // Get all tenants
    async getAllTenants(req, res) {
        try {
            const tenants = await TenantRepository.getAllTenants();

            res.json({ tenants });
        } catch (error) {
            console.error('Error fetching tenants:', error);
            res.status(500).json({ error: 'Failed to fetch tenants' });
        }
    },

    // Create new tenant
    async createTenant(req, res) {
        try {
            const { name, subdomain, customDomain, subscriptionPlan, storageLimit, maxUsers, isTrial } = req.body;

            if (!name || !subdomain) {
                return res.status(400).json({ error: 'Name and subdomain are required' });
            }

            // Check if subdomain already exists
            const existing = await TenantRepository.findTenantBySubdomainOrDomain(subdomain, customDomain);
 
             if (existing) {
                 return res.status(400).json({ error: 'Subdomain or domain already exists' });
             }

            const trialEndsAt = isTrial ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

            const tenantId = await TenantRepository.createTenant({
                 name, subdomain, customDomain, subscriptionPlan, storageLimit, maxUsers, isTrial, trialEndsAt
             });
 
             // Create default subscription
             const plan = await TenantRepository.findPlanBySlug(subscriptionPlan || 'basic');
 
             if (plan) {
                 const periodStart = new Date();
                 const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
 
                 await TenantRepository.createSubscription({
                     tenantId,
                     planId: plan.id,
                     status: 'active',
                     currentPeriodStart: periodStart,
                     currentPeriodEnd: periodEnd
                 });
             }

            // Create default roles for tenant
            await createDefaultRolesForTenant(tenantId);

            // ✅ Log Action for Audit
            await auditService.logAction({
                tenant_id: 1, // Super Admin usually operates in context of tenant 1 or system-wide
                user_id: req.user.id,
                action: 'create_tenant',
                resource_type: 'tenant',
                resource_id: tenantId,
                details: { name, subdomain, subscriptionPlan },
                ip_address: req.ip || req.connection.remoteAddress
            });

            res.status(201).json({
                message: 'Tenant created successfully',
                tenantId
            });

        } catch (error) {
            logger.error('Error creating tenant:', error);
            await auditService.alertSuperAdmin(error, { action: 'create_tenant', user_id: req.user?.id });
            res.status(500).json({ error: 'Failed to create tenant' });
        }

    },

    // Update tenant
    async updateTenant(req, res) {
        try {
            const { id } = req.params;
            const { name, customDomain, subscriptionPlan, storageLimit, maxUsers, isActive } = req.body;

            const updates = [];
            const params = [];

            if (name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (customDomain !== undefined) {
                updates.push('custom_domain = ?');
                params.push(customDomain);
            }
            if (subscriptionPlan) {
                updates.push('subscription_plan = ?');
                params.push(subscriptionPlan);
            }
            if (storageLimit) {
                updates.push('storage_limit_gb = ?');
                params.push(storageLimit);
            }
            if (maxUsers) {
                updates.push('max_users = ?');
                params.push(maxUsers);
            }
            if (isActive !== undefined) {
                updates.push('is_active = ?');
                params.push(isActive ? 1 : 0);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            params.push(id);

            // ✅ Log Action for Audit
            await auditService.logAction({
                tenant_id: 1,
                user_id: req.user.id,
                action: 'update_tenant',
                resource_type: 'tenant',
                resource_id: id,
                details: { updated_fields: updates.map(u => u.split(' = ')[0]) },
                ip_address: req.ip || req.connection.remoteAddress
            });

            res.json({ message: 'Tenant updated successfully' });

        } catch (error) {
            logger.error('Error updating tenant:', error);
            await auditService.alertSuperAdmin(error, { action: 'update_tenant', tenant_id: req.params.id });
            res.status(500).json({ error: 'Failed to update tenant' });
        }

    },

    // Delete tenant
    async deleteTenant(req, res) {
        try {
            const { id } = req.params;

            // Prevent deletion of default tenant
            if (parseInt(id) === 1) {
                return res.status(403).json({ error: 'Cannot delete default tenant' });
            }

            // ✅ Log Action for Audit
            await auditService.logAction({
                tenant_id: 1,
                user_id: req.user.id,
                action: 'delete_tenant',
                resource_type: 'tenant',
                resource_id: id,
                details: { tenant_id: id },
                ip_address: req.ip || req.connection.remoteAddress
            });

            res.json({ message: 'Tenant deleted successfully' });

        } catch (error) {
            console.error('Error deleting tenant:', error);
            res.status(500).json({ error: 'Failed to delete tenant' });
        }
    },

    // Get system analytics
    async getSystemAnalytics(req, res) {
        try {
            const stats = await TenantRepository.getSystemAnalytics();
            const activeTenantsCount = await TenantRepository.getActiveTenantsCount();
            const subscriptionStats = await TenantRepository.getSubscriptionStats();

            res.json({
                stats,
                activeTenants: activeTenantsCount,
                subscriptionStats
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    },

    // Manage feature flags
    async updateFeatureFlag(req, res) {
        try {
            const { tenantId, featureKey, isEnabled, config } = req.body;

            if (!tenantId || !featureKey) {
                return res.status(400).json({ error: 'Tenant ID and feature key are required' });
            }

            await TenantRepository.updateFeatureFlag({ tenantId, featureKey, isEnabled, config });

            res.json({ message: 'Feature flag updated successfully' });
        } catch (error) {
            console.error('Error updating feature flag:', error);
            res.status(500).json({ error: 'Failed to update feature flag' });
        }
    }
};

/**
 * Tenant Admin Controller - Manage tenant-specific data
 */
export const tenantAdminController = {

    // Get tenant dashboard stats
    async getDashboardStats(req, res) {
        try {
            const tenantId = req.tenantId;
            const isSuperAdmin = req.user?.role === 'super_admin';
            const userExclusion = isSuperAdmin ? '' : " AND role != 'super_admin'";

            const stats = await TenantRepository.getDashboardStats(tenantId, userExclusion);
            const storageStats = await TenantRepository.getTenantStorageStats(tenantId);

            res.json({
                stats,
                storage: storageStats
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    },

    // Get all users in tenant
    async getUsers(req, res) {
        try {
            const tenantId = req.tenantId;
            const { page = 1, limit = 20, search = '' } = req.query;
            const offset = (page - 1) * limit;
            const hideSuperAdmin = req.user?.role !== 'super_admin';

            const users = await TenantRepository.getUsers({
                tenantId,
                limit,
                offset,
                search,
                hideSuperAdmin
            });

            const total = await TenantRepository.getUsersCount({
                tenantId,
                search,
                hideSuperAdmin
            });

            res.json({
                users,
                total,
                page: parseInt(page),
                limit: parseInt(limit)
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    },

    // Ban/Unban user
    async toggleUserBan(req, res) {
        try {
            const tenantId = req.tenantId;
            const { userId } = req.params;
            const { banReason } = req.body;

            const user = await TenantRepository.findUserByIdAndTenant(userId, tenantId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const newBanStatus = !user.is_banned;

            await TenantRepository.updateUserBanStatus({
                userId,
                tenantId,
                isBanned: newBanStatus,
                banReason: newBanStatus ? banReason : null
            });

            res.json({
                message: newBanStatus ? 'User banned successfully' : 'User unbanned successfully'
            });
        } catch (error) {
            console.error('Error toggling user ban:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    },

    // Get tenant settings
    async getSettings(req, res) {
        try {
            const tenantId = req.tenantId;

            const tenant = await TenantRepository.getTenantSettings(tenantId);

            if (!tenant) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            res.json({ tenant });
        } catch (error) {
            console.error('Error fetching settings:', error);
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    },

    // Update tenant branding
    async updateBranding(req, res) {
        try {
            const tenantId = req.tenantId;
            const { logo, primaryColor, secondaryColor, customCss } = req.body;

            const branding = {
                logo,
                primaryColor,
                secondaryColor,
                customCss
            };

            // ✅ Log Action for Audit
            await auditService.logAction({
                tenant_id: tenantId,
                user_id: req.user.id,
                action: 'update_branding',
                resource_type: 'tenant',
                resource_id: tenantId,
                details: { branding },
                ip_address: req.ip || req.connection.remoteAddress
            });

            res.json({ message: 'Branding updated successfully' });

        } catch (error) {
            console.error('Error updating branding:', error);
            res.status(500).json({ error: 'Failed to update branding' });
        }
    }
};

// Helper function to create default roles
async function createDefaultRolesForTenant(tenantId) {
    const roles = [
        { name: 'Tenant Admin', slug: 'tenant_admin', description: 'Full access to tenant' },
        { name: 'Moderator', slug: 'moderator', description: 'Can moderate content' },
        { name: 'User', slug: 'user', description: 'Regular user' }
    ];

    for (const role of roles) {
        await TenantRepository.createRole({
            tenantId,
            name: role.name,
            slug: role.slug,
            description: role.description
        });
    }
}
