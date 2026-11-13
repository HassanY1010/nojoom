import { pool } from '../config/db.js';

export class Group {
    // Creating a new group
    static async create(groupData) {
        const { tenant_id, name, description, image, creator_id } = groupData;

        // 🔒 Multi-Tenant Security: tenant_id is REQUIRED
        const [result] = await pool.execute(
            'INSERT INTO \`groups\` (tenant_id, name, description, avatar, creator_id) VALUES (?, ?, ?, ?, ?)',
            [tenant_id, name, description, image, creator_id]
        );

        const groupId = result.insertId;

        // Auto-join creator as admin
        await pool.execute(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, creator_id, 'admin']
        );

        return groupId;
    }

    // Find group by ID
    static async findById(id, tenantId) {
        // 🔒 Multi-Tenant Security: Filter by tenant_id
        const [rows] = await pool.execute(
            `SELECT g.*, g.avatar as image, u.username as creator_name,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
       FROM \`groups\` g
       JOIN users u ON g.creator_id = u.id
       WHERE g.id = ? AND (g.tenant_id = ? OR ? IS NULL)`,
            [id, tenantId, tenantId]
        );
        return rows[0];
    }

    // Get groups with membership status for a user
    static async listAll(userId, tenantId, limit = 50, offset = 0) {
        // 🔒 Multi-Tenant Security: Filter by tenant_id
        const [rows] = await pool.execute(
            `SELECT g.*, g.avatar as image, 
              (SELECT role FROM group_members WHERE group_id = g.id AND user_id = ?) as user_role,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
       FROM \`groups\` g
       WHERE g.tenant_id = ?
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
            [userId, tenantId, limit, offset]
        );
        return rows;
    }

    // Join group
    static async join(groupId, userId) {
        const [result] = await pool.execute(
            'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, userId, 'member']
        );
        return result.affectedRows > 0;
    }

    // Leave group
    static async leave(groupId, userId) {
        const [result] = await pool.execute(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND role != "admin"',
            [groupId, userId]
        );
        return result.affectedRows > 0;
    }

    // Get group members
    static async getMembers(groupId) {
        const [rows] = await pool.execute(
            `SELECT gm.*, u.username, u.avatar as image, u.is_online
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?`,
            [groupId]
        );
        return rows;
    }

    // Check if user is member
    static async isMember(groupId, userId) {
        const [rows] = await pool.execute(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        return rows.length > 0;
    }

    // Get user groups
    static async getUserGroups(userId) {
        const [rows] = await pool.execute(
            `SELECT g.*, g.avatar as image, gm.role as user_role,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?`,
            [userId]
        );
        return rows;
    }
}
