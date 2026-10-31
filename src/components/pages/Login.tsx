import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, AlertCircle, RefreshCw, Radio, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { id: 'admin', label: 'Admin', hint: 'Devices, settings and audit log.' },
  { id: 'operator', label: 'Operator', hint: 'Sends messages for your own team only.' },
  { id: 'viewer', label: 'Viewer', hint: 'Read-only. Cannot send messages.' },
];

interface LoginProps {
  onSuccess?: () => void;
  onOpenLanding?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onOpenLanding }) => {
  const { login, startGuestDemo, preselectedMode } = useAuth();

  const [mode, setMode] = useState<'live' | 'demo'>(preselectedMode || 'live');
  const [role, setRole] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [username, setUsername] = useState('team-a');
  const [password, setPassword] = useState('teama123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const errorRef = useRef<HTMLDivElement>(null);

  // Sync preselected mode if it changes
  useEffect(() => {
    if (preselectedMode) {
      setMode(preselectedMode);
    }
  }, [preselectedMode]);

  // Screen reader focus on error
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'Enter your username.';
    if (!password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ username: username.trim(), password, claimedRole: role, mode });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(
        err.code === 'NETWORK'
          ? 'Cannot reach the SkyBridge server. Check that the backend is running.'
          : err.message || 'Login failed.'
      );
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuestDemo() {
    setError(null);
    setSubmitting(true);
    try {
      await startGuestDemo();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not start guest demo.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleQuickFill = (u: string, p: string, r: 'admin' | 'operator' | 'viewer') => {
    setUsername(u);
    setPassword(p);
    setRole(r);
    setError(null);
  };

  return (
    <div
      id="skybridge-login-screen"
      className="min-h-screen flex items-center justify-center bg-[#070A0E] text-slate-100 font-sans p-4 sm:p-6 md:p-10 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-md bg-[#0C1017]/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <form onSubmit={handleSubmit} noValidate className="w-full py-2">
          <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-slate-800/80">
            <SkyBridgeMark />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SkyBridge <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">v3.0</span>
              </h1>
              <p className="text-xs text-slate-400">
                Autonomous LoRa Drone-Relay Mission Communication Network
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">Sign In to SkyBridge</h2>
            <p className="text-xs text-slate-400">
              Select your session mode and the authoritative role your credentials possess.
            </p>
          </div>

          {onOpenLanding && (
            <div className="mb-6 p-3 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">First time exploring SkyBridge?</p>
                  <p className="text-[11px] text-slate-400">Scroll through the Montfort-style drone relay story.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLanding}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-600/40 transition-colors shrink-0 cursor-pointer"
              >
                Watch Story →
              </button>
            </div>
          )}

          {/* mode selection ------------------------------------------------------------ */}
          <fieldset className="mb-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              1. Session Mode
            </legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-3">
              {(['live', 'demo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  id={`mode-radio-${m}`}
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={[
                    'rounded-xl border p-3.5 text-left transition-all duration-150 relative cursor-pointer',
                    mode === m
                      ? m === 'demo'
                        ? 'border-purple-500 bg-purple-950/30 ring-1 ring-purple-500/50'
                        : 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/50'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${mode === m ? (m === 'demo' ? 'text-purple-300' : 'text-emerald-300') : 'text-slate-300'}`}>
                      {m === 'live' ? 'Live Mode' : 'Demo Mode'}
                    </span>
                    {mode === m && (
                      <span className={`w-2 h-2 rounded-full ${m === 'demo' ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                    )}
                  </div>
                  <span className="block text-xs text-slate-400 mt-1">
                    {m === 'live' ? 'Connected Hardware' : 'Isolated Simulator'}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-2.5 text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              {mode === 'demo'
                ? 'Everything you see will be simulated and labelled Demo. Nothing touches physical radios.'
                : 'Connect to ground base hardware nodes (ESP32/LoRa) for live tactical operations.'}
            </p>
          </fieldset>

          {/* role selection ------------------------------------------------------------ */}
          <fieldset className="mb-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              2. Claimed Account Role
            </legend>
            <div role="radiogroup" className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 gap-1">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  id={`role-btn-${r.id}`}
                  aria-checked={role === r.id}
                  onClick={() => setRole(r.id as any)}
                  className={[
                    'flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer text-center',
                    role === r.id
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {ROLES.find((r) => r.id === role)?.hint}
            </p>
          </fieldset>

          {/* Quick Fill Preset Buttons for fast evaluation */}
          <div className="mb-5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              Quick fill credentials:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('team-a', 'teama123', 'operator')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700"
              >
                team-a (Operator A)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('team-b', 'teamb123', 'operator')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-amber-300 border border-slate-700"
              >
                team-b (Operator B)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123', 'admin')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-rose-300 border border-slate-700"
              >
                admin (Admin)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('observer', 'viewer123', 'viewer')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700"
              >
                observer (Viewer)
              </button>
            </div>
          </div>

          {/* credentials ----------------------------------------------------- */}
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={submitting}
                className={[
                  'w-full rounded-lg border bg-[#0F141E] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 disabled:opacity-60',
                  fieldErrors.username ? 'border-rose-500' : 'border-slate-800',
                ].join(' ')}
              />
              {fieldErrors.username && <p className="mt-1 text-xs text-rose-400">{fieldErrors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                  className={[
                    'w-full rounded-lg border bg-[#0F141E] px-3.5 py-2.5 pr-11 text-sm text-slate-100 placeholder-slate-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 disabled:opacity-60',
                    fieldErrors.password ? 'border-rose-500' : 'border-slate-800',
                  ].join(' ')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-rose-400">{fieldErrors.password}</p>}
            </div>
          </div>

          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3.5 py-3 text-xs text-rose-300"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            id="login-submit-btn"
            className={[
              'w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all cursor-pointer shadow-md disabled:opacity-60',
              mode === 'demo'
                ? 'bg-purple-600 hover:bg-purple-500 focus:ring-2 focus:ring-purple-400'
                : 'bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-400',
            ].join(' ')}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Authenticating Credentials...
              </span>
            ) : (
              `Sign In to ${mode === 'demo' ? 'Demo' : 'Live'} Mode`
            )}
          </button>

          <button
            type="button"
            onClick={handleGuestDemo}
            disabled={submitting}
            id="guest-demo-btn"
            className="mt-4 w-full text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200 disabled:opacity-60 cursor-pointer"
          >
            Explore the demo without signing in (Guest Viewer)
          </button>
        </form>
      </main>
    </div>
  );
};

function SkyBridgeMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect width="34" height="34" rx="8" fill="#10B981" />
      <path d="M8 22c0-5.5 4-9 9-9s9 3.5 9 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="22" r="2.4" fill="white" />
      <circle cx="26" cy="22" r="2.4" fill="white" />
      <circle cx="17" cy="11" r="2.8" fill="white" />
    </svg>
  );
}

export default Login;
