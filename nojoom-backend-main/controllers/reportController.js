import { Report } from '../models/Report.js';
import { Video } from '../models/Video.js';
import { User } from '../models/User.js';
import path from 'path';
import fs from 'fs';

export const reportController = {

  getReportsStats: async (req, res) => {
    try {
      const stats = await Report.getStats();
      const reasonsStats = await Report.getReportsByReason();
      const recentReportsCount = await Report.getRecentReportsCount(24);
      const topReportedUsers = await Report.getTopReportedUsers(5);
 
       res.status(200).json({
         stats,
         basicStats: stats, // للمحافظة على التوافق مع الفرونت إند
         reasons: reasonsStats,
         recent: {
           last24h: recentReportsCount
         },
         topReportedUsers
       });
    } catch (error) {
      console.error('Error fetching reports stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async createReport(req, res) {
    try {
      const { videoId, reportedUserId: reportedUserIdParam } = req.params;
      const { reason, description, reported_user_id } = req.body;
      const userId = req.user.id;

      // التحقق من البيانات المطلوبة
      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }

      const validReasons = ['spam', 'harassment', 'inappropriate', 'copyright', 'other'];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: 'Invalid reason' });
      }

      let video = null;
      let reportedUserId = reportedUserIdParam || reported_user_id;

      // إذا كان هناك videoId، التحقق من وجود الفيديو
      if (videoId && videoId !== 'undefined' && videoId !== '0') {
        // 🔒 Multi-Tenant Security: Pass tenantId
        video = await Video.findById(videoId, req.tenantId);
        if (!video) {
          return res.status(404).json({ error: 'Video not found' });
        }
        reportedUserId = video.user_id;
      }

      // التحقق من وجود المستخدم المبلغ عنه
      if (reportedUserId) {
        // 🔒 Multi-Tenant Security: Pass tenantId
        const reportedUser = await User.findById(reportedUserId, req.tenantId);
        if (!reportedUser) {
          return res.status(404).json({ error: 'Reported user not found' });
        }
      } else {
        return res.status(400).json({ error: 'Reported user or video is required' });
      }

      // التحقق من أن المستخدم لم يبلغ عن هذا المحتوى مسبقًا
      if (videoId && videoId !== 'undefined' && videoId !== '0') {
        const hasReported = await Report.userHasReportedVideo(userId, videoId);
        if (hasReported) {
          return res.status(400).json({ error: 'You have already reported this video' });
        }
      }

      // إنشاء البلاغ
      const reportId = await Report.create({
        reporter_id: userId,
        video_id: videoId ? parseInt(videoId) : null,
        reported_user_id: reportedUserId,
        reason,
        description: description || ''
      });

      // جلب بيانات البلاغ مع المعلومات الإضافية
      const report = await Report.findById(reportId);

      res.status(201).json({
        message: 'Report submitted successfully',
        report
      });
    } catch (error) {
      console.error('Create report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },



  async getReports(req, res) {
    try {
      const { status, page = 1, limit = 20, reason, user_id } = req.query;

      const result = await Report.getReports(
        parseInt(page),
        parseInt(limit),
        status
      );

      const stats = await Report.getStats();

      res.json({
        reports: result.reports,
        pagination: {
          page: result.page,
          limit: parseInt(limit),
          total: result.total,
          totalPages: result.totalPages
        },
        stats
      });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getReport(req, res) {
    try {
      const { id } = req.params;
      const report = await Report.getReportById(id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json({ report });
    } catch (error) {
      console.error('Get report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateReportStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;
      const adminId = req.user.id;

      const validStatuses = ['pending', 'resolved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const report = await Report.getReportById(id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const updated = await Report.updateStatus(id, status, adminId, admin_notes);

      if (!updated) {
        return res.status(500).json({ error: 'Failed to update report' });
      }

      const updatedReport = await Report.getReportById(id);

      res.json({
        message: 'Report status updated successfully',
        report: updatedReport
      });
    } catch (error) {
      console.error('Update report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteVideo(req, res) {
    try {
      const { reportId } = req.params;
      const { deletion_reason } = req.body;
      const adminId = req.user.id;

      const report = await Report.getReportById(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      if (!report.video_id) {
        return res.status(400).json({ error: 'This report is not associated with a video' });
      }

      // حذف الفيديو باستخدام دالة Video
      const success = await Video.deleteVideoAdmin(report.video_id, deletion_reason);

      if (!success) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // تحديث حالة البلاغ
      await Report.updateStatus(reportId, 'resolved', adminId, `Video deleted: ${deletion_reason}`);

      const updatedReport = await Report.getReportById(reportId);

      res.json({
        message: 'Video deleted successfully',
        report: updatedReport
      });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async keepVideo(req, res) {
    try {
      const { reportId } = req.params;
      const { admin_notes } = req.body;
      const adminId = req.user.id;

      const report = await Report.getReportById(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // تحديث حالة البلاغ إلى resolved مع ملاحظة أن الفيديو تم الاحتفاظ به
      const notes = admin_notes || 'Video reviewed and kept - no violation found';
      await Report.updateStatus(reportId, 'resolved', adminId, notes);

      const updatedReport = await Report.getReportById(reportId);

      res.json({
        message: 'Video kept successfully',
        report: updatedReport
      });
    } catch (error) {
      console.error('Keep video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async banUserFromReport(req, res) {
    try {
      const { reportId } = req.params;
      const { ban_reason } = req.body;
      const adminId = req.user.id;

      const report = await Report.getReportById(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      if (!report.reported_user_id) {
        return res.status(400).json({ error: 'This report is not associated with a user' });
      }

      // حظر المستخدم
      const success = await User.banUser(report.reported_user_id, ban_reason);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // تحديث حالة البلاغ
      await Report.updateStatus(reportId, 'resolved', adminId, `User banned: ${ban_reason}`);

      const updatedReport = await Report.getReportById(reportId);

      res.json({
        message: 'User banned successfully',
        report: updatedReport
      });
    } catch (error) {
      console.error('Ban user from report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getMyReports(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const reports = await Report.findAll({
        reporter_id: userId,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      const total = await Report.getReportsCount({ reporter_id: userId });
 
       res.json({
         reports,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total
         }
       });
    } catch (error) {
      console.error('Get my reports error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },


  async resolveMultipleReports(req, res) {
    try {
      const { reportIds, admin_notes } = req.body;
      const adminId = req.user.id;

      if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ error: 'Report IDs array is required' });
      }

      const resolvedCount = await Report.resolveMultipleReports(
        reportIds,
        adminId,
        admin_notes || 'Bulk resolution'
      );

      res.json({
        message: `${resolvedCount} reports resolved successfully`,
        resolvedCount
      });
    } catch (error) {
      console.error('Resolve multiple reports error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getTopReportedContent(req, res) {
    try {
      const { limit = 10 } = req.query;

      const topUsers = await Report.getTopReportedUsers(parseInt(limit));
      const topVideos = await Report.getTopReportedVideos(parseInt(limit));

      res.json({
        topReportedUsers: topUsers,
        topReportedVideos: topVideos
      });
    } catch (error) {
      console.error('Get top reported content error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getReportsByReason(req, res) {
    try {
      const { reason } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const validReasons = ['spam', 'harassment', 'inappropriate', 'copyright', 'other'];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: 'Invalid reason' });
      }

      const reports = await Report.findAll({
        reason: reason,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      const total = await Report.getReportsCount({ reason });
 
       res.json({
         reports,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total
         },
         reason
      });
    } catch (error) {
      console.error('Get reports by reason error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteReport(req, res) {
    try {
      const { id } = req.params;

      const report = await Report.getReportById(id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const affectedRows = await Report.deleteReport(id);
 
       if (affectedRows === 0) {
         return res.status(404).json({ error: 'Report not found' });
       }

      res.json({
        message: 'Report deleted successfully'
      });
    } catch (error) {
      console.error('Delete report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async exportReports(req, res) {
    try {
      const { format = 'json', status } = req.query;

      let reports;
      if (status) {
        reports = await Report.findAll({ status });
      } else {
        reports = await Report.findAll();
      }

      if (format === 'csv') {
        // تحويل إلى CSV
        const headers = ['ID', 'Reporter', 'Reported User', 'Reason', 'Status', 'Created At', 'Resolved At'];
        const csvData = reports.map(report => [
          report.id,
          report.reporter_username,
          report.reported_username || 'N/A',
          report.reason,
          report.status,
          report.created_at,
          report.resolved_at || 'N/A'
        ]);

        const csvContent = [
          headers.join(','),
          ...csvData.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
        return res.send(csvContent);
      }

      // افتراضي JSON
      res.json({
        reports,
        exportInfo: {
          format: 'json',
          total: reports.length,
          exportedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Export reports error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
export default reportController;
