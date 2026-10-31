import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plane,
  Radio,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Activity,
  Info,
} from 'lucide-react';

export const DroneView: React.FC = () => {
  const { messages } = useApp();
  const relayedPackets = messages.filter((m) => m.relayCount > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              DRONE AIRBORNE RELAY STATUS
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitoring the airborne ESP32 + SX1278 repeater payload.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/60 px-3 py-1.5 rounded-lg border border-cyan-500/40">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>RELAY STATE: ACTIVE</span>
        </div>
      </div>

      {/* Critical System Warning Banner (Section 2 & 23 Ground Truth) */}
      <div className="bg-slate-900 border-l-4 border-cyan-500 p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">
              Payload & Flight Control Physical Separation
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              In the SkyBridge architecture, the communications payload (ESP32 + SX1278) is physically and logically decoupled from the drone flight systems. The ESP32 does not "fly" the drone. Flight piloting is executed manually via a FlySky FS-i6X 2.4GHz transmitter to an onboard flight controller. This dashboard exclusively monitors the communication repeater.
            </p>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Comms Payload vs Flight Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: LoRa Comms Payload Monitoring */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">Airborne Comms Payload</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              OPERATIONAL
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">MICROCONTROLLER</div>
              <div className="text-slate-200 font-semibold">ESP32-WROOM-32 (Dual Core 240MHz)</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">LORA TRANSCEIVER</div>
              <div className="text-cyan-400 font-semibold">Semtech SX1278 (Ra-02, 433 MHz)</div>
              <div className="text-[10px] text-slate-500">SPI Interface / SF7 / BW 125kHz</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">REPEATER ALGORITHM</div>
              <div className="text-slate-200 font-semibold">Store-and-Forward + msgID Loop Suppression</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">PAYLOAD POWER TAP</div>
              <div className="text-slate-200">5V UBEC Buck Converter from 3S LiPo PDB</div>
            </div>
          </div>

          <div className="p-3 bg-cyan-950/20 border border-cyan-900 rounded-lg text-xs font-mono text-cyan-300 flex items-center justify-between">
            <span>Total Relayed Packets:</span>
            <span className="text-base font-bold text-cyan-200">{relayedPackets.length}</span>
          </div>
        </div>

        {/* Right: Drone Flight Information (Section 24 Ground Truth) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-100">Flight System Context</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              MANUAL PILOTED
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-slate-500 text-[10px]">FLIGHT CONTROLLER</div>
                <div className="text-slate-200 font-semibold">F450 Quadcopter APM / Betaflight</div>
              </div>
              <span className="text-emerald-400 text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                Connected
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-slate-500 text-[10px]">RC PILOT LINK</div>
                <div className="text-slate-200 font-semibold">FlySky FS-i6X (2.4GHz AFHDS 2A)</div>
              </div>
              <span className="text-emerald-400 text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                Available
              </span>
            </div>

            {/* Strict Rule 1 Enforcement: Flight Telemetry */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Airborne Telemetry:</span>
                <span className="text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800">
                  Not Available
                </span>
              </div>
              <div className="space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>GPS Coordinates:</span>
                  <span className="text-amber-400/80 italic">Not available in current hardware</span>
                </div>
                <div className="flex justify-between">
                  <span>Altitude / Barometer:</span>
                  <span className="text-amber-400/80 italic">Not available in current hardware</span>
                </div>
                <div className="flex justify-between">
                  <span>Ground Speed & Heading:</span>
                  <span className="text-amber-400/80 italic">Not available in current hardware</span>
                </div>
                <div className="flex justify-between">
                  <span>Battery Telemetry %:</span>
                  <span className="text-amber-400/80 italic">Not available in current hardware</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Zero automated/motor controls in software. The pilot controls flight solely via the handheld radio transmitter.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
