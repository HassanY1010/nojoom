import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireSuperAdmin, requireTenantAdmin } from '../middleware/rbacMiddleware.js';
import { superAdminController, tenantAdminController } from '../controllers/multiTenantAdminController.js';

const router = express.Router();

// ============================================================
// SUPER ADMIN ROUTES
// ============================================================

// Tenants Management
router.get('/super/tenants', authenticateToken, requireSuperAdmin, superAdminController.getAllTenants);
router.post('/super/tenants', authenticateToken, requireSuperAdmin, superAdminController.createTenant);
router.put('/super/tenants/:id', authenticateToken, requireSuperAdmin, superAdminController.updateTenant);
router.delete('/super/tenants/:id', authenticateToken, requireSuperAdmin, superAdminController.deleteTenant);

// System Analytics
router.get('/super/analytics', authenticateToken, requireSuperAdmin, superAdminController.getSystemAnalytics);

// Feature Flags
router.post('/super/feature-flags', authenticateToken, requireSuperAdmin, superAdminController.updateFeatureFlag);

// ============================================================
// TENANT ADMIN ROUTES
// ============================================================

// Dashboard
router.get('/tenant/dashboard', authenticateToken, requireTenantAdmin, tenantAdminController.getDashboardStats);

// Users Management
router.get('/tenant/users', authenticateToken, requireTenantAdmin, tenantAdminController.getUsers);
router.put('/tenant/users/:userId/ban', authenticateToken, requireTenantAdmin, tenantAdminController.toggleUserBan);

// Settings
router.get('/tenant/settings', authenticateToken, requireTenantAdmin, tenantAdminController.getSettings);
router.put('/tenant/branding', authenticateToken, requireTenantAdmin, tenantAdminController.updateBranding);

export default router;
