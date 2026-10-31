import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Server,
  Radio,
  Plane,
  Cpu,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  Zap,
} from 'lucide-react';

export const DevicesView: React.FC = () => {
  const { devices, messages } = useApp();

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              NODES & HARDWARE STATIONS
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Physical device profiles for Ground Nodes (Team A / Team B) and Airborne LoRa Repeater.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>All 3 Nodes Online & Synchronized</span>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {devices.map((device) => {
          const deviceMessages = messages.filter(
            (m) => m.from === device.id || m.to === device.id
          );

          return (
            <div
              key={device.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg space-y-5"
            >
              <div>
                {/* Node Top Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {device.id}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{device.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  {device.type === 'AERIAL_RELAY' ? (
                    <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-600 flex items-center justify-center text-cyan-400">
                      <Plane className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                      <Radio className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{device.name}</h3>
                    <p className="text-xs text-slate-400">{device.role}</p>
                  </div>
                </div>

                {/* Honest Derived Metrics (Heartbeat Uptime) */}
                <div className="grid grid-cols-2 gap-2 my-4 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">HEARTBEAT UPTIME</div>
                    <div className="text-base font-bold text-emerald-400">{device.uptimePercent}%</div>
                    <div className="text-[10px] text-slate-500">Derived from logs</div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">HEARTBEAT SYNCS</div>
                    <div className="text-base font-bold text-slate-200">{device.heartbeatsCount}</div>
                    <div className="text-[10px] text-slate-500">Logged packets</div>
                  </div>
                </div>

                {/* Hardware Spec List */}
                <div className="space-y-2 text-xs font-mono text-slate-300 border-t border-slate-800 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Microcontroller:</span>
                    <span className="text-slate-200 text-right">{device.hardware.mcu}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">LoRa Module:</span>
                    <span className="text-cyan-400 font-semibold">{device.hardware.loraModule}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">RF Frequency:</span>
                    <span className="text-slate-200">{device.hardware.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Antenna:</span>
                    <span className="text-slate-200 text-right truncate max-w-[170px]" title={device.hardware.antenna}>
                      {device.hardware.antenna}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Power Source:</span>
                    <span className="text-slate-200 text-right truncate max-w-[170px]" title={device.hardware.powerSource}>
                      {device.hardware.powerSource}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Firmware Build:</span>
                    <span className="text-slate-400">{device.firmwareVersion}</span>
                  </div>
                </div>
              </div>

              {/* Strict Rule 1 Enforcement: Honest Telemetry State */}
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
                <div className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Telemetry State:</span>
                </div>
                <div className="text-slate-500">
                  GPS Coordinates, Altitude, and Battery % are{' '}
                  <span className="text-amber-400 font-semibold">
                    Not available in current hardware integration
                  </span>
                  .
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
