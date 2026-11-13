import express from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ مسار تحليلات المنصة الشاملة (يتطلب مصادقة ويفضل تحقق من الصلاحيات الإدارية)
router.get('/overview', authenticateToken, analyticsController.getOverviewAnalytics);

// ✅ مسار تحليلات الأداء المخصصة لصانع المحتوى (يتطلب مصادقة)
router.get('/creator', authenticateToken, analyticsController.getCreatorAnalytics);

export default router;
