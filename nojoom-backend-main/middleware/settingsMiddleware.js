import { pool } from '../config/db.js';

// Cache settings for 1 minute to avoid hitting DB on every request
let cachedSettings = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

const getSettings = async () => {
    const now = Date.now();
    if (cachedSettings && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedSettings;
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM system_settings WHERE id = 1');
        if (rows.length > 0) {
            cachedSettings = rows[0];
            lastFetchTime = now;
            return cachedSettings;
        }
    } catch (error) {
        console.error('Failed to fetch system settings:', error);
    }
    return null;
};

export const checkMaintenanceMode = async (req, res, next) => {
    // Skip for admin routes, auth routes, and static files
    if (
        req.path.startsWith('/api/admin') ||
        req.path.startsWith('/api/auth/login') ||
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/api/uploads') ||
        req.path.includes('.') // Simple check for implementation files/assets
    ) {
        return next();
    }

    const settings = await getSettings();
    if (settings && settings.maintenance_mode) {
        // Allow admins to bypass maintenance mode if they have a valid token
        // This requires auth middleware to run BEFORE this for protected routes,
        // but for public routes we might block everyone.
        // For simplicity, we block everyone on public routes unless it's a specific bypassed route.
        return res.status(503).json({
            error: 'Service Unavailable',
            message: settings.maintenance_message || 'The system is currently under maintenance. Please try again later.',
            maintenance: true
        });
    }
    next();
};

export const checkUploadEnabled = async (req, res, next) => {
    const settings = await getSettings();
    if (settings && !settings.upload_enabled) {
        return res.status(403).json({
            error: 'Uploads Disabled',
            message: 'Video uploads are currently disabled by the administrator.'
        });
    }
    next();
};

export const checkRegistrationEnabled = async (req, res, next) => {
    const settings = await getSettings();
    if (settings && !settings.user_registration_enabled) {
        return res.status(403).json({
            error: 'Registration Disabled',
            message: 'New user registration is currently disabled.'
        });
    }
    next();
};

export const checkChatEnabled = async (req, res, next) => {
    const settings = await getSettings();
    if (settings && !settings.chat_enabled) {
        return res.status(403).json({
            error: 'Chat Disabled',
            message: 'Chat functionality is currently disabled.'
        });
    }
    next();
};

export const getVideoLimits = async () => {
    const settings = await getSettings();
    return {
        maxSize: settings?.max_video_size || 100 * 1024 * 1024, // Default 100MB
        maxDuration: settings?.max_video_duration || 300 // Default 300s
    };
};
