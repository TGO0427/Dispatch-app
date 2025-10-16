import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "24h";

// Demo users - in production, use database
const DEMO_USERS = [
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

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user
    const user = DEMO_USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// Verify token endpoint
router.get("/verify", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      email: string;
      role: string;
    };

    res.json({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
});

// Logout endpoint
router.post("/logout", async (req: Request, res: Response) => {
  // With JWT, logout is primarily handled client-side by removing the token
  // This endpoint can be used for logging/auditing purposes
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
