import { users, devices, type User, type InsertUser, type Device, type InsertDevice } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithRole(user: InsertUser, role: string): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  getAllDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, device: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceStatus(id: string, status: string, lastSeenAt?: Date): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createUserWithRole(insertUser: InsertUser, role: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, role })
      .returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values(insertDevice)
      .returning();
    return device;
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    const [device] = await db
      .update(devices)
      .set(updates)
      .where(eq(devices.id, id))
      .returning();
    return device || undefined;
  }

  async updateDeviceStatus(id: string, status: string, lastSeenAt?: Date): Promise<Device | undefined> {
    const updateData: { status: string; lastCheckedAt: Date; lastSeenAt?: Date } = {
      status,
      lastCheckedAt: new Date(),
    };
    if (lastSeenAt) {
      updateData.lastSeenAt = lastSeenAt;
    }
    const [device] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, id))
      .returning();
    return device || undefined;
  }

  async deleteDevice(id: string): Promise<boolean> {
    const result = await db.delete(devices).where(eq(devices.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
