import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Radio,
  Zap,
  Filter,
  ArrowRight,
  Shield,
  Layers,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { TransmissionProgressStepper } from '../messaging/TransmissionProgressStepper';

export const LiveCommView: React.FC = () => {
  const { events, sendTestPing, activeTransmission, currentUser, mode, theme } = useApp();
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'TEST' | 'RELAY'>('ALL');
  const [isPinging, setIsPinging] = useState(false);

  const isLight = theme === 'light';

  const handleTestPing = async () => {
    setIsPinging(true);
    try {
      await sendTestPing();
    } catch (err) {
      console.warn('[LiveCommView] Test ping handled:', err);
    } finally {
      setTimeout(() => setIsPinging(false), 800);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === 'CRITICAL') return e.priority === 'CRITICAL' || e.type === 'ALERT';
    if (filter === 'TEST') return e.message.includes('PING') || e.message.includes('diagnostic');
    if (filter === 'RELAY') return e.type === 'RELAY' || e.type === 'ACK';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl border transition-colors ${
          isLight
            ? 'bg-white border-[#DDE3EA] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]'
            : 'bg-[#12171F] border-[#232B36]'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h1
              className={`text-xl font-bold font-mono tracking-tight ${
                isLight ? 'text-[#0B1220]' : 'text-slate-100'
              }`}
            >
              LIVE COMMUNICATION STREAM
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold">
              CONNECTED
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Real-time communications between field teams and drone relay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Send Test Ping Action */}
          <button
            id="live-comm-test-ping-btn"
            onClick={handleTestPing}
            disabled={isPinging || currentUser.role === 'viewer'}
            className="px-3.5 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 font-mono text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Exercise full path with isolated PING packet"
          >
            <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Send Test Ping</span>
          </button>
        </div>
      </div>

      {/* Active Transmission Progress Stepper (Section 4.6) */}
      {activeTransmission && (
        <TransmissionProgressStepper message={activeTransmission} />
      )}

      {/* Filter Tabs */}
      <div
        className={`flex items-center gap-2 border-b pb-3 text-xs ${
          isLight ? 'border-[#DDE3EA]' : 'border-slate-800'
        }`}
      >
        <span
          className={`font-mono flex items-center gap-1 mr-2 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>
        {(['ALL', 'CRITICAL', 'TEST', 'RELAY'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg font-mono transition-colors ${
              filter === f
                ? isLight
                  ? 'bg-slate-200 text-[#0B1220] font-bold shadow-sm'
                  : 'bg-slate-800 text-cyan-300 border border-cyan-500/30 font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {f === 'ALL'
              ? 'All Stream'
              : f === 'CRITICAL'
              ? 'Critical Alerts'
              : f === 'TEST'
              ? 'Test Pings'
              : 'Relays & ACKs'}
          </button>
        ))}
      </div>

      {/* Hop By Hop Terminal Feed */}
      <div
        className={`rounded-xl border p-4 font-mono text-xs shadow-lg transition-colors ${
          isLight ? 'bg-white border-[#DDE3EA]' : 'bg-[#0B0F14] border-[#232B36]'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-3 border-b text-[11px] ${
            isLight ? 'border-[#EDEFF2] text-slate-500' : 'border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-500" />
            <span className="font-bold">TIMESTAMP // HOP EVENT</span>
          </div>
          <span>RELAY TRACE</span>
        </div>

        <div
          className={`divide-y max-h-[500px] overflow-y-auto py-2 space-y-1 ${
            isLight ? 'divide-[#EDEFF2]' : 'divide-slate-900'
          }`}
        >
          {filteredEvents.length === 0 ? (
            <div className={`py-12 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              No transmission events matching filter.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isTest = evt.message.includes('PING') || evt.message.includes('diagnostic');
              return (
                <div
                  key={evt.id}
                  className={`py-2.5 px-2 rounded flex items-start justify-between gap-4 transition-colors ${
                    isLight ? 'hover:bg-[#F3F5F8]' : 'hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`font-semibold shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {evt.timestamp}
                    </span>

                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                        isTest
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                          : evt.type === 'ALERT'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 animate-pulse'
                          : evt.type === 'RELAY'
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                          : evt.type === 'ACK'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                          : isLight
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {isTest ? 'TEST' : evt.type}
                    </span>

                    {evt.isDemo && (
                      <span className="px-1 py-0.2 rounded text-[9px] bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0 font-bold">
                        DEMO
                      </span>
                    )}

                    <span
                      className={`font-sans text-xs truncate ${
                        isLight ? 'text-[#0B1220]' : 'text-slate-300'
                      }`}
                    >
                      {evt.message}
                    </span>
                  </div>

                  {evt.sourceNode && (
                    <span
                      className={`text-[10px] whitespace-nowrap px-2 py-0.5 rounded border shrink-0 ${
                        isLight
                          ? 'bg-[#F3F5F8] border-[#DDE3EA] text-slate-600'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      NODE: {evt.sourceNode}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className={`pt-3 border-t flex items-center justify-between text-[10px] ${
            isLight ? 'border-[#EDEFF2] text-slate-500' : 'border-slate-800/80 text-slate-400'
          }`}
        >
          <span>Live Communication Stream</span>
          <span>Automatic Delivery Acknowledgments</span>
        </div>
      </div>
    </div>
  );
};
