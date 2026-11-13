import { pool } from '../config/db.js';

export class LiveStream {
    static async create(hostId, title, tenantId) {
        const [result] = await pool.execute(
            'INSERT INTO live_streams (host_id, title, status, tenant_id) VALUES (?, ?, "active", ?)',
            [hostId, title, tenantId]
        );
        return result.insertId;
    }

    static async findById(id, tenantId) {
        const [rows] = await pool.execute(
            `SELECT ls.*, u.username, u.avatar 
       FROM live_streams ls
       JOIN users u ON ls.host_id = u.id
       WHERE ls.id = ? AND ls.tenant_id = ?`,
            [id, tenantId]
        );
        return rows[0];
    }

    static async getActiveStreams(tenantId) {
        const [rows] = await pool.execute(
            `SELECT ls.*, u.username, u.avatar 
       FROM live_streams ls
       JOIN users u ON ls.host_id = u.id
       WHERE ls.status = "active" AND ls.tenant_id = ?
       ORDER BY ls.viewers_count DESC`,
            [tenantId]
        );
        return rows;
    }

    static async endStream(id, tenantId) {
        const [result] = await pool.execute(
            'UPDATE live_streams SET status = "ended", ended_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        return result.affectedRows > 0;
    }

    static async updateViewers(id, count, tenantId) {
        await pool.execute(
            'UPDATE live_streams SET viewers_count = ? WHERE id = ? AND tenant_id = ?',
            [count, id, tenantId]
        );
    }

    static async addLike(id, tenantId) {
        await pool.execute(
            'UPDATE live_streams SET likes_count = likes_count + 1 WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
    }

    static async saveGift(liveId, senderId, giftType, amount = 1) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Save gift record
            const [result] = await connection.execute(
                'INSERT INTO live_gifts (live_id, sender_id, gift_type, amount, tenant_id) VALUES (?, ?, ?, ?, ?)',
                [liveId, senderId, giftType, amount, u.tenant_id || 1] // Handle tenant context
            );

            // 2. Award points to host
            const giftValues = {
                rose: 1,
                heart: 5,
                star: 10,
                crown: 50,
                diamond: 100
            };

            const pointValue = (giftValues[giftType] || 1) * amount;

            // Get host_id
            const [liveRows] = await connection.execute('SELECT host_id FROM live_streams WHERE id = ?', [liveId]);
            if (liveRows.length > 0) {
                const hostId = liveRows[0].host_id;
                await connection.execute(
                    'UPDATE users SET points = points + ?, total_earnings = total_earnings + ? WHERE id = ?',
                    [pointValue, pointValue, hostId]
                );
            }

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            console.error('Error in LiveStream.saveGift:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}
