import { pool } from '../config/db.js';

const PushRepository = {
    async findSubscription(userId, subscriptionJson) {
        const [rows] = await pool.query(
            'SELECT id FROM push_subscriptions WHERE user_id = ? AND subscription_json = ?',
            [userId, subscriptionJson]
        );
        return rows[0];
    },

    async createSubscription(userId, subscriptionJson) {
        const [result] = await pool.query(
            'INSERT INTO push_subscriptions (user_id, subscription_json) VALUES (?, ?)',
            [userId, subscriptionJson]
        );
        return result.insertId;
    },

    async deleteSubscription(userId, subscriptionJson) {
        const [result] = await pool.query(
            'DELETE FROM push_subscriptions WHERE user_id = ? AND subscription_json = ?',
            [userId, subscriptionJson]
        );
        return result.affectedRows;
    }
};

export default PushRepository;
