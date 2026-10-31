import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Shield,
  Radio,
  Cpu,
  User,
  Key,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserRole } from '../../types';

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    soundEnabled,
    setSoundEnabled,
    reducedMotion,
    setReducedMotion,
    mode,
    toggleDemoMode,
    currentUser,
    switchUserRole,
    serialBridge,
    connectSerial,
    disconnectSerial,
  } = useApp();

  const [customPort, setCustomPort] = useState(serialBridge.port);
  const [baudRate, setBaudRate] = useState(serialBridge.baudRate);

  const handleSerialToggle = () => {
    if (serialBridge.connected) {
      disconnectSerial();
    } else {
      connectSerial(customPort, Number(baudRate));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              SYSTEM & USER CONFIGURATION
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Display preferences, acoustic alerts, serial communication ports, and access control.
          </p>
        </div>
      </div>

      {/* Appearance & Sound */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
        <h3 className="text-sm font-bold font-mono text-slate-100 uppercase border-b border-slate-800 pb-3">
          1. Interface & Acoustic Alerts
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-slate-300">
              Color Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all ${
                  theme === 'dark'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all ${
                  theme === 'light'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Sound */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-slate-300">
              Acoustic Emergency Pings
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSoundEnabled(true)}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all ${
                  soundEnabled
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>Audio Enabled</span>
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled(false)}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all ${
                  !soundEnabled
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <VolumeX className="w-4 h-4" />
                <span>Muted</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Web Audio sine synthesis chime for Critical traffic and ACK receipt.
            </p>
          </div>
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-mono">
          <div>
            <div className="font-semibold text-slate-200">Accessibility: Reduce Motion</div>
            <div className="text-slate-400 text-[11px]">
              Replaces continuous SVG packet flow animations with static status indicators.
            </div>
          </div>
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              reducedMotion
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            {reducedMotion ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Serial Hardware Connection Settings */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold font-mono text-slate-100 uppercase">
            2. USB Serial Gateway Configuration
          </h3>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              serialBridge.connected
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-purple-950 text-purple-300 border border-purple-800'
            }`}
          >
            {serialBridge.connected ? 'SERIAL CONNECTED' : 'DEMO EMULATION'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">Serial Port Path</label>
            <input
              type="text"
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              placeholder="/dev/ttyUSB0 or COM3"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Baud Rate</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value={9600}>9600 Baud</option>
              <option value={57600}>57600 Baud</option>
              <option value={115200}>115200 Baud (Standard ESP32)</option>
              <option value={230400}>230400 Baud</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-[11px] text-slate-400 font-mono">
            Status: {serialBridge.statusMessage}
          </p>

          <button
            onClick={handleSerialToggle}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
              serialBridge.connected
                ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
            }`}
          >
            {serialBridge.connected ? 'Disconnect Port' : 'Connect Serial Port'}
          </button>
        </div>
      </div>

      {/* Demo vs Live Mode (Section 32) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold font-mono text-slate-100 uppercase">
            3. Simulation & Demonstration Mode
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
            CURRENT: {mode}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Demo Mode simulates packet hops, delays, alerts, and ACK confirmations for laboratory presentations and evaluations when physical hardware is not tethered via USB.
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-mono text-slate-400">
            Requires <strong>Admin</strong> privileges to toggle.
          </div>

          <button
            onClick={toggleDemoMode}
            disabled={currentUser.role !== 'admin'}
            className="px-4 py-2 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-mono font-bold transition-colors disabled:opacity-40"
          >
            {mode === 'DEMO' ? 'Switch to Live Mode' : 'Switch to Demo Mode'}
          </button>
        </div>
      </div>

      {/* Active User Account & RBAC Privileges (Section 11) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold font-mono text-slate-100 uppercase border-b border-slate-800 pb-3">
          4. Active User Profile & Access Roles
        </h3>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-600 flex items-center justify-center font-mono font-bold text-cyan-400 text-sm">
              {currentUser.role[0].toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">{currentUser.name}</div>
              <div className="text-xs font-mono text-slate-400">
                Callsign: {currentUser.callsign} // User: {currentUser.username}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Switch Role:</span>
            {(['admin', 'operator', 'viewer'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => switchUserRole(r)}
                className={`px-3 py-1 rounded-lg text-xs font-mono uppercase transition-colors ${
                  currentUser.role === r
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 pt-2 space-y-1">
          <div>• <strong>Admin:</strong> View all, Send messages, Toggle Demo/Live, Audit log, Device settings.</div>
          <div>• <strong>Operator:</strong> View all, Send emergency messages and test pings.</div>
          <div>• <strong>Viewer:</strong> Read-only monitoring of live topology and message streams.</div>
        </div>
      </div>
    </div>
  );
};
