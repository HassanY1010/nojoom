import { io, Socket } from 'socket.io-client';
import { authSession } from './authSession';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket | null {
    if (this.socket) {
      console.log('⚠️ Socket already initialized, returning existing instance');
      return this.socket;
    }

    try {
      const token = authSession.getAccessToken();

      if (!token) {
        console.log('⚠️ No access token found - socket will not connect');
        return null;
      }

      // ✅ استخدام VITE_SOCKET_URL مع التأكد من HTTPS
      const socketUrl = import.meta.env.VITE_SOCKET_URL;

      if (!socketUrl) {
        console.error('❌ VITE_SOCKET_URL is not defined');
        return null;
      }

      console.log('🔄 Connecting to WebSocket:', socketUrl);

      this.socket = io(socketUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'], // ✅ إضافة polling كبديل
        secure: true,
        withCredentials: true,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server via WebSocket');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);

        // ✅ محاولة إعادة الاتصال تلقائياً
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          this.connect();
        }, 5000);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);

        if (reason === 'io server disconnect') {
          // ✅ الخادم قطع الاتصال، إعادة الاتصال يدوياً
          this.connect();
        }
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 WebSocket reconnection attempt ${attemptNumber}`);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`✅ WebSocket reconnected successfully after ${attemptNumber} attempts`);
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ WebSocket reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ WebSocket reconnection failed');
      });

      return this.socket;

    } catch (error) {
      console.error('❌ Socket initialization error:', error);
      return null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 WebSocket disconnected');
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // ==================== دوال التعليقات ====================
  joinVideoRoom(videoId: number) {
    if (this.socket) {
      this.socket.emit('join_video', videoId);
      console.log(`🎥 Joined video room: ${videoId}`);
    } else {
      console.warn('⚠️ Socket not connected, cannot join video room');
    }
  }

  leaveVideoRoom(videoId: number) {
    if (this.socket) {
      this.socket.emit('leave_video', videoId);
      console.log(`🎥 Left video room: ${videoId}`);
    }
  }

  sendComment(videoId: number, comment: any) {
    if (this.socket) {
      this.socket.emit('new_comment', { videoId, comment });
    } else {
      console.warn('⚠️ Socket not connected, cannot send comment');
    }
  }

  onNewComment(callback: (comment: any) => void) {
    if (this.socket) {
      this.socket.on('new_comment', callback);
    }
  }

  onCommentDeleted(callback: (data: { commentId: number; videoId: number }) => void) {
    if (this.socket) {
      this.socket.on('comment_deleted', callback);
    }
  }

  offNewComment() {
    if (this.socket) {
      this.socket.off('new_comment');
    }
  }

  offCommentDeleted() {
    if (this.socket) {
      this.socket.off('comment_deleted');
    }
  }

  // ==================== دوال الدردشة ====================
  sendChatMessage(videoId: number, content: string) {
    if (this.socket) {
      this.socket.emit('chat_message', { videoId, content });
    }
  }

  onChatMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('chat_message', callback);
    }
  }

  offChatMessage() {
    if (this.socket) {
      this.socket.off('chat_message');
    }
  }

  // ==================== دوال الكتابة ====================
  startTyping(videoId: number) {
    if (this.socket) {
      this.socket.emit('typing_start', { videoId });
    }
  }

  stopTyping(videoId: number) {
    if (this.socket) {
      this.socket.emit('typing_stop', { videoId });
    }
  }

  onUserTyping(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  onUserStoppedTyping(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_stopped_typing', callback);
    }
  }

  // ==================== دوال الإعجاب ====================
  likeVideo(videoId: number) {
    if (this.socket) {
      this.socket.emit('video_like', { videoId });
    }
  }

  onVideoLikesUpdated(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('video_likes_updated', callback);
    }
  }

  // ==================== دوال المتابعة ====================
  followUser(targetUserId: number) {
    if (this.socket) {
      this.socket.emit('user_follow', { targetUserId });
    }
  }

  onUserFollowed(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_followed', callback);
    }
  }

  onUserUnfollowed(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_unfollowed', callback);
    }
  }

  // ==================== دوال البث الإداري ====================
  onBroadcastMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('broadcast_message', callback);
    }
  }

  // ==================== دوال حالة الاتصال ====================
  setUserOnline() {
    if (this.socket) {
      this.socket.emit('user_online');
    }
  }

  setUserAway() {
    if (this.socket) {
      this.socket.emit('user_away');
    }
  }

  onUserOnlineStatus(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_online_status', callback);
    }
  }

  // ==================== دوال المشاهدة ====================
  updateWatchTime(videoId: number, watchTime: number, completed: boolean = false) {
    if (this.socket) {
      this.socket.emit('video_watch_time', { videoId, watchTime, completed });
    }
  }

  updateWatchHistory(videoId: number, watchTime: number = 1, completed: boolean = false) {
    if (this.socket) {
      this.socket.emit('update_watch_history', { videoId, watchTime, completed });
    }
  }

  onWatchTimeUpdated(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('watch_time_updated', callback);
    }
  }

  // ==================== دوال الرسائل الخاصة ====================
  sendPrivateMessage(receiverId: number, content: string) {
    if (this.socket) {
      this.socket.emit('private_message', { receiver_id: receiverId, content });
    }
  }

  onPrivateMessageReceived(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('private_message_received', callback);
    }
  }

  onPrivateMessageSent(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('private_message_sent', callback);
    }
  }

  // ==================== إزالة جميع المستمعين ====================
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export const socketService = new SocketService();
