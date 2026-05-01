import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'fs_sid';
const SESSION_TTL = 60 * 60 * 24; // 24h in Redis
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30d

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  let sid = req.cookies?.[COOKIE_NAME];

  if (sid) {
    const cached = await redis.get(`session:${sid}`);
    if (cached) {
      await redis.expire(`session:${sid}`, SESSION_TTL);
      req.sessionId = sid;
      return next();
    }
    const existing = await prisma.session.findUnique({ where: { id: sid } });
    if (existing) {
      await redis.setex(`session:${sid}`, SESSION_TTL, JSON.stringify({ displayName: existing.displayName }));
      await prisma.session.update({ where: { id: sid }, data: { lastSeenAt: new Date() } });
      req.sessionId = sid;
      return next();
    }
  }

  sid = uuidv4();
  await prisma.session.create({ data: { id: sid } });
  await redis.setex(`session:${sid}`, SESSION_TTL, JSON.stringify({ displayName: null }));

  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  req.sessionId = sid;
  next();
}

export function ensureSession(req: Request, res: Response, next: NextFunction) {
  if (!req.sessionId) {
    return res.status(401).json({ error: 'No session' });
  }
  next();
}
