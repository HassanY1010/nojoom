import express from 'express';
import { pushController } from '../controllers/pushController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/public-key', pushController.getPublicKey);
router.post('/subscribe', authenticateToken, pushController.subscribe);
router.post('/unsubscribe', authenticateToken, pushController.unsubscribe);
router.post('/fcm/register', authenticateToken, pushController.subscribeFCM);
router.post('/fcm/unregister', authenticateToken, pushController.unsubscribeFCM);

export default router;
