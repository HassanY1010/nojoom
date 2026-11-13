// controllers/messagesController.js
import { Message } from '../models/Message.js';
import UserRepository from '../repositories/UserRepository.js';

export const messagesController = {
  // إرسال رسالة مباشرة (نصية أو صوتية)
  async sendMessage(req, res) {
    try {
      const { receiver_id, content } = req.body;
      const sender_id = req.user.id;
      const audioFile = req.file;

      if (!receiver_id) {
        return res.status(400).json({
          error: 'Receiver ID is required',
          code: 'RECEIVER_ID_REQUIRED'
        });
      }

      // التحقق من وجود محتوى أو ملف صوتي
      if ((!content || content.trim() === '') && !audioFile) {
        return res.status(400).json({
          error: 'Message content or voice recording is required',
          code: 'MESSAGE_CONTENT_REQUIRED'
        });
      }

      if (sender_id === parseInt(receiver_id)) {
        return res.status(400).json({
          error: 'Cannot send message to yourself',
          code: 'SELF_MESSAGE_NOT_ALLOWED'
        });
      }

      // التحقق من وجود المستخدم المستقبل
      const receiver = await UserRepository.findUserById(receiver_id);
 
       if (!receiver) {
         return res.status(404).json({
           error: 'Receiver not found',
           code: 'RECEIVER_NOT_FOUND'
         });
       }
 
       if (receiver.is_banned) {
        return res.status(403).json({
          error: 'Cannot send message to banned user',
          code: 'RECEIVER_BANNED'
        });
      }

      const message_type = audioFile ? 'voice' : 'text';
      const media_url = audioFile ? `/uploads/audio/${audioFile.filename}` : null;

      const messageId = await Message.createDirectMessage({
        tenant_id: req.tenantId, // 🔒 Multi-Tenant Security: Pass tenantId
        sender_id,
        receiver_id: parseInt(receiver_id),
        content: content ? content.trim() : null,
        message_type,
        media_url
      });

      // الحصول على بيانات الرسالة الكاملة
      const message = await Message.getMessageWithDetails(messageId);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على محادثة مع مستخدم
  async getConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const messages = await Message.getConversation(
        currentUserId,
        parseInt(userId),
        req.tenantId, // 🔒 Multi-Tenant Security: Pass tenantId
        parseInt(limit),
        offset
      );

      // تحديث الرسائل كمقروءة
      // 🔒 Multi-Tenant Security: Pass tenantId
      await Message.markAsRead(parseInt(userId), currentUserId, req.tenantId);

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: messages.length
          }
        }
      });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على قائمة المحادثات
  async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const tenantId = req.tenantId || req.tenant?.id || 1;
      const conversations = await Message.getUserConversations(userId, tenantId);

      res.json({
        success: true,
        data: conversations || []
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.json({
        success: true,
        data: []
      });
    }
  },

  // الحصول على عدد الرسائل غير المقروءة
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      // 🔒 Multi-Tenant Security: Pass tenantId
      const unreadCount = await Message.getUnreadCount(userId, req.tenantId);

      res.json({
        success: true,
        data: { unread_count: unreadCount }
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // وضع علامة مقروء على رسائل محادثة
  async markAsRead(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const affectedRows = await Message.markAsRead(parseInt(userId), currentUserId);

      res.json({
        success: true,
        message: 'Messages marked as read',
        data: { marked_count: affectedRows }
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // البحث في الرسائل
  async searchMessages(req, res) {
    try {
      const { q: query } = req.query;
      const userId = req.user.id;

      if (!query || query.trim() === '') {
        return res.status(400).json({
          error: 'Search query is required',
          code: 'SEARCH_QUERY_REQUIRED'
        });
      }

      const messages = await Message.searchMessages(userId, query.trim(), req.tenantId);

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // حذف محادثة
  async deleteConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const deletedCount = await Message.deleteConversation(currentUserId, parseInt(userId), req.tenantId);

      res.json({
        success: true,
        message: 'Conversation deleted successfully',
        data: { deleted_count: deletedCount }
      });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على إحصائيات الرسائل
  async getMessageStats(req, res) {
    try {
      const userId = req.user.id;
      // 🔒 Multi-Tenant Security: Pass tenantId
      const stats = await Message.getMessageStats(userId, req.tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get message stats error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};