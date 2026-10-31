import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Zap,
  Download,
  Shield,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  FileText,
  Activity,
  X,
  ArrowRight,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    setActiveTab,
    sendTestPing,
    exportMessagesCsv,
    toggleDemoMode,
    mode,
    theme,
    setTheme,
    soundEnabled,
    setSoundEnabled,
    currentUser,
  } = useApp();

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : undefined;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'ping',
      title: 'Send LoRa Test Ping',
      desc: 'Dispatches a diagnostic probe packet through the drone relay',
      icon: Zap,
      run: async () => {
        await sendTestPing();
        onClose();
      },
    },
    {
      id: 'export',
      title: 'Export Message Log to CSV',
      desc: 'Download all recorded transmission logs as spreadsheet',
      icon: Download,
      run: () => {
        exportMessagesCsv();
        onClose();
      },
    },
    {
      id: 'mode',
      title: mode === 'DEMO' ? 'Switch to Live Hardware Mode' : 'Switch to Demo Mode',
      desc: currentUser.role === 'admin' ? 'Toggle simulation vs serial hardware bridge' : 'Requires Admin role',
      icon: Shield,
      run: () => {
        if (currentUser.role === 'admin') {
          toggleDemoMode();
        } else {
          alert('Admin role required to toggle modes.');
        }
        onClose();
      },
    },
    {
      id: 'theme',
      title: `Toggle Theme (Current: ${theme})`,
      desc: 'Switch between Dark and Light technical layouts',
      icon: theme === 'dark' ? Sun : Moon,
      run: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
    {
      id: 'sound',
      title: soundEnabled ? 'Mute Alert Sound Chimes' : 'Enable Alert Sound Chimes',
      desc: 'Dual-tone acoustic ping for critical messages and ACKs',
      icon: soundEnabled ? VolumeX : Volume2,
      run: () => {
        setSoundEnabled(!soundEnabled);
        onClose();
      },
    },
    {
      id: 'nav_overview',
      title: 'Go to Overview Dashboard',
      desc: 'Network topology and current node statuses',
      icon: Activity,
      run: () => {
        setActiveTab('overview');
        onClose();
      },
    },
    {
      id: 'nav_send',
      title: 'Go to Send Message Console',
      desc: 'Draft pre-formatted or custom LoRa message packet',
      icon: ArrowRight,
      run: () => {
        setActiveTab('send-message');
        onClose();
      },
    },
    {
      id: 'nav_sitrep',
      title: 'Generate Situation Report (SITREP)',
      desc: 'Generate printable official incident timeline report',
      icon: FileText,
      run: () => {
        setActiveTab('sitrep');
        onClose();
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center pt-24 px-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or navigate... (e.g. ping, export, sitrep)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={item.run}
                className="w-full text-left p-3 hover:bg-slate-800/70 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-cyan-950 text-slate-300 group-hover:text-cyan-400 transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200 group-hover:text-cyan-300">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors" />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400 px-4">
          <span>Navigate with mouse or enter</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
