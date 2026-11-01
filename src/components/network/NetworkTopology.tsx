import React from 'react';
import { useApp } from '../../context/AppContext';
import { Radio, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { useTopologyAnimation } from '../../hooks/useTopologyAnimation';
import { colorTokens, motionTokens } from '../../styles/tokens';
import type { DeviceNode } from '../../types';

const getNodeStatusPresentation = (status?: DeviceNode['status']) => {
  if (status === 'ONLINE') {
    return { label: 'ONLINE', textClass: 'text-emerald-500', dotClass: 'bg-emerald-500 animate-pulse' };
  }
  if (status === 'STANDBY') {
    return { label: 'STANDBY', textClass: 'text-amber-400', dotClass: 'bg-amber-400' };
  }
  if (status === 'OFFLINE') {
    return { label: 'OFFLINE', textClass: 'text-rose-400', dotClass: 'bg-rose-400' };
  }
  return { label: 'UNKNOWN', textClass: 'text-slate-500', dotClass: 'bg-slate-500' };
};

export const NetworkTopology: React.FC = () => {
  const { devices, activeTransmission, reducedMotion, mode, theme, sendTestPing, currentUser } = useApp();
  const { inFlightPackets, flashingNode, edgeHighlights } = useTopologyAnimation(
    activeTransmission,
    theme,
    reducedMotion
  );

  const teamA = devices.find((d) => d.id === 'TEAM_A');
  const drone = devices.find((d) => d.id === 'DRONE_RELAY');
  const teamB = devices.find((d) => d.id === 'TEAM_B');
  const teamAStatus = getNodeStatusPresentation(teamA?.status);
  const droneStatus = getNodeStatusPresentation(drone?.status);
  const teamBStatus = getNodeStatusPresentation(teamB?.status);
  const onlineNodeCount = [teamA, drone, teamB].filter((device) => device?.status === 'ONLINE').length;
  const allNodesOnline = onlineNodeCount === 3;

  const tokens = theme === 'dark' ? colorTokens.dark : colorTokens.light;
  const isLight = theme === 'light';

  return (
    <div
      id="network-topology-container"
      className={`rounded-xl border transition-colors duration-200 relative overflow-hidden ${
        isLight
          ? 'bg-white border-[#DDE3EA] shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] p-5'
          : 'bg-[#12171F] border-[#232B36] p-5 shadow-lg'
      }`}
    >
      {/* Header bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 pb-4 border-b mb-6 ${
          isLight ? 'border-[#EDEFF2]' : 'border-[#232B36]'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-500" />
            <h3
              className={`text-base font-semibold tracking-wide ${
                isLight ? 'text-[#0B1220]' : 'text-[#E8EBEF]'
              }`}
            >
              Logical Network Topology
            </h3>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/20 border border-cyan-500/40 text-cyan-500 font-bold">
              SX1278 433MHz LoRa Relay
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-[#6B7686]' : 'text-[#9AA4B2]'}`}>
            Pure logical topology. No GPS coordinates rendered (hardware telemetry is uninstrumented).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTransmission ? (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${
                activeTransmission.isDemo
                  ? 'bg-purple-950/20 border-purple-500/40 text-purple-400'
                  : 'bg-cyan-950/20 border-cyan-500/40 text-cyan-400'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="font-semibold">
                PKT #{activeTransmission.msgID}: {activeTransmission.status}
              </span>
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                ({activeTransmission.from} → {activeTransmission.to})
              </span>
              {activeTransmission.isDemo && (
                <span className="text-[9px] bg-purple-500 text-white font-bold px-1.5 py-0.2 rounded ml-1">
                  DEMO
                </span>
              )}
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 text-xs font-mono ${allNodesOnline ? 'text-emerald-500' : isLight ? 'text-[#6B7686]' : 'text-[#9AA4B2]'}`}
            >
              <span className={`w-2 h-2 rounded-full ${allNodesOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              <span>
                {mode === 'DEMO'
                  ? allNodesOnline
                    ? 'Carrier Standby — 433.000 MHz Clear (simulated)'
                    : `${onlineNodeCount} of 3 simulated nodes online`
                  : allNodesOnline
                  ? `${onlineNodeCount} of 3 nodes online — carrier quality not reported`
                  : `${onlineNodeCount} of 3 nodes online — awaiting live telemetry`}
              </span>
            </div>
          )}

          {currentUser.role !== 'viewer' && (
            <button
              onClick={() => {
                void sendTestPing().catch((error) => console.warn('[NetworkTopology] Test ping failed:', error));
              }}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 transition-colors flex items-center gap-1"
              title="Trigger diagnostic test ping across topology"
            >
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">Test Ping</span>
            </button>
          )}
        </div>
      </div>

      {/* Reduced Motion Static Accessibility View */}
      {reducedMotion ? (
        <div className="space-y-3 py-2" aria-label="Network topology status list">
          <div
            className={`p-3 rounded-lg border flex justify-between items-center text-sm ${
              flashingNode?.nodeId === 'TEAM_A'
                ? 'border-cyan-500 bg-cyan-500/10'
                : isLight
                ? 'bg-[#F3F5F8] border-[#DDE3EA]'
                : 'bg-[#171D27] border-[#232B36]'
            }`}
          >
            <div>
              <span className={`font-semibold ${isLight ? 'text-[#0B1220]' : 'text-slate-200'}`}>
                Team A (Ground Node 01)
              </span>
              <p className="text-xs text-slate-500 font-mono">ESP32 + SX1278 (VSPI)</p>
            </div>
            <span className={`${teamAStatus.textClass} font-mono text-xs font-bold`}>STATUS: {teamAStatus.label}</span>
          </div>

          <div
            className={`p-3 rounded-lg border flex justify-between items-center text-sm ${
              flashingNode?.nodeId === 'DRONE_RELAY'
                ? 'border-cyan-500 bg-cyan-500/10'
                : isLight
                ? 'bg-[#F3F5F8] border-[#DDE3EA]'
                : 'bg-[#171D27] border-[#232B36]'
            }`}
          >
            <div>
              <span className={`font-semibold ${isLight ? 'text-[#0B1220]' : 'text-cyan-300'}`}>
                Drone Relay (Airborne Store-and-Forward)
              </span>
              <p className="text-xs text-slate-500 font-mono">Decoupled Comms Payload</p>
            </div>
            <span className={`${droneStatus.textClass} font-mono text-xs font-bold`}>STATUS: {droneStatus.label}</span>
          </div>

          <div
            className={`p-3 rounded-lg border flex justify-between items-center text-sm ${
              flashingNode?.nodeId === 'TEAM_B'
                ? 'border-cyan-500 bg-cyan-500/10'
                : isLight
                ? 'bg-[#F3F5F8] border-[#DDE3EA]'
                : 'bg-[#171D27] border-[#232B36]'
            }`}
          >
            <div>
              <span className={`font-semibold ${isLight ? 'text-[#0B1220]' : 'text-slate-200'}`}>
                Team B (Ground Node 02)
              </span>
              <p className="text-xs text-slate-500 font-mono">ESP32 + SX1278 (VSPI)</p>
            </div>
            <span className={`${teamBStatus.textClass} font-mono text-xs font-bold`}>STATUS: {teamBStatus.label}</span>
          </div>
        </div>
      ) : (
        /* Visual Topology with Curved SVG Paths and Packet Animations */
        <div className="relative py-6 px-2 sm:px-6 select-none">
          {/* SVG Overlay for Connection Paths and In-flight Packet markers */}
          <div className="hidden md:block absolute inset-0 pointer-events-none z-0">
            <svg
              className="w-full h-full"
              viewBox="0 0 1000 240"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                {/* Team A -> Drone Path */}
                <path
                  id="svg-path-a-to-drone"
                  d="M 180,120 Q 340,75 500,85"
                  fill="none"
                />
                {/* Drone -> Team A Path (Reverse) */}
                <path
                  id="svg-path-drone-to-a"
                  d="M 500,85 Q 340,75 180,120"
                  fill="none"
                />
                {/* Drone -> Team B Path */}
                <path
                  id="svg-path-drone-to-b"
                  d="M 500,85 Q 660,75 820,120"
                  fill="none"
                />
                {/* Team B -> Drone Path (Reverse) */}
                <path
                  id="svg-path-b-to-drone"
                  d="M 820,120 Q 660,75 500,85"
                  fill="none"
                />
              </defs>

              {/* Static Background Path: Team A <-> Drone */}
              <path
                d="M 180,120 Q 340,75 500,85"
                fill="none"
                stroke={isLight ? '#DDE3EA' : '#232B36'}
                strokeWidth="3"
                strokeDasharray="4 4"
              />

              {/* Active Traversing Highlight Path: Team A <-> Drone */}
              <path
                d="M 180,120 Q 340,75 500,85"
                fill="none"
                stroke={edgeHighlights.A_DRONE ? tokens.accentCyan : isLight ? '#DDE3EA' : '#232B36'}
                strokeWidth={edgeHighlights.A_DRONE ? '5' : '3'}
                className="transition-all duration-150"
              />

              {/* Static Background Path: Drone <-> Team B */}
              <path
                d="M 500,85 Q 660,75 820,120"
                fill="none"
                stroke={isLight ? '#DDE3EA' : '#232B36'}
                strokeWidth="3"
                strokeDasharray="4 4"
              />

              {/* Active Traversing Highlight Path: Drone <-> Team B */}
              <path
                d="M 500,85 Q 660,75 820,120"
                fill="none"
                stroke={edgeHighlights.DRONE_B ? tokens.accentCyan : isLight ? '#DDE3EA' : '#232B36'}
                strokeWidth={edgeHighlights.DRONE_B ? '5' : '3'}
                className="transition-all duration-150"
              />

              {/* In-flight Animated Packets Queue (Section 4.5) */}
              {inFlightPackets.map((pkt) => {
                let pathHref = '#svg-path-a-to-drone';
                if (pkt.hop === 'DRONE_TO_B') pathHref = '#svg-path-drone-to-b';
                else if (pkt.hop === 'B_TO_DRONE') pathHref = '#svg-path-b-to-drone';
                else if (pkt.hop === 'DRONE_TO_A') pathHref = '#svg-path-drone-to-a';

                return (
                  <g key={pkt.id}>
                    <circle r="7" fill={pkt.color} opacity="0.95">
                      <animateMotion
                        dur={`${pkt.durationMs}ms`}
                        repeatCount="1"
                        fill="freeze"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.4 0 0.2 1"
                      >
                        <mpath href={pathHref} />
                      </animateMotion>
                    </circle>
                    {/* Trailing ripple */}
                    <circle r="12" fill="none" stroke={pkt.color} strokeWidth="2" opacity="0.4">
                      <animateMotion
                        dur={`${pkt.durationMs}ms`}
                        repeatCount="1"
                        fill="freeze"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.4 0 0.2 1"
                      >
                        <mpath href={pathHref} />
                      </animateMotion>
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Node Cards Grid (Elevated relative to SVG paths) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center relative z-10">
            {/* Node 1: Team A Base */}
            <div
              className={`p-4 rounded-xl border transition-all duration-200 relative ${
                flashingNode?.nodeId === 'TEAM_A'
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                  : isLight
                  ? 'bg-white border-[#DDE3EA] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]'
                  : 'bg-[#171D27] border-[#232B36]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  GROUND 01
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-mono ${teamAStatus.textClass}`}>
                  <span className={`w-2 h-2 rounded-full ${teamAStatus.dotClass}`} />
                  {teamAStatus.label}
                </span>
              </div>
              <h4
                className={`text-sm font-bold mb-1 ${
                  isLight ? 'text-[#0B1220]' : 'text-slate-100'
                }`}
              >
                TEAM A BASE
              </h4>
              <p className="text-xs text-slate-400 mb-3 line-clamp-1">ESP32 + SX1278 (433MHz)</p>
              <div
                className={`text-[11px] font-mono space-y-1 p-2 rounded border ${
                  isLight
                    ? 'bg-[#F3F5F8] border-[#EDEFF2] text-[#3F4A5C]'
                    : 'bg-[#12171F] border-[#232B36] text-slate-400'
                }`}
              >
                <div className="flex justify-between">
                  <span>Heartbeats:</span>
                  <span className="font-semibold">{teamA?.heartbeatsCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>GPS / Alt:</span>
                  <span className="text-amber-500 italic">Not available</span>
                </div>
              </div>
            </div>

            {/* Node 2: Drone Relay (Center Raised Airborne Node) */}
            <div
              className={`p-5 rounded-xl border-2 transition-all duration-200 relative ${
                flashingNode?.nodeId === 'DRONE_RELAY'
                  ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                  : isLight
                  ? 'bg-white border-cyan-500/50 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08)]'
                  : 'bg-[#171D27] border-cyan-500/40'
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider shadow">
                Airborne Relay
              </div>
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                  DRONE RELAY
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-mono ${droneStatus.textClass}`}>
                  <span className={`w-2 h-2 rounded-full ${droneStatus.dotClass}`} />
                  {droneStatus.label}
                </span>
              </div>
              <h4
                className={`text-sm font-bold mb-1 ${
                  isLight ? 'text-[#0B1220]' : 'text-cyan-200'
                }`}
              >
                DRONE LORA PAYLOAD
              </h4>
              <p className="text-xs text-slate-400 mb-3">Store-and-Forward Repeat</p>

              <div
                className={`text-[11px] font-mono space-y-1 p-2 rounded border ${
                  isLight
                    ? 'bg-[#F3F5F8] border-[#EDEFF2] text-[#3F4A5C]'
                    : 'bg-[#12171F] border-[#232B36] text-slate-300'
                }`}
              >
                <div className="flex justify-between">
                  <span>Relay Mode:</span>
                  <span className="text-cyan-500 font-semibold">Store & Forward</span>
                </div>
                <div className="flex justify-between">
                  <span>Flight Control:</span>
                  <span className="text-slate-400">FlySky 2.4GHz (Isolated)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Telemetry:</span>
                  <span className="text-amber-500 italic">Not instrumented</span>
                </div>
              </div>
            </div>

            {/* Node 3: Team B Rescue */}
            <div
              className={`p-4 rounded-xl border transition-all duration-200 relative ${
                flashingNode?.nodeId === 'TEAM_B'
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                  : isLight
                  ? 'bg-white border-[#DDE3EA] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]'
                  : 'bg-[#171D27] border-[#232B36]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  GROUND 02
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-mono ${teamBStatus.textClass}`}>
                  <span className={`w-2 h-2 rounded-full ${teamBStatus.dotClass}`} />
                  {teamBStatus.label}
                </span>
              </div>
              <h4
                className={`text-sm font-bold mb-1 ${
                  isLight ? 'text-[#0B1220]' : 'text-slate-100'
                }`}
              >
                TEAM B RESCUE
              </h4>
              <p className="text-xs text-slate-400 mb-3 line-clamp-1">ESP32 + SX1278 (433MHz)</p>
              <div
                className={`text-[11px] font-mono space-y-1 p-2 rounded border ${
                  isLight
                    ? 'bg-[#F3F5F8] border-[#EDEFF2] text-[#3F4A5C]'
                    : 'bg-[#12171F] border-[#232B36] text-slate-400'
                }`}
              >
                <div className="flex justify-between">
                  <span>Heartbeats:</span>
                  <span className="font-semibold">{teamB?.heartbeatsCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>GPS / Alt:</span>
                  <span className="text-amber-500 italic">Not available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
