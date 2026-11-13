import express from 'express';
import { groupController } from '../controllers/groupController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { groupValidation } from '../middleware/validationMiddleware.js';
import { uploadGroupAvatar } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', uploadGroupAvatar.single('avatar'), groupValidation, groupController.createGroup);
router.get('/', groupController.listGroups);
router.get('/my-groups', groupController.getUserGroups);
router.get('/:id', groupController.getGroupDetails);
router.post('/:id/join', groupController.joinGroup);
router.post('/:id/leave', groupController.leaveGroup);

export default router;
