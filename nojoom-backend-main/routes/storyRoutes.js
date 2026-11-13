import express from 'express';
import { storyController } from '../controllers/storyController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadStory } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', uploadStory.single('media'), storyController.createStory);
router.get('/feed', storyController.getStoriesFeed);
router.get('/user/:userId', storyController.getUserStories);
router.delete('/:id', storyController.deleteStory);
router.post('/:id/view', storyController.viewStory);

export default router;
