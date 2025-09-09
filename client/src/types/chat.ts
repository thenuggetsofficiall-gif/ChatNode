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
  ts: number;
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
  data?: T;
}
