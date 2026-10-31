import React from 'react';
import { useApp } from '../../context/AppContext';
import { LogOut } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const { mode, toggleDemoMode } = useApp();

  // In Live Mode: No banner (absence of decoration signals real hardware mode, per Section 11)
  if (mode !== 'DEMO') {
    return null;
  }

  return (
    <aside
      id="demo-mode-persistent-banner"
      aria-label="Demo Mode Indicator"
      className="h-9 bg-[#8B5CF6]/15 dark:bg-[#A78BFA]/15 border-b border-[#8B5CF6]/40 px-4 text-xs flex items-center justify-between no-print transition-colors z-50 select-none"
    >
      <div className="flex items-center gap-2.5 font-mono">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B5CF6]" />
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6] text-white font-bold font-mono text-[10px] tracking-wider uppercase shadow-sm">
          DEMO MODE
        </span>
        <span className="font-bold text-[#8B5CF6] dark:text-[#A78BFA] tracking-wide">
          SIMULATED DATA (NOTHING REACHES PHYSICAL RADIOS)
        </span>
        <span className="text-slate-500 dark:text-slate-400 hidden lg:inline text-[11px]">
          — Telemetry and packet relays are isolated in-memory.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          id="toggle-live-mode-btn"
          onClick={toggleDemoMode}
          className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#8B5CF6] dark:text-[#A78BFA] rounded border border-[#8B5CF6]/40 text-[11px] font-mono transition-colors cursor-pointer"
          title="Mode is set at login. Switching modes signs out to ensure session isolation."
        >
          <LogOut size={12} />
          <span>Switch to Live Mode</span>
        </button>
      </div>
    </aside>
  );
};

