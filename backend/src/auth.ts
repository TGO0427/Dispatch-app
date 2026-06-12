import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  username: string;
  email: string;
  role: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    jwt.verify(authHeader.slice(7), secret) as JwtPayload;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}
