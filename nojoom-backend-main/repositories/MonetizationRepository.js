import { pool } from '../config/db.js';

const MonetizationRepository = {
    async getRecentGifts(userId, tenantId = 1, limit = 20) {
        try {
            const activeTenantId = tenantId || 1;
            const parsedLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
            const [gifts] = await pool.query(
                `SELECT lg.*, u.username as sender_name, u.avatar as sender_avatar, ls.title as live_title
                 FROM live_gifts lg
                 JOIN users u ON lg.sender_id = u.id
                 JOIN live_streams ls ON lg.live_id = ls.id
                 WHERE ls.host_id = ? AND (u.tenant_id = ? OR u.tenant_id IS NULL)
                 ORDER BY lg.created_at DESC
                 LIMIT ${parsedLimit}`,
                [userId, activeTenantId]
            );
            return gifts || [];
        } catch (error) {
            console.warn('⚠️ Error in MonetizationRepository.getRecentGifts:', error.message);
            return [];
        }
    }
};

export default MonetizationRepository;
