export interface User {
  username: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  profileImageUrl?: string;
}

export interface Message {
  display: string;
  text: string;
  email: string;
  role: string;
  profileImageUrl?: string;
  ts: number;
}

export interface UnifiedMessage {
  id?: string;
  display: string;
  text: string;
  email: string;
  role: string;
  profileImageUrl?: string;
  ts: number;
  isDirect?: boolean;
  fromUserId?: string;
  toUserId?: string;
}

export interface Warning {
  reason: string;
  issuer: string;
  ts: number;
  acknowledged: boolean;
}

export interface Ban {
  reason: string;
  issuer: string;
  ts: number;
}

export interface MessageLog extends Message {
  room: string;
}

export interface Room {
  name: string;
  createdAt: number;
}

export interface DirectMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  timestamp: Date;
  fromUser?: { id: string; username: string; profileImageUrl?: string };
  toUser?: { id: string; username: string };
}

export interface DirectConversation {
  userId: string;
  username: string;
  lastMessage: string;
  timestamp: Date;
}

export interface SocketResponse<T = any> {
  ok: boolean;
  err?: string;
  reason?: string;
  ban?: Ban;
  user?: User;
  rooms?: string[];
  messages?: Message[];
  logs?: MessageLog[];
  bans?: Record<string, Ban>;
  conversations?: DirectConversation[];
  data?: T;
}
