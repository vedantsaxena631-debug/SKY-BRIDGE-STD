import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';

const VALID_ROLES = ['admin', 'operator', 'viewer'];
const VALID_MODES = ['live', 'demo'];
const JWT_SECRET = process.env.JWT_SECRET || 'skybridge-insecure-secret-key-32chars!!';

function signAccessToken(user: any, mode: string) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
      team: user.team ?? null,
      mode,
    },
    JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '2h') as any }
  );
}

async function record(action: string, username: string, metadata: any, req: Request) {
  try {
    await AuditLog.create({
      action,
      actor: username || 'unknown',
      target: username || 'unknown',
      metadata,
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.get('user-agent'),
      timestamp: new Date(),
    });
  } catch (err: any) {
    // Auditing must never break login. Log and move on.
    console.error('[audit] failed to write entry:', err.message);
  }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, claimedRole, mode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (!VALID_ROLES.includes(claimedRole)) {
      return res.status(400).json({ error: 'Select a role to sign in.' });
    }
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({ error: 'Select Live or Demo mode to sign in.' });
    }

    const user = await User.findOne({ username: String(username).toLowerCase().trim() });

    // Run password compare even when user does not exist, against dummy hash,
    // so missing account and wrong password take identical time
    const credentialsValid = user
      ? await user.verifyPassword(password)
      : await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');

    const roleMatches = Boolean(user) && user.role === claimedRole;

    if (!credentialsValid || !roleMatches) {
      await record(
        'login_failed',
        username,
        {
          claimedRole,
          mode,
          reason: !credentialsValid ? 'bad_credentials' : 'role_mismatch',
        },
        req
      );
      // One generic message for all failures (unknown user, wrong password, wrong role tab)
      return res.status(401).json({ error: 'Invalid credentials for the selected role.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signAccessToken(user, mode);

    await record('login_success', user.username, { role: user.role, team: user.team, mode }, req);

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        team: user.team,
        name: user.name,
        callsign: user.callsign,
      },
      mode,
    });
  } catch (err) {
    next(err);
  }
};

// Guest access to Demo Mode only. Read-only, no credentials, short-lived.
export const guestDemo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.ALLOW_GUEST_DEMO === 'false') {
      return res.status(404).json({ error: 'Guest demo access is disabled.' });
    }
    const token = jwt.sign(
      {
        sub: 'guest',
        username: 'guest',
        role: 'viewer',
        team: null,
        mode: 'demo',
        guest: true,
      },
      JWT_SECRET,
      { expiresIn: '30m' }
    );
    await record('guest_demo_started', 'guest', { mode: 'demo' }, req);
    return res.json({
      token,
      user: { id: 'guest', username: 'guest', role: 'viewer', team: null, name: 'Guest Observer', callsign: 'GUEST' },
      mode: 'demo',
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role,
      team: req.user.team,
    },
    mode: req.user.mode,
  });
};

export const logout = async (req: Request, res: Response) => {
  if (req.user) {
    await record('logout', req.user.username, { role: req.user.role, mode: req.user.mode }, req);
  }
  res.json({ ok: true });
};
