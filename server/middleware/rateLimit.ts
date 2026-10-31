import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const windowMs = 60 * 1000; // 1 minute window
const maxRequests = 20; // 20 requests per minute
const clients = new Map<string, RateLimitRecord>();

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();

  const record = clients.get(ip);

  if (!record || now > record.resetAt) {
    clients.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  record.count += 1;

  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many login attempts. Please wait before retrying.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retryAfter,
    });
  }

  next();
}

// Reset rate limiter for testing
export function resetRateLimits() {
  clients.clear();
}
