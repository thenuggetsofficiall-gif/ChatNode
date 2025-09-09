import { type User, type InsertUser, type DirectMessage, type InsertDirectMessage } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDirectMessages(userId1: string, userId2: string): Promise<DirectMessage[]>;
  createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage>;
  getDirectConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage: string; timestamp: Date }>>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private directMessages: Map<string, DirectMessage>;

  constructor() {
    this.users = new Map();
    this.directMessages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDirectMessages(userId1: string, userId2: string): Promise<DirectMessage[]> {
    const messages = Array.from(this.directMessages.values()).filter(
      (message) =>
        (message.fromUserId === userId1 && message.toUserId === userId2) ||
        (message.fromUserId === userId2 && message.toUserId === userId1)
    );
    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createDirectMessage(insertMessage: InsertDirectMessage): Promise<DirectMessage> {
    const id = randomUUID();
    const message: DirectMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.directMessages.set(id, message);
    return message;
  }

  async getDirectConversations(userId: string): Promise<Array<{ userId: string; username: string; lastMessage: string; timestamp: Date }>> {
    const conversations = new Map<string, { userId: string; username: string; lastMessage: string; timestamp: Date }>();
    
    // Get all direct messages involving this user
    const userMessages = Array.from(this.directMessages.values()).filter(
      (message) => message.fromUserId === userId || message.toUserId === userId
    );

    // Group by the other user and get the latest message
    for (const message of userMessages) {
      const otherUserId = message.fromUserId === userId ? message.toUserId : message.fromUserId;
      const otherUser = this.users.get(otherUserId);
      
      if (otherUser) {
        const existing = conversations.get(otherUserId);
        if (!existing || message.timestamp > existing.timestamp) {
          conversations.set(otherUserId, {
            userId: otherUserId,
            username: otherUser.username,
            lastMessage: message.message,
            timestamp: message.timestamp,
          });
        }
      }
    }

    return Array.from(conversations.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new MemStorage();
