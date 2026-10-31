import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'skybridge-insecure-secret-key-32chars!!';

export interface AuthSession {
  sub: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  team: 'A' | 'B' | null;
  mode: 'live' | 'demo';
  guest?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthSession;
      sessionMode: 'live' | 'demo';
      modeFilter: { isDemo: boolean };
      isDemo: boolean;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthSession;
    return next();
  } catch (err: any) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Session expired. Sign in again.' : 'Invalid session.',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this.' });
    }
    next();
  };
}

// Every data route uses this. It puts a filter on the request that all queries
// spread into their Mongoose filter, and it is the ONLY source of the isDemo
// value on writes. A live session literally cannot build a query that returns a
// demo record, and a demo session cannot write one a live session would see.
export function scopeToSessionMode(req: Request, res: Response, next: NextFunction) {
  const isDemo = req.user.mode === 'demo';
  req.sessionMode = req.user.mode;
  req.modeFilter = { isDemo };
  req.isDemo = isDemo;
  next();
}

// Who is allowed to send what.
//   viewer   - nothing
//   admin    - PING only (oversight role; does not originate team traffic)
//   operator - messages from its own team only
export function enforceSenderIdentity(req: Request, res: Response, next: NextFunction) {
  const { role, team } = req.user;
  const { from, to, type } = req.body;

  if (role === 'viewer') {
    return res.status(403).json({ error: 'Viewer accounts cannot send messages.' });
  }

  if (role === 'admin') {
    if (type !== 'PING') {
      return res.status(403).json({ error: 'Admin accounts send test pings only, not team messages.' });
    }
    return next();
  }

  if (role === 'operator') {
    if (from !== team) {
      return res.status(403).json({ error: `This account can only send as Team ${team}.` });
    }
    const counterpart = team === 'A' ? 'B' : 'A';
    if (to !== counterpart) {
      return res.status(403).json({ error: `Team ${team} can only address Team ${counterpart}.` });
    }
    return next();
  }

  return res.status(403).json({ error: 'Unrecognised account role.' });
}

// Socket token verification for handshake admission
export function verifySocketToken(socket: any, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required.'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET) as AuthSession;
    next();
  } catch (err) {
    next(new Error('Invalid session.'));
  }
}

// Dedicated authentication for the laptop hardware gateway.
export function requireGatewaySecret(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const configuredSecret = process.env.GATEWAY_SECRET || 'skybridge-gateway-secret-token-2026';
  const providedSecret = req.get('x-gateway-secret') || '';

  if (!providedSecret) {
    return res.status(401).json({
      error: 'Gateway authentication required.',
    });
  }

  const expected = Buffer.from(configuredSecret, 'utf8');
  const actual = Buffer.from(providedSecret, 'utf8');

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return res.status(401).json({
      error: 'Invalid gateway credentials.',
    });
  }

  next();
}
