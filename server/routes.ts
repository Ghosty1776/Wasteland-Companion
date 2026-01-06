import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { getSystemStatus } from "./systemMetrics";

const SessionStore = MemoryStore(session);
const SALT_ROUNDS = 10;

// Extend express session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy for deployments behind Nginx or other reverse proxies
  app.set("trust proxy", 1);

  // Session middleware with production-ready settings
  // For HTTPS deployments, set SECURE_COOKIES=true in environment
  const useSecureCookies = process.env.SECURE_COOKIES === "true";
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "lab-companion-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        secure: useSecureCookies,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
      },
    })
  );

  // Create default admin user if no users exist (with hashed password)
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", SALT_ROUNDS);
    await storage.createUserWithRole({
      username: "admin",
      password: hashedPassword,
    }, "admin");
    console.log("Default admin user created. IMPORTANT: Change password in production!");
  }

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
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
      req.session.role = user.role;

      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, role: user.role } 
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
          username: req.session.username,
          role: req.session.role 
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

  // Get all users (admin only)
  app.get("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Return users without passwords
      const safeUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role }));
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

  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
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

  app.patch("/api/users/:id/password", requireAdmin, async (req: Request, res: Response) => {
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

  // Delete user (admin only)
  app.delete("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
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
