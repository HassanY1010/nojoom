import { User } from '../models/User.js';
import MonetizationRepository from '../repositories/MonetizationRepository.js';
import UserRepository from '../repositories/UserRepository.js';

export const monetizationController = {
    async getWallet(req, res) {
        try {
            const userId = req.user.id;
            // 🔒 Multi-Tenant Security: Pass tenantId
            const wallet = await User.getWalletBalance(userId, req.tenantId);

            // Get recent transactions (gifts and points)
            const gifts = await MonetizationRepository.getRecentGifts(userId, req.tenantId);

            res.json({
                balance: wallet.points,
                total_earnings: wallet.total_earnings,
                recent_gifts: gifts
            });
        } catch (error) {
            console.error('Error in getWallet:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async claimDailyBonus(req, res) {
        try {
            const userId = req.user.id;

            // Check if already claimed today
            // For now, let's just award 5 points as "Ad Revenue Sharing"
            // based on their performance (simulated)

            const views = await UserRepository.getUserViewsCount(userId, req.tenantId);
            const bonus = Math.max(5, Math.floor(views / 100)); // 5 base + 1 per 100 views

            // 🔒 Multi-Tenant Security: Pass tenantId
            await User.awardPoints(userId, bonus, 'Daily Ad Revenue Share', req.tenantId);

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
