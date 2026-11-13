import express from 'express';
import { refreshTokenMiddleware } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { setCsrfCookie } from '../middleware/csrfMiddleware.js';

const router = express.Router();

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// route لتجديد التوكن
router.post('/refresh', refreshTokenMiddleware, async (req, res) => {
  try {
    // التوكنات الجديدة موجودة في req.newTokens من الـ middleware
    const { accessToken, refreshToken } = req.newTokens;
    setRefreshCookie(res, refreshToken);
    setCsrfCookie(res);

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        accessToken,
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    console.error('Token refresh route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tokens',
      code: 'TOKEN_REFRESH_FAILED'
    });
  }
});

// route للتحقق من صحة التوكن
router.post('/validate', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // محاولة التحقق من التوكن
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        expiresAt: decoded.exp * 1000 // تحويل إلى ملي ثانية
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.json({
        success: true,
        message: 'Token is expired',
        data: {
          valid: false,
          expired: true,
          expiresAt: error.expiredAt
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Token is invalid',
      data: {
        valid: false,
        expired: false
      }
    });
  }
});

export default router;
