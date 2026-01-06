import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  macAddress: varchar("mac_address", { length: 17 }),
  deviceType: text("device_type").notNull().default("other"),
  os: text("os"),
  description: text("description"),
  status: text("status").notNull().default("unknown"),
  lastSeenAt: timestamp("last_seen_at"),
  lastCheckedAt: timestamp("last_checked_at"),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  status: true,
  lastSeenAt: true,
  lastCheckedAt: true,
}).extend({
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address format"),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address format").optional().or(z.literal("")),
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
