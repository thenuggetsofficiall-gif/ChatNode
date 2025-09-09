import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull(),
  toUserId: varchar("to_user_id").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).pick({
  fromUserId: true,
  toUserId: true,
  message: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
