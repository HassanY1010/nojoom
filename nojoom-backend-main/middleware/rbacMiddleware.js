import { pool } from '../config/db.js';

/**
 * Middleware to check if user has required role
 */
export const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userId = req.user.id;
            const tenantId = req.tenantId;

            // Super admin bypasses all role checks
            if (req.user.role === 'super_admin') {
                return next();
            }

            // Get user roles for this tenant
            const [userRoles] = await pool.query(
                `SELECT r.slug, r.name 
         FROM user_roles ur
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND (r.tenant_id = ? OR r.is_system = 1)`,
                [userId, tenantId]
            );

            if (!userRoles || userRoles.length === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have the required role'
                });
            }

            const userRoleSlugs = userRoles.map(r => r.slug);
            const hasRole = allowedRoles.some(role => userRoleSlugs.includes(role));

            if (!hasRole) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: `Required role: ${allowedRoles.join(' or ')}`
                });
            }

            // Attach roles to request
            req.userRoles = userRoles;

            next();
        } catch (error) {
            console.error('Error checking role:', error);
            return res.status(500).json({
                error: 'Server error',
                message: 'Failed to check user role'
            });
        }
    };
};

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (...requiredPermissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userId = req.user.id;
            const tenantId = req.tenantId;

            // Super admin has all permissions
            if (req.user.role === 'super_admin') {
                return next();
            }

            // Get user permissions for this tenant
            const [permissions] = await pool.query(
                `SELECT DISTINCT p.slug, p.name 
         FROM user_roles ur
         INNER JOIN roles r ON ur.role_id = r.id
         INNER JOIN role_permissions rp ON r.id = rp.role_id
         INNER JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = ? AND (r.tenant_id = ? OR r.is_system = 1)`,
                [userId, tenantId]
            );

            if (!permissions || permissions.length === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have any permissions'
                });
            }

            const userPermissionSlugs = permissions.map(p => p.slug);
            const hasPermission = requiredPermissions.every(perm =>
                userPermissionSlugs.includes(perm)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: `Required permission: ${requiredPermissions.join(', ')}`
                });
            }

            // Attach permissions to request
            req.userPermissions = permissions;

            next();
        } catch (error) {
            console.error('Error checking permission:', error);
            return res.status(500).json({
                error: 'Server error',
                message: 'Failed to check user permission'
            });
        }
    };
};

/**
 * Middleware to check if user is super admin
 */
export const requireSuperAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Super admin access required'
        });
    }

    next();
};

/**
 * Middleware to check if user is tenant admin
 */
export const requireTenantAdmin = requireRole('tenant_admin', 'admin');
