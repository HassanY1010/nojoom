import express from 'express';
import { monetizationController } from '../controllers/monetizationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/wallet', authenticateToken, monetizationController.getWallet);
router.post('/daily-bonus', authenticateToken, monetizationController.claimDailyBonus);

export default router;
