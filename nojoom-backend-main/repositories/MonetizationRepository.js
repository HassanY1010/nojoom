import { pool } from '../config/db.js';

const MonetizationRepository = {
    async getRecentGifts(userId, tenantId, limit = 20) {
        const [gifts] = await pool.execute(
            `SELECT lg.*, u.username as sender_name, u.avatar as sender_avatar, ls.title as live_title
             FROM live_gifts lg
             JOIN users u ON lg.sender_id = u.id
             JOIN live_streams ls ON lg.live_id = ls.id
             WHERE ls.host_id = ? AND u.tenant_id = ?
             ORDER BY lg.created_at DESC
             LIMIT ?`,
            [userId, tenantId, parseInt(limit)]
        );
        return gifts;
    }
};

export default MonetizationRepository;
