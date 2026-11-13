import express from 'express';
import { liveController } from '../controllers/liveController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', liveController.getActiveStreams);
router.get('/:id', liveController.getStreamById);

// Protected routes
router.post('/start', authenticateToken, liveController.startStream);
router.post('/:id/end', authenticateToken, liveController.endStream);

export default router;
