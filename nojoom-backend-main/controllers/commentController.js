import { Comment } from '../models/Comment.js';
import CommentService from '../services/CommentService.js';
import xss from 'xss';

export const commentController = {
  // الحصول على تعليقات الفيديو
  async getComments(req, res) {
    try {
      const { videoId } = req.params;
      const user_id = req.user?.id || 0;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      console.log(`📝 Getting comments for video: ${videoId}, User: ${user_id}`);

      // 🔒 Multi-Tenant Security: Pass tenantId
      const comments = await Comment.getByVideoId(videoId, req.tenantId, limit, offset, user_id);
      const totalCount = await Comment.getCountByVideoId(videoId, req.tenantId);

      res.json({
        comments,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  },

  // إضافة تعليق جديد
  async postComment(req, res) {
    try {
      const { videoId } = req.params;
      const { content, video_reply_id } = req.body;
      const { id: user_id, username } = req.user;

      if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const cleanContent = xss(content.trim());

      const comment = await CommentService.addComment({
        videoId,
        userId: user_id,
        username,
        content: cleanContent,
        videoReplyId: video_reply_id,
        tenantId: req.tenantId
      });

      comment.is_owner = true;

      res.status(201).json({
        message: 'Comment added successfully',
        comment
      });

    } catch (error) {
      console.error('Post comment error:', error);
      res.status(500).json({ error: 'Failed to post comment' });
    }
  },

  // حذف تعليق
  async deleteComment(req, res) {
    try {
      const { commentId } = req.params;
      const userId = req.user.id;

      console.log(`🗑️ Deleting comment: ${commentId} by user: ${userId}`);

      // 🔒 Multi-Tenant Security: Pass tenantId
      const comment = await Comment.findById(commentId, req.tenantId);

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // التحقق من أن المستخدم هو صاحب التعليق
      if (comment.user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }

      // 🔒 Multi-Tenant Security: Pass tenantId
      const deleted = await Comment.delete(commentId, userId, req.tenantId);

      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete comment' });
      }

      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  },

  // الإبلاغ عن تعليق
  async reportComment(req, res) {
    try {
      const { commentId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: 'Report reason is required' });
      }

      console.log(`🚩 Reporting comment: ${commentId} by user: ${userId}, Reason: ${reason}`);

      // 🔒 Multi-Tenant Security: Pass tenantId
      const comment = await Comment.findById(commentId, req.tenantId);

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // لا يمكن الإبلاغ عن تعليقك الخاص
      if (comment.user_id === userId) {
        return res.status(400).json({ error: 'Cannot report your own comment' });
      }

      const result = await Comment.report(commentId, userId, reason.trim());

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ message: 'Comment reported successfully' });
    } catch (error) {
      console.error('Report comment error:', error);
      res.status(500).json({ error: 'Failed to report comment' });
    }
  },

  // تحديث تعليق
  async updateComment(req, res) {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      console.log(`✏️ Updating comment: ${commentId} by user: ${userId}`);

      // 🔒 Multi-Tenant Security: Pass tenantId
      const comment = await Comment.findById(commentId, req.tenantId);

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this comment' });
      }

      const cleanContent = xss(content.trim());
      const updated = await Comment.update(commentId, userId, cleanContent);

      if (!updated) {
        return res.status(500).json({ error: 'Failed to update comment' });
      }

      // 🔒 Multi-Tenant Security: Pass tenantId
      const updatedComment = await Comment.findById(commentId, req.tenantId);

      res.json({
        message: 'Comment updated successfully',
        comment: updatedComment
      });
    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  },

  // الحصول على إحصائيات التعليق
  async getCommentStats(req, res) {
    try {
      const { commentId } = req.params;

      const stats = await Comment.getStats(commentId);

      res.json({ stats });
    } catch (error) {
      console.error('Get comment stats error:', error);
      res.status(500).json({ error: 'Failed to get comment stats' });
    }
  }
};