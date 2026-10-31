import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Printer,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export const SitrepView: React.FC = () => {
  const { messages, events, mode, currentUser } = useApp();
  const [reportDate] = useState(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }));

  const handlePrint = () => {
    window.print();
  };

  const criticalMessages = messages.filter((m) => m.priority === 'CRITICAL');
  const ackedMessages = messages.filter((m) => m.status === 'ACKNOWLEDGED');
  const victimReports = messages.filter((m) => m.payload.includes('VICTIM'));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Action Header (hidden in print) */}
      <div className="no-print bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              SITUATION REPORT (SITREP) GENERATOR
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official operational timeline compiled from verifiable LoRa transmission logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable SITREP Document */}
      <div className="bg-slate-900/90 print:bg-white text-slate-100 print:text-black rounded-2xl border border-slate-800 print:border-slate-300 p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Prominent DEMO REPORT Watermark if Demo Mode (Section 21 mandate) */}
        {mode === 'DEMO' && (
          <div className="border-2 border-purple-500/40 print:border-purple-800 bg-purple-950/20 print:bg-purple-50 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-purple-300 print:text-purple-900 font-bold">
              <span className="px-2 py-0.5 rounded bg-purple-500 text-slate-950 font-bold">
                DEMO REPORT
              </span>
              <span>SIMULATED EXERCISE INCIDENT LOG</span>
            </div>
            <span className="text-purple-400 print:text-purple-700 text-[11px]">
              Not for actual emergency dispatch
            </span>
          </div>
        )}

        {/* Document Header */}
        <div className="border-b border-slate-800 print:border-slate-300 pb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-cyan-400 print:text-cyan-800 font-bold tracking-wider">
              OPERATIONAL SITUATION REPORT // SKYBRIDGE-SITREP-01
            </div>
            <h2 className="text-2xl font-bold font-mono tracking-tight text-slate-100 print:text-black mt-1">
              EMERGENCY NETWORK INCIDENT LOG
            </h2>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Autonomous Drone LoRa Relay Link — Forward Operating Sector
            </div>
          </div>

          <div className="text-right text-xs font-mono text-slate-400 print:text-slate-600 space-y-0.5">
            <div><strong>Date:</strong> {reportDate}</div>
            <div><strong>Compiler:</strong> {currentUser.name} ({currentUser.callsign})</div>
            <div><strong>Classification:</strong> OPERATIONAL TACTICAL</div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Logged Packets</div>
            <div className="text-xl font-bold font-mono text-slate-100 print:text-black">{messages.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[10px] font-mono text-slate-400 uppercase">ACK Reliability</div>
            <div className="text-xl font-bold font-mono text-emerald-400 print:text-emerald-700">
              {messages.length > 0 ? Math.round((ackedMessages.length / messages.length) * 100) : 100}%
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Critical Alerts</div>
            <div className="text-xl font-bold font-mono text-rose-400 print:text-rose-700">{criticalMessages.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-200">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Victim Findings</div>
            <div className="text-xl font-bold font-mono text-cyan-400 print:text-cyan-700">{victimReports.length}</div>
          </div>
        </div>

        {/* Chronological Incident Timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black border-b border-slate-800 print:border-slate-300 pb-2">
            Chronological Tactical Transmissions
          </h3>

          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={m.id}
                className="p-3.5 rounded-lg bg-slate-950 print:bg-white border border-slate-800 print:border-slate-300 text-xs font-mono space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400 print:text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 print:text-black">
                      [{m.timestamp}]
                    </span>
                    <span className="text-cyan-400 print:text-cyan-700">
                      PKT #{m.msgID}
                    </span>
                    <span className="text-slate-300 print:text-slate-700">
                      {m.from} → {m.to}
                    </span>
                  </div>
                  <span
                    className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                      m.priority === 'CRITICAL'
                        ? 'bg-rose-950 print:bg-rose-100 text-rose-300 print:text-rose-900 border border-rose-800'
                        : m.priority === 'URGENT'
                        ? 'bg-amber-950 print:bg-amber-100 text-amber-300 print:text-amber-900 border border-amber-800'
                        : 'bg-slate-800 print:bg-slate-200 text-slate-300 print:text-slate-800'
                    }`}
                  >
                    {m.priority}
                  </span>
                </div>

                <div className="text-sm font-sans font-semibold text-slate-100 print:text-black pl-1">
                  "{m.payload}"
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600 pt-1 border-t border-slate-900 print:border-slate-200">
                  <span>Relay Hops: {m.relayCount} (Airborne SX1278)</span>
                  <span>Verification ACK: {m.ackReceivedAt || 'Confirmed'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certification Signoff */}
        <div className="pt-8 border-t border-slate-800 print:border-slate-300 grid grid-cols-2 gap-8 text-xs font-mono text-slate-400 print:text-slate-700">
          <div>
            <div className="border-b border-slate-700 print:border-slate-400 pb-8 mb-2">
              Command Signature / Officer in Charge
            </div>
            <div>Auth: {currentUser.name} // {currentUser.callsign}</div>
          </div>
          <div>
            <div className="border-b border-slate-700 print:border-slate-400 pb-8 mb-2">
              Communications Chief Signature
            </div>
            <div>SkyBridge Drone LoRa Gateway Authority</div>
          </div>
        </div>
      </div>
    </div>
  );
};
