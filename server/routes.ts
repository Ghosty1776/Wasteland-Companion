import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";
import { insertUserSchema, insertDeviceSchema, insertScriptSchema, insertNoteSchema } from "@shared/schema";
import { z } from "zod";
import { getSystemStatus } from "./systemMetrics";
import { startDeviceMonitor } from "./deviceMonitor";

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

  // ============ DEVICE MANAGEMENT ROUTES ============

  // Get all devices (authenticated users)
  app.get("/api/devices", requireAuth, async (req: Request, res: Response) => {
    try {
      const devices = await storage.getAllDevices();
      res.json(devices);
    } catch (error) {
      console.error("Get devices error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single device (authenticated users)
  app.get("/api/devices/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const device = await storage.getDevice(id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      console.error("Get device error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create device (admin only)
  app.post("/api/devices", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = insertDeviceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const device = await storage.createDevice(parseResult.data);
      res.json({ success: true, device });
    } catch (error) {
      console.error("Create device error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update device (admin only)
  app.patch("/api/devices/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Allow partial updates
      const partialSchema = insertDeviceSchema.partial();
      const parseResult = partialSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const existingDevice = await storage.getDevice(id);
      if (!existingDevice) {
        return res.status(404).json({ error: "Device not found" });
      }

      const device = await storage.updateDevice(id, parseResult.data);
      res.json({ success: true, device });
    } catch (error) {
      console.error("Update device error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete device (admin only)
  app.delete("/api/devices/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existingDevice = await storage.getDevice(id);
      if (!existingDevice) {
        return res.status(404).json({ error: "Device not found" });
      }

      const deleted = await storage.deleteDevice(id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete device" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete device error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ SCRIPT MANAGEMENT ROUTES ============

  // Get all scripts (authenticated users)
  app.get("/api/scripts", requireAuth, async (req: Request, res: Response) => {
    try {
      const scripts = await storage.getAllScripts();
      res.json(scripts);
    } catch (error) {
      console.error("Get scripts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single script (authenticated users)
  app.get("/api/scripts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const script = await storage.getScript(id);
      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }
      res.json(script);
    } catch (error) {
      console.error("Get script error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create script (admin only)
  app.post("/api/scripts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = insertScriptSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const script = await storage.createScript(parseResult.data);
      res.json({ success: true, script });
    } catch (error) {
      console.error("Create script error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update script (admin only)
  app.patch("/api/scripts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const partialSchema = insertScriptSchema.partial();
      const parseResult = partialSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const existingScript = await storage.getScript(id);
      if (!existingScript) {
        return res.status(404).json({ error: "Script not found" });
      }

      const script = await storage.updateScript(id, parseResult.data);
      res.json({ success: true, script });
    } catch (error) {
      console.error("Update script error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete script (admin only)
  app.delete("/api/scripts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existingScript = await storage.getScript(id);
      if (!existingScript) {
        return res.status(404).json({ error: "Script not found" });
      }

      const deleted = await storage.deleteScript(id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete script" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete script error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ NOTES MANAGEMENT ROUTES ============

  // Get all notes (authenticated users)
  app.get("/api/notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const notes = await storage.getAllNotes();
      res.json(notes);
    } catch (error) {
      console.error("Get notes error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single note (authenticated users)
  app.get("/api/notes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const note = await storage.getNote(id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Get note error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create note (admin only)
  app.post("/api/notes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = insertNoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const note = await storage.createNote(parseResult.data);
      res.json({ success: true, note });
    } catch (error) {
      console.error("Create note error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update note (admin only)
  app.patch("/api/notes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const partialSchema = insertNoteSchema.partial();
      const parseResult = partialSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const existingNote = await storage.getNote(id);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      const note = await storage.updateNote(id, parseResult.data);
      res.json({ success: true, note });
    } catch (error) {
      console.error("Update note error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete note (admin only)
  app.delete("/api/notes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existingNote = await storage.getNote(id);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      const deleted = await storage.deleteNote(id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete note" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete note error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start device monitor
  startDeviceMonitor();

  return httpServer;
}
