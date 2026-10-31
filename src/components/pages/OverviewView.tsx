import React from 'react';
import { useApp } from '../../context/AppContext';
import { NetworkTopology } from '../network/NetworkTopology';
import {
  Radio,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  ArrowRight,
  Shield,
  Layers,
  Zap,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { messages, events, devices, setActiveTab, mode, currentUser } = useApp();

  const totalMessages = messages.length;
  const acknowledgedCount = messages.filter((m) => m.status === 'ACKNOWLEDGED').length;
  const criticalCount = messages.filter((m) => m.priority === 'CRITICAL').length;
  const activeNodes = devices.filter((d) => d.status === 'ONLINE').length;

  return (
    <div className="space-y-6">
      {/* Top Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              MISSION CONTROL OVERVIEW
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Drone-mounted SX1278 repeater bridging Team A (Base) and Team B (Search Sector).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.role !== 'viewer' && (
            <button
              onClick={() => setActiveTab('send-message')}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Compose Message</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('live-comm')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 font-mono transition-colors"
          >
            Live Monitor →
          </button>
        </div>
      </div>

      {/* Honest Derived Metrics Cards (Aggregates only from real database/state) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">TOTAL PACKETS</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{totalMessages}</div>
          <div className="text-[11px] text-slate-400 mt-1">Logged transmissions</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">ACK CONFIRMED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{acknowledgedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">End-to-end receipt verified</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">CRITICAL ALERTS</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{criticalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Emergency priority traffic</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">LORA NODES</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{activeNodes} / 3</div>
          <div className="text-[11px] text-slate-400 mt-1">Team A, Drone, Team B online</div>
        </div>
      </div>

      {/* Network Topology Component (Core Visualizer) */}
      <NetworkTopology />

      {/* Recent Activity Feed & Live Quick Send */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Events */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recent Transmission Events</h3>
            </div>
            <button
              onClick={() => setActiveTab('live-comm')}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Full Stream →
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {events.slice(0, 6).map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                        evt.type === 'ALERT'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : evt.type === 'RELAY'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : evt.type === 'ACK'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {evt.type}
                    </span>
                    {evt.isDemo && (
                      <span className="text-[9px] font-mono px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        DEMO
                      </span>
                    )}
                    <span className="font-mono text-slate-400 text-[10px]">{evt.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{evt.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Send Card */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-semibold text-slate-200">Quick Emergency Dispatch</h3>
              <span className="text-[10px] font-mono text-cyan-400">Drone Relay</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Trigger a verified priority message through the airborne relay to forward teams.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('send-message')}
                className="w-full text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-rose-400">VICTIM FOUND</div>
                  <div className="text-[11px] text-slate-400">Critical priority emergency alert</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </button>

              <button
                onClick={() => setActiveTab('send-message')}
                className="w-full text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-amber-400">SEND LOCATION</div>
                  <div className="text-[11px] text-slate-400">Urgent ground search coordination</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Payload limit: 220 bytes</span>
            <span className="text-emerald-400 font-semibold">Automatic ACK Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
