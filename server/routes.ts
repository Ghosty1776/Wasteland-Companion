import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

const SessionStore = MemoryStore(session);
const SALT_ROUNDS = 10;

// Extend express session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
  }
}

// Simulated system data - in production this would come from actual system APIs
function getSystemStatus() {
  const uptimeSecs = Math.floor(process.uptime());
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const minutes = Math.floor((uptimeSecs % 3600) / 60);
  
  return {
    hostname: "ubuntu-server",
    uptime: `${days}d ${hours}h ${minutes}m`,
    cpuUsage: Math.floor(Math.random() * 30 + 15), // 15-45%
    memoryUsage: Math.floor(Math.random() * 25 + 40), // 40-65%
    diskUsage: Math.floor(Math.random() * 10 + 55), // 55-65%
    networkStatus: "online" as const,
    temperature: Math.floor(Math.random() * 15 + 45), // 45-60°C
    services: [
      { name: "Nginx", status: "running" as const, port: 80, uptime: "7d 12h" },
      { name: "PostgreSQL", status: "running" as const, port: 5432, uptime: "7d 12h" },
      { name: "Redis", status: "running" as const, port: 6379, uptime: "7d 12h" },
      { name: "Docker", status: "running" as const, uptime: "7d 12h" },
      { name: "SSH", status: "running" as const, port: 22, uptime: "7d 12h" },
      { name: "Firewall", status: "running" as const, uptime: "7d 12h" },
    ],
    lastUpdate: new Date().toLocaleTimeString(),
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware with improved security settings
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "lab-companion-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "strict",
      },
    })
  );

  // Create default admin user if no users exist (with hashed password)
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", SALT_ROUNDS);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
    });
    console.log("Default admin user created. IMPORTANT: Change password in production!");
  }

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Login route with validation
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parseResult = insertUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors 
        });
      }

      const { username, password } = parseResult.data;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // Check auth status
  app.get("/api/auth/status", (req: Request, res: Response) => {
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        user: { 
          id: req.session.userId, 
          username: req.session.username 
        } 
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // System status route (protected)
  app.get("/api/system/status", requireAuth, (req: Request, res: Response) => {
    const status = getSystemStatus();
    res.json(status);
  });

  // ============ USER MANAGEMENT ROUTES ============

  // Get all users (protected)
  app.get("/api/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Return users without passwords
      const safeUsers = users.map(u => ({ id: u.id, username: u.username }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new user (protected)
  const createUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors 
        });
      }

      const { username, password } = parseResult.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update user password (protected)
  const updatePasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  app.patch("/api/users/:id/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const parseResult = updatePasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors 
        });
      }

      const { password } = parseResult.data;

      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await storage.updateUserPassword(id, hashedPassword);

      if (!user) {
        return res.status(500).json({ error: "Failed to update password" });
      }

      res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete user (protected)
  app.delete("/api/users/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent deleting own account
      if (id === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete user" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
