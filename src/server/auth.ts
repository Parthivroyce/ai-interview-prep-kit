import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getDbStore, UserDoc } from "./db";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
      };
    }
  }
}

const SESSION_COOKIE_NAME = "prepkit_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "interview_kit_default_secret_key_2026";

// In-memory or cache session map: token -> userId
const sessions = new Map<string, { userId: string; expiresAt: number }>();

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(token, { userId, expiresAt });
  return token;
}

export function invalidateSession(token: string): void {
  sessions.delete(token);
}

export function setSessionCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: "/",
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing session" });
    return;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
    return;
  }

  const db = await getDbStore();
  const user = await db.users.findById(session.userId);
  if (!user) {
    sessions.delete(token);
    res.status(401).json({ error: "Unauthorized: User not found" });
    return;
  }

  req.user = {
    id: user._id,
    email: user.email,
    name: user.name,
  };

  next();
}
