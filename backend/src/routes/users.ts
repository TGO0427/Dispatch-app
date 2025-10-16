import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// In-memory user store (in production, use database)
let users = [
  {
    id: "1",
    username: "admin",
    password: "admin123", // In production, use bcrypt hashed passwords
    email: "admin@dispatch.com",
    role: "admin",
  },
  {
    id: "2",
    username: "dispatcher",
    password: "dispatcher123",
    email: "dispatcher@dispatch.com",
    role: "dispatcher",
  },
  {
    id: "3",
    username: "manager",
    password: "manager123",
    email: "manager@dispatch.com",
    role: "manager",
  },
];

// Middleware to verify JWT token and extract user
const authenticateToken = (req: any, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req: any, res: Response, next: Function) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

// GET all users (admin only)
router.get("/", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Return users without passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    res.json(usersWithoutPasswords);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

// GET single user by ID (admin only)
router.get("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
});

// POST create new user (admin only)
router.post("/", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if username already exists
    if (users.find((u) => u.username === username)) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Check if email already exists
    if (users.find((u) => u.email === email)) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Validate role
    const validRoles = ["user", "dispatcher", "manager", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Generate new user ID
    const newId = (Math.max(...users.map((u) => parseInt(u.id))) + 1).toString();

    // Create new user
    const newUser = {
      id: newId,
      username,
      email,
      password, // In production, hash the password with bcrypt
      role,
    };

    users.push(newUser);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      success: true,
      user: userWithoutPassword,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
});

// PUT update user (admin only)
router.put("/:id", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, password, role } = req.body;

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validation
    if (!username || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and role are required",
      });
    }

    // Check if username already exists (excluding current user)
    if (users.find((u) => u.username === username && u.id !== id)) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Check if email already exists (excluding current user)
    if (users.find((u) => u.email === email && u.id !== id)) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Validate role
    const validRoles = ["user", "dispatcher", "manager", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Update user
    users[userIndex] = {
      ...users[userIndex],
      username,
      email,
      role,
      // Only update password if provided
      ...(password && { password }), // In production, hash the password with bcrypt
    };

    // Return user without password
    const { password: _, ...userWithoutPassword } = users[userIndex];
    res.json({
      success: true,
      user: userWithoutPassword,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
});

// DELETE user (admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove user
    users.splice(userIndex, 1);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

export default router;
