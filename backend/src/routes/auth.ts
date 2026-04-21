import { Router, Request, Response } from "express";

const router = Router();

// These backend auth routes are deprecated — the primary API runs on Vercel.
// Kept as stubs so existing clients get a clear 501 instead of a 404.

router.post("/login", async (_req: Request, res: Response) => {
  return res.status(501).json({
    success: false,
    message: "This endpoint is deprecated. Use the primary API.",
  });
});

router.get("/verify", async (_req: Request, res: Response) => {
  return res.status(501).json({
    success: false,
    message: "This endpoint is deprecated. Use the primary API.",
  });
});

router.post("/logout", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
