import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_EXPIRES_IN = "8h";

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

    // This backend route is deprecated — use the Vercel API endpoints instead
    return res.status(501).json({
      success: false,
      message: "This endpoint is deprecated. Use the primary API.",
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
