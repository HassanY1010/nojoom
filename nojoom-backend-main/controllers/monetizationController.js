import { User } from '../models/User.js';
import MonetizationRepository from '../repositories/MonetizationRepository.js';
import UserRepository from '../repositories/UserRepository.js';

export const monetizationController = {
    async getWallet(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const tenantId = req.tenantId || req.tenant?.id || 1;
            // 🔒 Multi-Tenant Security: Pass tenantId
            const wallet = await User.getWalletBalance(userId, tenantId).catch(() => ({ points: 0, total_earnings: 0 }));

            // Get recent transactions (gifts and points)
            const gifts = await MonetizationRepository.getRecentGifts(userId, tenantId).catch(() => []);

            res.json({
                balance: parseFloat(wallet?.points || 0),
                total_earnings: parseFloat(wallet?.total_earnings || 0),
                recent_gifts: gifts || []
            });
        } catch (error) {
            console.error('Error in getWallet:', error);
            res.json({
                balance: 0,
                total_earnings: 0,
                recent_gifts: []
            });
        }
    },

    async claimDailyBonus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const tenantId = req.tenantId || req.tenant?.id || 1;
            // Check if already claimed today
            // For now, let's just award 5 points as "Ad Revenue Sharing"
            // based on their performance (simulated)

            const views = await UserRepository.getUserViewsCount(userId, tenantId).catch(() => 0);
            const bonus = Math.max(5, Math.floor((views || 0) / 100)); // 5 base + 1 per 100 views

            // 🔒 Multi-Tenant Security: Pass tenantId
            await User.awardPoints(userId, bonus, 'Daily Ad Revenue Share', tenantId).catch(() => null);

            res.json({
                success: true,
                bonus,
                message: `You earned ${bonus} points from Ad Revenue Sharing!`
            });
        } catch (error) {
            console.error('Error in claimDailyBonus:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
