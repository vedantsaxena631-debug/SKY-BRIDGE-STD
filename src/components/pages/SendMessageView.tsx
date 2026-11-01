import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PREDEFINED_MESSAGES } from '../../data/initialData';
import { MessagePriority, NodeId } from '../../types';
import {
  Send,
  Radio,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Lock,
  Info,
} from 'lucide-react';

const MAX_PAYLOAD_BYTES = 179; // Firmware stores the payload in a 180-byte C buffer including the terminator

export const SendMessageView: React.FC = () => {
  const auth = useAuth();
  const { sendMessage, sendTestPing, currentUser, mode, activeTransmission } = useApp();

  const operatorTeam = auth.user?.team || currentUser.team || 'A';
  const defaultFrom: NodeId = operatorTeam === 'B' ? 'TEAM_B' : 'TEAM_A';
  const defaultTo: NodeId = operatorTeam === 'B' ? 'TEAM_A' : 'TEAM_B';

  const [from, setFrom] = useState<NodeId>(defaultFrom);
  const [to, setTo] = useState<NodeId>(defaultTo);
  const [payload, setPayload] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('ROUTINE');
  const [isSending, setIsSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user?.role === 'operator') {
      const lockedFrom: NodeId = auth.user.team === 'B' ? 'TEAM_B' : 'TEAM_A';
      const lockedTo: NodeId = auth.user.team === 'B' ? 'TEAM_A' : 'TEAM_B';
      setFrom(lockedFrom);
      setTo(lockedTo);
    }
  }, [auth.user?.role, auth.user?.team]);

  // Compute UTF-8 byte count
  const byteLength = new TextEncoder().encode(payload).length;
  const isOverLimit = byteLength > MAX_PAYLOAD_BYTES;

  const handleSelectTemplate = (msg: string) => {
    setPayload(msg);
    if (msg.includes('VICTIM') || msg.includes('HELP') || msg.includes('CRITICAL')) {
      setPriority('CRITICAL');
    } else if (msg.includes('LOCATION') || msg.includes('SECTOR')) {
      setPriority('URGENT');
    } else {
      setPriority('ROUTINE');
    }
  };

  const handleTestPing = async (fromNode: NodeId, toNode: NodeId) => {
    if (isSending) return;
    setIsSending(true);
    setStatusFeedback('Dispatching diagnostic LoRa PING...');
    setErrorMessage(null);

    try {
      await sendTestPing(fromNode, toNode);
      setStatusFeedback('Diagnostic PING acknowledged by drone relay.');
      setTimeout(() => {
        setIsSending(false);
        setStatusFeedback(null);
      }, 3000);
    } catch (err: any) {
      setIsSending(false);
      const msg = String(err?.message || '');
      if (msg.includes('405') || msg.toLowerCase().includes('method not allowed')) {
        setErrorMessage(
          'Live Server Notice (405): Static web servers (such as VS Code Live Server or static CDNs) do not accept HTTP POST requests. To connect physical LoRa hardware, start the full-stack server using "npm run dev" or "npm start" on port 3000, or switch to Demo Mode in the top bar to test the full relay workflow.'
        );
      } else {
        setErrorMessage(err.message || 'Diagnostic ping failed.');
      }
      setStatusFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim() || isOverLimit || isSending) return;

    if (auth.user?.role === 'viewer') {
      setErrorMessage('Viewer accounts have read-only privileges. Transmissions are disabled.');
      return;
    }

    if (auth.user?.role === 'admin') {
      setErrorMessage('Admin oversight role: Admins may dispatch diagnostic PINGs, but cannot originate team field messages.');
      return;
    }

    setIsSending(true);
    setStatusFeedback('Encrypting and buffering packet to LoRa bridge...');
    setErrorMessage(null);

    try {
      await sendMessage(from, to, payload.trim(), priority, false);
      setStatusFeedback('Transmitted to Drone Relay. Awaiting store-and-forward ACK...');
      setPayload('');
      setTimeout(() => {
        setIsSending(false);
        setStatusFeedback(null);
      }, 3500);
    } catch (err: any) {
      setIsSending(false);
      const msg = String(err?.message || '');
      if (msg.includes('405') || msg.toLowerCase().includes('method not allowed')) {
        setErrorMessage(
          'Live Server Notice (405): Static web server rejected HTTP POST. To transmit packets to real hardware serial bridges, run the full-stack server ("npm run dev" on port 3000). Switch to Demo Mode to test full store-and-forward drone telemetry.'
        );
      } else {
        setErrorMessage(err.message || 'Transmission error.');
      }
      setStatusFeedback(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              SEND EMERGENCY MESSAGE
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch urgent communications through the airborne drone relay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTestPing(from, to)}
            disabled={auth.user?.role === 'viewer' || isSending}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Send Self-Test Ping</span>
          </button>
        </div>
      </div>

      {/* Role Notice Banners */}
      {auth.user?.role === 'viewer' && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Viewer Account (Read-Only):</span> You have observation access to real-time telemetry and incoming message feeds. Message origination is restricted to authenticated ground operators.
          </div>
        </div>
      )}

      {auth.user?.role === 'admin' && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Administrative Oversight:</span> Per SkyBridge security architecture, Admin accounts oversee network state and may dispatch diagnostic PINGs, but cannot inject team traffic as Team A or Team B.
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleTestPing('TEAM_A', 'TEAM_B')}
            disabled={isSending}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded font-mono text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
          >
            Dispatch Admin PING
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center gap-3 text-xs text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Source and Destination Routing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
                Origin Station (FROM)
              </label>
              {auth.user?.role === 'operator' ? (
                <div className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg p-3 text-sm text-slate-200 font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-cyan-300">
                      TEAM {auth.user.team} — Ground Base {auth.user.team === 'A' ? 'Alpha' : 'Bravo'}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 uppercase font-semibold">
                    Token Locked
                  </span>
                </div>
              ) : (
                <div className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-400 font-mono">
                  Origin disabled for {auth.user?.role || currentUser.role}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
                Destination Station (TO)
              </label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 font-mono flex items-center justify-between">
                <span>
                  TEAM {to === 'TEAM_A' ? 'A' : 'B'} — {to === 'TEAM_A' ? 'Ground Base Alpha' : 'Search Extraction Bravo'}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">Airborne Relay</span>
              </div>
            </div>
          </div>

          {/* Predefined Emergency Templates */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2 flex items-center justify-between">
              <span>Standard Emergency Templates</span>
              <span className="text-[11px] text-slate-500 lowercase font-normal">Click to insert</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_MESSAGES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  disabled={auth.user?.role === 'viewer' || auth.user?.role === 'admin'}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono transition-all disabled:opacity-40"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message Textarea & Live Byte Counter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono font-semibold text-slate-300 uppercase">
                Custom Message
              </label>
              <div
                className={`text-xs font-mono ${
                  isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-400'
                }`}
              >
                {byteLength} / {MAX_PAYLOAD_BYTES} bytes
                {isOverLimit && ' (Limit exceeded)'}
              </div>
            </div>

            <textarea
              rows={4}
              value={payload}
              disabled={auth.user?.role === 'viewer' || auth.user?.role === 'admin'}
              onChange={(e) => setPayload(e.target.value)}
              placeholder={
                auth.user?.role === 'viewer'
                  ? 'Viewer account: transmission disabled.'
                  : auth.user?.role === 'admin'
                  ? 'Admin account: oversight role. Use diagnostic PING button.'
                  : 'Enter tactical message payload to send across drone relay...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
              Priority Classification
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['ROUTINE', 'URGENT', 'CRITICAL'] as MessagePriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={auth.user?.role === 'viewer' || auth.user?.role === 'admin'}
                  onClick={() => setPriority(p)}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono font-semibold transition-all ${
                    priority === p
                      ? p === 'CRITICAL'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : p === 'URGENT'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  } disabled:opacity-50`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Status Feedback */}
          {statusFeedback && (
            <div className="p-3 bg-cyan-950/40 border border-cyan-600/40 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2 animate-pulse">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{statusFeedback}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs font-mono text-slate-500">
              Sender: <span className="text-slate-300 font-semibold">{currentUser.name}</span> ({currentUser.role.toUpperCase()})
            </div>

            <button
              type="submit"
              disabled={
                !payload.trim() ||
                isOverLimit ||
                isSending ||
                auth.user?.role === 'viewer' ||
                auth.user?.role === 'admin'
              }
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'TRANSMITTING VIA RELAY...' : 'TRANSMIT VIA DRONE RELAY'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
