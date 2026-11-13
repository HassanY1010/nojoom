/**
 * Socket.io Tenant Isolation Setup
 * Ensures real-time events are isolated per tenant
 */

const socketIoTenantSetup = (io) => {

    // Middleware to resolve tenant from socket connection
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            const host = socket.handshake.headers.host;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify JWT and extract user info
            const jwt = require('jsonwebtoken');
            const { jwtConfig } = require('../config/jwt');

            const decoded = jwt.verify(token, jwtConfig.secret);
            socket.userId = decoded.id;
            socket.userRole = decoded.role;

            // Resolve tenant from host
            const db = require('../config/db');
            let subdomain = null;
            let customDomain = null;

            const parts = host.split('.');

            if (parts.length === 1 || host.includes('localhost')) {
                subdomain = 'default';
            } else if (parts.length === 2) {
                customDomain = host;
            } else if (parts.length >= 3) {
                subdomain = parts[0];
            }

            let query, params;
            if (customDomain) {
                query = 'SELECT id, name FROM tenants WHERE custom_domain = ? AND is_active = 1 LIMIT 1';
                params = [customDomain];
            } else {
                query = 'SELECT id, name FROM tenants WHERE subdomain = ? AND is_active = 1 LIMIT 1';
                params = [subdomain];
            }

            const [tenants] = await db.promise().query(query, params);

            if (!tenants || tenants.length === 0) {
                return next(new Error('Tenant not found'));
            }

            socket.tenantId = tenants[0].id;
            socket.tenantName = tenants[0].name;

            // Join tenant-specific room
            socket.join(`tenant_${socket.tenantId}`);

            console.log(`✅ Socket connected: User ${socket.userId} in Tenant ${socket.tenantId}`);

            next();
        } catch (error) {
            console.error('Socket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        const tenantId = socket.tenantId;
        const userId = socket.userId;

        console.log(`🔌 User ${userId} connected to Tenant ${tenantId}`);

        // Join user-specific room within tenant
        socket.join(`tenant_${tenantId}_user_${userId}`);

        // Notify tenant about new connection (optional)
        socket.to(`tenant_${tenantId}`).emit('user_online', {
            userId,
            timestamp: new Date()
        });

        // Handle tenant-scoped events

        // Video events
        socket.on('video:like', async (data) => {
            const { videoId } = data;
            // Emit only to users in the same tenant
            io.to(`tenant_${tenantId}`).emit('video:liked', {
                videoId,
                userId,
                timestamp: new Date()
            });
        });

        socket.on('video:comment', async (data) => {
            const { videoId, comment } = data;
            io.to(`tenant_${tenantId}`).emit('video:commented', {
                videoId,
                userId,
                comment,
                timestamp: new Date()
            });
        });

        // Chat events (tenant-scoped)
        socket.on('message:send', async (data) => {
            const { receiverId, content } = data;
            // Send to specific user in the same tenant
            io.to(`tenant_${tenantId}_user_${receiverId}`).emit('message:received', {
                senderId: userId,
                content,
                timestamp: new Date()
            });
        });

        // Notification events
        socket.on('notification:read', async (data) => {
            const { notificationId } = data;
            // Update notification status in DB (with tenant_id check)
            const db = require('../config/db');
            await db.promise().query(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND tenant_id = ?',
                [notificationId, userId, tenantId]
            );
        });

        // Disconnect event
        socket.on('disconnect', () => {
            console.log(`🔌 User ${userId} disconnected from Tenant ${tenantId}`);
            socket.to(`tenant_${tenantId}`).emit('user_offline', {
                userId,
                timestamp: new Date()
            });
        });
    });

    return io;
};

/**
 * Helper function to emit events to specific tenant
 */
const emitToTenant = (io, tenantId, eventName, data) => {
    io.to(`tenant_${tenantId}`).emit(eventName, data);
};

/**
 * Helper function to emit events to specific user in tenant
 */
const emitToUser = (io, tenantId, userId, eventName, data) => {
    io.to(`tenant_${tenantId}_user_${userId}`).emit(eventName, data);
};

module.exports = {
    socketIoTenantSetup,
    emitToTenant,
    emitToUser
};
