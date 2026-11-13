import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { authSession } from '../services/authSession';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
  updateToken: (token: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: (token) => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3333';
    console.log('🔌 Connecting to socket at:', socketUrl);

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      set({ isConnected: true });
      newSocket.emit('user_online');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      set({ isConnected: false });
    });

    newSocket.on('reconnect_attempt', () => {
      const currentToken = authSession.getAccessToken();
      newSocket.auth = { token: currentToken };
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('user_away');
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  updateToken: (token) => {
    const { socket } = get();
    if (socket) {
      socket.auth = { token };
      if (socket.disconnected) {
        socket.connect();
      }
    }
  }
}));
