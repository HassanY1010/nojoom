import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

export const auditService = {
  /**
   * Log an action to the database and file log
   * @param {Object} params 
   * @param {number} params.tenant_id 
   * @param {number} params.user_id 
   * @param {string} params.action - e.g., 'upload_video', 'delete_video', 'update_tenant'
   * @param {string} params.resource_type - e.g., 'video', 'tenant', 'user'
   * @param {string|number} params.resource_id 
   * @param {Object} params.details - JSON object with additional info
   * @param {string} params.ip_address 
   */
  async logAction({ tenant_id, user_id, action, resource_type, resource_id, details, ip_address }) {
    try {
      // 1. Log to Database for Admin Audit
      const [result] = await pool.execute(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenant_id, user_id, action, resource_type, resource_id, JSON.stringify(details || {}), ip_address]
      );

      // 2. Log to File for System Reliability
      logger.info(`Audit: ${action} by user ${user_id} on ${resource_type}:${resource_id}`, {
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        ip_address
      });

      return result.insertId;
    } catch (error) {
      // Fallback: If DB logging fails, ensure it's at least in the file log
      logger.error('Failed to log audit action to database:', error);
      logger.info(`Fallback Audit: ${action} by user ${user_id} on ${resource_type}:${resource_id}`);
      return null;
    }
  },

  /**
   * Special Error Alert for Super Admins
   * @param {Error|string} error 
   * @param {Object} context 
   */
  async alertSuperAdmin(error, context = {}) {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const stack = typeof error === 'string' ? null : error.stack;

      // 1. Log critical error to file
      logger.error(`CRITICAL SYSTEM ERROR: ${errorMessage}`, { context, stack });

      // 2. Find all Super Admins in the system
      const [superAdmins] = await pool.execute(
        "SELECT id, tenant_id FROM users WHERE role = 'super_admin' AND is_banned = FALSE"
      );

      if (superAdmins.length === 0) return;

      // 3. Send system notification to all Super Admins
      // Assuming a notifications table exists or using a shared function
      for (const admin of superAdmins) {
        await pool.execute(
          `INSERT INTO notifications (user_id, tenant_id, title, message, type, is_read)
           VALUES (?, ?, ?, ?, ?, FALSE)`,
          [
            admin.id,
            admin.tenant_id,
            '🚨 Critical System Error',
            `System detected a high-priority error: ${errorMessage.substring(0, 100)}...`,
            'system_alert'
          ]
        );
      }
      
      console.log(`✅ Alerted ${superAdmins.length} Super Admins about the error.`);
    } catch (alertError) {
      logger.error('Failed to send Super Admin alert:', alertError);
    }
  }
};
