import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  team: 'A' | 'B' | null;
  name?: string;
  callsign?: string;
}

export interface SessionData {
  token: string;
  user: AuthUser;
  mode: 'live' | 'demo';
  guest?: boolean;
}

export interface AuthContextType {
  session: SessionData | null;
  user: AuthUser | null;
  mode: 'live' | 'demo' | null;
  isDemo: boolean;
  isAuthenticated: boolean;
  restoring: boolean;
  login: (creds: { username: string; password: string; claimedRole: string; mode: string }) => Promise<SessionData>;
  logout: () => Promise<void>;
  startGuestDemo: () => Promise<SessionData>;
  canSend: boolean;
  sendsAsTeam: 'A' | 'B' | null;
  switchModeViaLogout: (newMode: 'live' | 'demo') => void;
  preselectedMode: 'live' | 'demo';
  setPreselectedMode: (mode: 'live' | 'demo') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_KEY = 'skybridge.session';

const PRESET_ACCOUNTS: Record<
  string,
  { role: 'admin' | 'operator' | 'viewer'; team: 'A' | 'B' | null; pass: string; name: string; callsign: string }
> = {
  admin: { role: 'admin', team: null, pass: 'admin123', name: 'Mission Director', callsign: 'SKY-COMMAND' },
  'team-a': { role: 'operator', team: 'A', pass: 'teama123', name: 'Alpha Field Unit', callsign: 'ALPHA-1' },
  'team-b': { role: 'operator', team: 'B', pass: 'teamb123', name: 'Bravo Base Station', callsign: 'BRAVO-BASE' },
  observer: { role: 'viewer', team: null, pass: 'viewer123', name: 'Flight Observer', callsign: 'OBSERVER-1' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [preselectedMode, setPreselectedMode] = useState<'live' | 'demo'>('live');

  // Restore an existing session on page load and verify it with the server
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setRestoring(false);
      return;
    }
    let parsed: SessionData;
    try {
      parsed = JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setRestoring(false);
      return;
    }

    api.setToken(parsed.token);
    api
      .get('/auth/me')
      .then((data: any) => {
        setSession({ ...parsed, user: data.user, mode: data.mode });
      })
      .catch((err: any) => {
        const isOfflineOrUnavailable =
          err?.code === 'NETWORK' ||
          err?.code === 'SERVER_UNAVAILABLE' ||
          err?.status === 404 ||
          err?.isServerUnavailable ||
          parsed.token?.startsWith('offline_') ||
          parsed.token?.startsWith('guest_') ||
          parsed.guest;

        if (isOfflineOrUnavailable) {
          setSession(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          api.setToken(null);
        }
      })
      .finally(() => setRestoring(false));
  }, []);

  const login = useCallback(
    async ({
      username,
      password,
      claimedRole,
      mode,
    }: {
      username: string;
      password: string;
      claimedRole: string;
      mode: string;
    }) => {
      const cleanUsername = username.trim().toLowerCase();
      try {
        const data = await api.post('/auth/login', { username: cleanUsername, password, claimedRole, mode });
        const next: SessionData = { token: data.token, user: data.user, mode: data.mode };
        api.setToken(data.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
        return next;
      } catch (err: any) {
        const isServerUnavailable =
          err.code === 'NETWORK' ||
          err.code === 'SERVER_UNAVAILABLE' ||
          err.status === 404 ||
          err.isServerUnavailable;

        // If the server answered with an authentic auth error and is NOT unavailable, throw it
        if (!isServerUnavailable && (err.status === 401 || err.status === 403 || err.status === 429 || err.status === 400)) {
          throw err;
        }

        // Server is unreachable (e.g. Vercel static deployment or backend starting up):
        // Fall back to client-side credential verification
        const preset = PRESET_ACCOUNTS[cleanUsername];
        if (preset) {
          if (preset.role !== claimedRole) {
            const roleErr: any = new Error(
              `Role mismatch: '${cleanUsername}' belongs to the '${preset.role.toUpperCase()}' role. Please select the '${preset.role}' tab.`
            );
            roleErr.status = 401;
            throw roleErr;
          }
          if (preset.pass !== password) {
            const passErr: any = new Error('Invalid username or password.');
            passErr.status = 401;
            throw passErr;
          }

          const offlineSession: SessionData = {
            token: `offline_token_${Date.now()}_${cleanUsername}`,
            user: {
              id: `usr_${cleanUsername}`,
              username: cleanUsername,
              role: preset.role,
              team: preset.team,
              name: preset.name,
              callsign: preset.callsign,
            },
            mode: (mode as any) || 'demo',
            guest: false,
          };
          api.setToken(offlineSession.token);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(offlineSession));
          setSession(offlineSession);
          return offlineSession;
        }

        throw err;
      }
    },
    []
  );

  const startGuestDemo = useCallback(async () => {
    try {
      const data = await api.post('/auth/guest-demo', {});
      const next: SessionData = { token: data.token, user: data.user, mode: 'demo', guest: true };
      api.setToken(data.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      return next;
    } catch {
      // Fallback for Vercel static deployment or unreachable backend
      const guestSession: SessionData = {
        token: `guest_token_${Date.now()}`,
        user: {
          id: 'usr_guest',
          username: 'observer',
          role: 'viewer',
          team: null,
          name: 'Guest Observer',
          callsign: 'OBSERVER-GUEST',
        },
        mode: 'demo',
        guest: true,
      };
      api.setToken(guestSession.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestSession));
      setSession(guestSession);
      return guestSession;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Signing out locally must work even if server is unreachable
    }
    localStorage.removeItem(STORAGE_KEY);
    api.setToken(null);
    setSession(null);
  }, []);

  const switchModeViaLogout = useCallback(
    (newMode: 'live' | 'demo') => {
      setPreselectedMode(newMode);
      logout();
    },
    [logout]
  );

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    mode: session?.mode ?? null,
    isDemo: session?.mode === 'demo',
    isAuthenticated: Boolean(session),
    restoring,
    login,
    logout,
    startGuestDemo,
    canSend: session?.user?.role === 'operator' || session?.user?.role === 'admin',
    sendsAsTeam: session?.user?.role === 'operator' ? session.user.team : null,
    switchModeViaLogout,
    preselectedMode,
    setPreselectedMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
