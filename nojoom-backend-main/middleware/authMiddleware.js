import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { refreshTokens, verifyAccessToken } from '../utils/tokenUtils.js';

// تخزين مؤقت لمحاولات تسجيل الدخول
const loginAttempts = new Map();
const BLOCK_DURATION = 15 * 60 * 1000; // 15 دقيقة
const MAX_LOGIN_ATTEMPTS = 5;

// Middleware محسن للتحقق من التوكن مع تجديد تلقائي
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  try {
    // محاولة التحقق من التوكن الأساسي
    const decoded = jwt.verify(token, jwtConfig.secret);

    // 🔒 Multi-Tenant Security: Extract tenantId from JWT
    const tenantIdFromToken = decoded.tenantId;

    // Check for tenant mismatch if req.tenantId was already resolved from host
    if (req.tenantId && tenantIdFromToken && req.tenantId !== tenantIdFromToken) {
      console.warn(`⚠️ Tenant mismatch: Request tenant ${req.tenantId} vs Token tenant ${tenantIdFromToken}`);
      return res.status(403).json({ error: 'Access denied: Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    const user = await User.findById(decoded.id, tenantIdFromToken);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'Account suspended',
        reason: user.ban_reason,
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.deleted_at) {
      return res.status(403).json({
        error: 'Account has been deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    req.user = user;
    req.tenantId = decoded.tenantId || user.tenant_id || 1; // Extract tenant from JWT
    next();

  } catch (error) {
    console.error('❌ Auth Middleware Error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// دالة مساعدة لتجديد التوكن
async function refreshAccessToken(refreshToken) {
  try {
    // التحقق من الـ refresh token في قاعدة البيانات
    const [tokens] = await pool.execute(
      'SELECT user_id, is_revoked FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0 || tokens[0].is_revoked) {
      throw new Error('Invalid or revoked refresh token');
    }

    // التحقق من صحة الـ JWT
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);

    if (decoded.id !== tokens[0].user_id) {
      throw new Error('Token user ID mismatch');
    }

    // جلب بيانات المستخدم مع التحقق من المستأجر
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_banned, ban_reason, deleted_at, tenant_id FROM users WHERE id = ? AND tenant_id = ?',
      [decoded.id, decoded.tenantId]
    );

    if (users.length === 0 || users[0].is_banned || users[0].deleted_at) {
      throw new Error('User not found or inactive');
    }

    const user = users[0];

    // إنشاء توكنات جديدة with tenant_id
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tenantId: user.tenant_id || 1 },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    // تحديث الـ refresh token في قاعدة البيانات (Atomic Update)
    const [result] = await pool.execute(
      'UPDATE refresh_tokens SET token = ?, created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?',
      [newRefreshToken, refreshToken]
    );

    // معالجة حالة التزامن (Race Condition)
    if (result.affectedRows === 0) {
      console.log('🔄 Concurrency detected in refreshAccessToken, fetching latest token');
      const [latestTokenRows] = await pool.execute(
        'SELECT token FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [user.id]
      );

      if (latestTokenRows.length > 0) {
        return {
          accessToken: accessToken,
          refreshToken: latestTokenRows[0].token
        };
      }
      throw new Error('Session expired during refresh');
    }

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// middleware مبسط للتحقق من التوكن بدون تجديد تلقائي
export const strictAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findById(decoded.id, decoded.tenantId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned || user.deleted_at) {
      return res.status(403).json({
        error: 'Account not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired - please refresh',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(403).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// باقي الـ middlewares تبقى كما هي مع بعض التحسينات
export const authenticateRefreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log('❌ No refresh token provided');
    return res.status(401).json({
      error: 'Refresh token required',
      code: 'REFRESH_TOKEN_REQUIRED'
    });
  }

  try {
    // التحقق من الـ refresh token في قاعدة البيانات أولاً
    const [tokens] = await pool.execute(
      'SELECT user_id, is_revoked FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0) {
      console.log('❌ Refresh token not found in database');
      return res.status(403).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (tokens[0].is_revoked) {
      console.log('❌ Refresh token has been revoked');
      return res.status(403).json({
        error: 'Refresh token revoked',
        code: 'REFRESH_TOKEN_REVOKED'
      });
    }

    // ثم التحقق من الـ JWT
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);

    if (decoded.id !== tokens[0].user_id) {
      console.log('❌ Token user ID mismatch');
      return res.status(403).json({
        error: 'Invalid refresh token',
        code: 'TOKEN_USER_MISMATCH'
      });
    }

    console.log('✅ Refresh token verified for user ID:', decoded.id);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.log('❌ Refresh token verification failed:', error.message);

    if (error.name === 'TokenExpiredError') {
      // حذف الـ refresh token المنتهي
      await pool.execute(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      return res.status(403).json({
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    return res.status(403).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
};

export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      console.log('❌ No refresh token provided');
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // استخدام دالة تجديد التوكن المساعدة
    const newTokens = await refreshAccessToken(refreshToken);

    if (!newTokens) {
      return res.status(403).json({
        error: 'Failed to refresh tokens',
        code: 'TOKEN_REFRESH_FAILED'
      });
    }

    // إضافة التوكنات الجديدة إلى الـ request
    req.newTokens = newTokens;

    // جلب بيانات المستخدم الكاملة
    const decoded = jwt.decode(newTokens.accessToken);
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_banned, ban_reason, deleted_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = users[0];
    console.log('✅ Tokens refreshed for user:', req.user.username);
    next();

  } catch (error) {
    console.error('❌ Refresh token middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// باقي الـ middlewares تبقى كما هي...
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Allow Super Admin, Admin, and Moderator to access general admin routes
  const allowedRoles = ['super_admin', 'admin', 'moderator'];

  if (!allowedRoles.includes(req.user.role)) {
    console.log('🚫 Access denied. User role is:', req.user.role);
    return res.status(403).json({
      error: 'Admin/Moderator access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      debugRole: req.user.role
    });
  }

  next();
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required', code: 'SUPER_ADMIN_REQUIRED' });
  }
  next();
};

export const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const allowedRoles = ['super_admin', 'admin', 'moderator'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Moderator access required',
      code: 'MODERATOR_REQUIRED',
      debugRole: req.user.role
    });
  }
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  next();
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      const user = await User.findById(decoded.id, decoded.tenantId);

      if (user && !user.is_banned && !user.deleted_at) {
        req.user = user;
      }
    } catch (error) {
      // تجاهل الأخطاء في المصادقة الاختيارية
      console.log('Optional auth failed (non-critical):', error.message);
    }
  }

  next();
};

// تصدير باسم optional لتتوافق مع الاستيراد في searchRoutes.js
export const optional = optionalAuth;

// تصدير باسم required لتتوافق مع الاستيراد في searchRoutes.js  
export const required = requireAuth;

export const requireSameUserOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const requestedUserId = parseInt(req.params.userId || req.params.id);

  if (req.user.role !== 'admin' && req.user.id !== requestedUserId) {
    return res.status(403).json({
      error: 'Access denied. You can only access your own data.',
      code: 'ACCESS_DENIED'
    });
  }

  next();
};

export const requireVideoOwnerOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const videoId = req.params.videoId || req.params.id;

    if (!videoId) {
      return res.status(400).json({
        error: 'Video ID is required',
        code: 'VIDEO_ID_REQUIRED'
      });
    }

    const [videos] = await pool.execute(
      'SELECT user_id FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
      [videoId]
    );

    if (videos.length === 0) {
      return res.status(404).json({
        error: 'Video not found',
        code: 'VIDEO_NOT_FOUND'
      });
    }

    const videoOwnerId = videos[0].user_id;

    if (req.user.role !== 'admin' && req.user.id !== videoOwnerId) {
      return res.status(403).json({
        error: 'Access denied. You can only manage your own videos.',
        code: 'ACCESS_DENIED'
      });
    }

    next();
  } catch (error) {
    console.error('Video owner check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const requireChatAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const videoId = req.params.videoId || req.body.videoId;

    if (!videoId) {
      return res.status(400).json({
        error: 'Video ID is required',
        code: 'VIDEO_ID_REQUIRED'
      });
    }

    const [videos] = await pool.execute(
      `SELECT v.id, v.user_id, v.is_private, v.deleted_by_admin,
              uv.user_id as can_access
       FROM videos v
       LEFT JOIN user_video_access uv ON v.id = uv.video_id AND uv.user_id = ?
       WHERE v.id = ?`,
      [req.user.id, videoId]
    );

    if (videos.length === 0) {
      return res.status(404).json({
        error: 'Video not found',
        code: 'VIDEO_NOT_FOUND'
      });
    }

    const video = videos[0];

    if (video.deleted_by_admin) {
      return res.status(403).json({
        error: 'This video has been removed by admin',
        code: 'VIDEO_REMOVED'
      });
    }

    if (video.is_private && !video.can_access && req.user.id !== video.user_id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied to this video chat',
        code: 'CHAT_ACCESS_DENIED'
      });
    }

    req.video = video;
    next();
  } catch (error) {
    console.error('Chat access check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const requireBroadcastAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        error: 'Broadcast access requires admin or moderator role',
        code: 'BROADCAST_ACCESS_DENIED'
      });
    }

    const [permissions] = await pool.execute(
      'SELECT can_broadcast FROM admin_permissions WHERE user_id = ?',
      [req.user.id]
    );

    if (permissions.length === 0 || !permissions[0].can_broadcast) {
      return res.status(403).json({
        error: 'You do not have permission to send broadcasts',
        code: 'BROADCAST_PERMISSION_DENIED'
      });
    }

    next();
  } catch (error) {
    console.error('Broadcast access check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const preventBruteForce = (req, res, next) => {
  const identifier = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!loginAttempts.has(identifier)) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
    return next();
  }

  const attempts = loginAttempts.get(identifier);
  const timeSinceFirstAttempt = now - attempts.firstAttempt;

  if (timeSinceFirstAttempt > BLOCK_DURATION) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
    return next();
  }

  attempts.count++;

  if (attempts.count > MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((BLOCK_DURATION - timeSinceFirstAttempt) / 1000 / 60);
    return res.status(429).json({
      error: 'Too many login attempts',
      message: `Please try again in ${remainingTime} minutes`,
      code: 'TOO_MANY_ATTEMPTS',
      retryAfter: remainingTime
    });
  }

  next();
};

export const checkSystemStatus = async (req, res, next) => {
  try {
    const [systemStatus] = await pool.execute(
      'SELECT maintenance_mode, chat_enabled, upload_enabled FROM system_settings WHERE id = 1'
    );

    if (systemStatus.length === 0) {
      return next();
    }

    const status = systemStatus[0];

    if (status.maintenance_mode && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'System is under maintenance',
        code: 'MAINTENANCE_MODE'
      });
    }

    if (req.path.includes('/chat') && !status.chat_enabled && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'Chat system is temporarily disabled',
        code: 'CHAT_DISABLED'
      });
    }

    if (req.path.includes('/upload') && !status.upload_enabled && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'Upload system is temporarily disabled',
        code: 'UPLOAD_DISABLED'
      });
    }

    next();
  } catch (error) {
    console.error('System status check error:', error);
    next();
  }
};

export const rateLimitMiddleware = (windowMs, maxRequests, keyGenerator = null) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : (req.ip || req.connection.remoteAddress);
    const now = Date.now();
    const windowStart = now - windowMs;

    if (requests.has(key)) {
      requests.set(key, requests.get(key).filter(time => time > windowStart));
    }

    const currentRequests = requests.get(key) || [];

    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    currentRequests.push(now);
    requests.set(key, currentRequests);

    next();
  };
};

export const chatRateLimit = rateLimitMiddleware(60000, 30, (req) => {
  return `chat_${req.user?.id || req.ip}`;
});

export const uploadRateLimit = rateLimitMiddleware(300000, 5, (req) => {
  return `upload_${req.user?.id || req.ip}`;
});

export const validateUserStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'Account suspended',
        reason: user.ban_reason,
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.deleted_at) {
      return res.status(403).json({
        error: 'Account has been deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('User status validation error:', error);
    next();
  }
};

export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }

  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

export const requireCsrfToken = (req, res, next) => {
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;

  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF token required',
      code: 'CSRF_TOKEN_REQUIRED'
    });
  }

  if (req.session && req.session.csrfToken !== csrfToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN'
    });
  }

  next();
};

// تنظيف محاولات تسجيل الدخول القديمة
setInterval(() => {
  const now = Date.now();
  for (const [identifier, attempts] of loginAttempts.entries()) {
    if (now - attempts.firstAttempt > BLOCK_DURATION) {
      loginAttempts.delete(identifier);
    }
  }
}, 60000);

// تصدير جميع الميدلوير
export default {
  authenticateToken,
  strictAuth,
  authenticateRefreshToken,
  refreshTokenMiddleware,
  requireAdmin,
  requireModerator,
  requireAuth,
  optionalAuth,
  optional,
  required,
  requireSameUserOrAdmin,
  requireVideoOwnerOrAdmin,
  requireChatAccess,
  requireBroadcastAccess,
  preventBruteForce,
  checkSystemStatus,
  rateLimitMiddleware,
  chatRateLimit,
  uploadRateLimit,
  validateUserStatus,
  requireApiKey,
  requireCsrfToken
};
