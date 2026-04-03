import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🔌 Connected to real-time server');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from real-time server');
      });
    }
    return this.socket;
  }

  joinOrganization(orgId: number | string) {
    if (this.socket) {
      this.socket.emit('join:org', orgId);
      console.log(`📡 Joined organization room: org_${orgId}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
