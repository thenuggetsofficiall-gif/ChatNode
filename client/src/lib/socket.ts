import { io, Socket } from 'socket.io-client';
import type { User, Message, Warning, Ban, SocketResponse } from '@/types/chat';

class SocketManager {
  private socket: Socket | null = null;
  private connected = false;

  connect() {
    if (this.socket) return this.socket;

    this.socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }

  getSocket() {
    return this.socket;
  }

  // Auth methods
  join(email: string, password: string, username?: string): Promise<SocketResponse<{ user: User; rooms: string[] }>> {
    return new Promise((resolve) => {
      this.socket?.emit('join', { email, password, username }, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  // Message methods
  sendMessage(room: string, text: string): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('message', { room, text }, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  getMessages(room: string): Promise<SocketResponse<{ messages: Message[] }>> {
    return new Promise((resolve) => {
      this.socket?.emit('getMessages', room, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  // Room methods
  createRoom(roomName: string): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('createRoom', roomName, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  // Admin methods
  warnUser(email: string, reason: string): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('warnUser', { email, reason }, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  banUser(email: string, reason: string): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('banUser', { email, reason }, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  unbanUser(email: string): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('unbanUser', email, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  getLogs(): Promise<SocketResponse<{ logs: Message[] }>> {
    return new Promise((resolve) => {
      this.socket?.emit('getLogs', (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  getBans(): Promise<SocketResponse<{ bans: Record<string, Ban> }>> {
    return new Promise((resolve) => {
      this.socket?.emit('getBans', (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  ackWarning(): Promise<SocketResponse> {
    return new Promise((resolve) => {
      this.socket?.emit('ackWarning', (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  // Event listeners
  onMessage(callback: (data: { room: string; msg: Message }) => void) {
    this.socket?.on('message', callback);
  }

  onRooms(callback: (rooms: string[]) => void) {
    this.socket?.on('rooms', callback);
  }

  onWarning(callback: (warning: Warning) => void) {
    this.socket?.on('warning', callback);
  }

  onBanned(callback: (ban: Ban) => void) {
    this.socket?.on('banned', callback);
  }

  onConnect(callback: () => void) {
    this.socket?.on('connect', callback);
  }

  onDisconnect(callback: () => void) {
    this.socket?.on('disconnect', callback);
  }

  // Remove listeners
  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }
}

export const socketManager = new SocketManager();
