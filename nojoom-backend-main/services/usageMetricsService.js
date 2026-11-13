import { pool } from '../config/db.js';

/**
 * Usage Metrics Service
 * Tracks daily analytics metrics for each tenant including:
 * - DAU (Daily Active Users)
 * - MAU (Monthly Active Users)
 * - Average Watch Time (seconds)
 * - Engagement Rate (%)
 * - User Retention (D1, D7, D30)
 * - Storage & Bandwidth
 */

export async function updateDailyMetrics() {
    try {
        console.log('📊 Starting daily usage analytics update...');

        // Get all active tenants
        const [tenants] = await pool.query('SELECT id FROM tenants WHERE is_active = 1');

        for (const tenant of tenants) {
            const tenantId = tenant.id;

            // 1. Calculate DAU, Videos, Views
            const [stats] = await pool.query(`
                SELECT 
                  COUNT(DISTINCT u.id) as active_users,
                  COUNT(DISTINCT v.id) as total_videos,
                  COALESCE(SUM(v.views), 0) as total_views
                FROM users u
                LEFT JOIN videos v ON u.id = v.user_id AND v.tenant_id = ?
                WHERE u.tenant_id = ? AND DATE(u.last_login) = CURDATE()
            `, [tenantId, tenantId]);

            const dau = stats[0].active_users || 0;
            const totalVideos = stats[0].total_videos || 0;
            const totalViews = stats[0].total_views || 0;

            // 2. Calculate MAU (last 30 days)
            const [mauStats] = await pool.query(`
                SELECT COUNT(DISTINCT id) as mau
                FROM users
                WHERE tenant_id = ? AND last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `, [tenantId]);
            const mau = mauStats[0]?.mau || 0;

            // 3. Calculate Average Watch Time today (in seconds)
            const [watchTimeStats] = await pool.query(`
                SELECT COALESCE(AVG(watch_time) / 1000, 0) as avg_watch_time
                FROM watch_history
                WHERE tenant_id = ? AND DATE(created_at) = CURDATE()
            `, [tenantId]);
            const avgWatchTime = parseFloat(watchTimeStats[0]?.avg_watch_time || 0);

            // 4. Calculate Engagement Rate (Likes + Comments + Shares vs Views)
            const [likesStats] = await pool.query(`
                SELECT COALESCE(SUM(likes), 0) as total_likes 
                FROM videos 
                WHERE tenant_id = ? AND deleted_by_admin = FALSE
            `, [tenantId]);
            const [commentsStats] = await pool.query(`
                SELECT COUNT(*) as total_comments 
                FROM comments 
                WHERE tenant_id = ?
            `, [tenantId]);
            const [sharesStats] = await pool.query(`
                SELECT COUNT(*) as total_shares 
                FROM video_shares 
                WHERE tenant_id = ?
            `, [tenantId]);

            const totalLikes = likesStats[0]?.total_likes || 0;
            const totalComments = commentsStats[0]?.total_comments || 0;
            const totalShares = sharesStats[0]?.total_shares || 0;
            
            const totalEngagements = totalLikes + totalComments + totalShares;
            const engagementRate = totalViews > 0 ? parseFloat(((totalEngagements / totalViews) * 100).toFixed(2)) : 0.0;

            // 5. Calculate Retention Cohorts (D1, D7, D30)
            const [retentionStats] = await pool.query(`
                SELECT 
                  -- D1
                  (SELECT COUNT(DISTINCT id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE(last_login) = CURDATE()) / 
                  COALESCE(NULLIF((SELECT COUNT(id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 0), 1) * 100 as retention_d1,
                  -- D7
                  (SELECT COUNT(DISTINCT id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(last_login) = CURDATE()) / 
                  COALESCE(NULLIF((SELECT COUNT(id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)), 0), 1) * 100 as retention_d7,
                  -- D30
                  (SELECT COUNT(DISTINCT id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE(last_login) = CURDATE()) / 
                  COALESCE(NULLIF((SELECT COUNT(id) FROM users WHERE tenant_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0), 1) * 100 as retention_d30
            `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]);

            const retentionD1 = parseFloat(retentionStats[0]?.retention_d1 || 0);
            const retentionD7 = parseFloat(retentionStats[0]?.retention_d7 || 0);
            const retentionD30 = parseFloat(retentionStats[0]?.retention_d30 || 0);

            // Get storage and bandwidth from tenant table
            const [tenantData] = await pool.query(`
                SELECT storage_used_gb, bandwidth_used_gb
                FROM tenants
                WHERE id = ?
            `, [tenantId]);

            const storageUsed = tenantData[0]?.storage_used_gb || 0;
            const bandwidthUsed = tenantData[0]?.bandwidth_used_gb || 0;

            // Insert or update usage metrics
            await pool.execute(`
                INSERT INTO usage_metrics 
                (tenant_id, metric_date, storage_used_gb, bandwidth_used_gb, active_users, mau, total_videos, total_views, avg_watch_time, engagement_rate, retention_d1, retention_d7, retention_d30)
                VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                  storage_used_gb = VALUES(storage_used_gb),
                  bandwidth_used_gb = VALUES(bandwidth_used_gb),
                  active_users = VALUES(active_users),
                  mau = VALUES(mau),
                  total_videos = VALUES(total_videos),
                  total_views = VALUES(total_views),
                  avg_watch_time = VALUES(avg_watch_time),
                  engagement_rate = VALUES(engagement_rate),
                  retention_d1 = VALUES(retention_d1),
                  retention_d7 = VALUES(retention_d7),
                  retention_d30 = VALUES(retention_d30),
                  updated_at = NOW()
            `, [
                tenantId,
                storageUsed,
                bandwidthUsed,
                dau,
                mau,
                totalVideos,
                totalViews,
                avgWatchTime,
                engagementRate,
                retentionD1,
                retentionD7,
                retentionD30
            ]);

            console.log(`✅ Updated metrics for tenant ${tenantId}: DAU=${dau}, MAU=${mau}, AvgWatchTime=${avgWatchTime.toFixed(1)}s, Engagement=${engagementRate}%`);
        }

        console.log('✅ Daily analytics metrics update completed');
    } catch (error) {
        console.error('❌ Error updating daily metrics:', error);
    }
}

/**
 * Update storage usage for a specific tenant
 */
export async function updateTenantStorage(tenantId) {
    try {
        const [result] = await pool.query(`
          SELECT COALESCE(SUM(file_size_mb), 0) / 1024 as storage_gb
          FROM videos
          WHERE tenant_id = ? AND deleted_by_admin = FALSE
        `, [tenantId]);

        const storageUsed = result[0]?.storage_gb || 0;

        await pool.execute(`
          UPDATE tenants
          SET storage_used_gb = ?
          WHERE id = ?
        `, [storageUsed, tenantId]);

        console.log(`📦 Updated storage for tenant ${tenantId}: ${storageUsed.toFixed(2)} GB`);
    } catch (error) {
        console.error(`❌ Error updating storage for tenant ${tenantId}:`, error);
    }
}

/**
 * Update bandwidth usage for a specific tenant
 */
export async function updateTenantBandwidth(tenantId, bandwidthMB) {
    try {
        await pool.execute(`
          UPDATE tenants
          SET bandwidth_used_gb = bandwidth_used_gb + ?
          WHERE id = ?
        `, [bandwidthMB / 1024, tenantId]);

        console.log(`📡 Updated bandwidth for tenant ${tenantId}: +${bandwidthMB} MB`);
    } catch (error) {
        console.error(`❌ Error updating bandwidth for tenant ${tenantId}:`, error);
    }
}
