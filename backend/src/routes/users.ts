import { Router, Response } from "express";

const router = Router();

// All user management is handled by the Vercel API endpoints.
// These legacy Express routes are deprecated stubs.
const deprecated = (_req: unknown, res: Response) => {
  return res.status(501).json({
    success: false,
    message: "This endpoint is deprecated. Use the primary API.",
  });
};

router.get("/", deprecated);
router.get("/:id", deprecated);
router.post("/", deprecated);
router.put("/:id", deprecated);
router.delete("/:id", deprecated);

export default router;
