import api from './api';

export const reportService = {
  // إنشاء بلاغ جديد عن فيديو
  async createReport(videoId, reason, description = '') {
    const response = await api.post(`/reports/video/${videoId}`, {
      reason,
      description
    });
    return response.data;
  },

  // إنشاء بلاغ جديد عن مستخدم
  async createUserReport(userId, reason, description = '') {
    const response = await api.post(`/reports/user/${userId}`, {
      reason,
      description
    });
    return response.data;
  },

  // الحصول على بلاغات المستخدم
  async getMyReports(page = 1, limit = 10) {
    const response = await api.get(`/reports/my-reports?page=${page}&limit=${limit}`);
    return response.data;
  },

  // الحصول على جميع البلاغات (لأدمن فقط)
  async getAllReports(status = null, page = 1, limit = 20) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.append('status', status);

    const response = await api.get(`/admin/reports?${params}`);
    return response.data;
  },

  // الحصول على بلاغ محدد (لأدمن فقط)
  async getReport(reportId) {
    const response = await api.get(`/admin/reports/${reportId}`);
    return response.data;
  },

  // تحديث حالة البلاغ (لأدمن فقط)
  async updateReportStatus(reportId, status, adminNotes = null) {
    const response = await api.patch(`/admin/reports/${reportId}/status`, {
      status,
      admin_notes: adminNotes
    });
    return response.data;
  },

  // حذف الفيديو من خلال البلاغ (لأدمن فقط)
  async deleteVideo(reportId, deletionReason) {
    const response = await api.post(`/admin/reports/${reportId}/delete-video`, {
      deletion_reason: deletionReason
    });
    return response.data;
  },

  // الاحتفاظ بالفيديو (لأدمن فقط)
  async keepVideo(reportId, adminNotes) {
    const response = await api.post(`/admin/reports/${reportId}/keep-video`, {
      admin_notes: adminNotes
    });
    return response.data;
  }
};