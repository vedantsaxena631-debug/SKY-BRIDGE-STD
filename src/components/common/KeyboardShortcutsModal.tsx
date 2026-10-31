import React from 'react';
import { HelpCircle, X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd/Ctrl + K', desc: 'Open Command Palette & Search' },
    { key: '?', desc: 'Toggle Keyboard Shortcuts Cheat Sheet' },
    { key: 'Esc', desc: 'Exit Presentation / Kiosk Mode or close dialogs' },
    { key: 'Alt + 1', desc: 'Switch to System Overview' },
    { key: 'Alt + 2', desc: 'Switch to Live LoRa Communication' },
    { key: 'Alt + 3', desc: 'Switch to Send Message Composer' },
    { key: 'Alt + 4', desc: 'Switch to Message History' },
    { key: 'Alt + 5', desc: 'Switch to Nodes & Hardware BOM' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-cyan-400" />
            <h2 id="shortcuts-title" className="text-sm font-bold font-mono text-slate-100 uppercase tracking-tight">
              KEYBOARD SHORTCUTS REFERENCE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs font-mono">
          {shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
              <span className="text-slate-300 font-sans">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-[11px]">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-[11px] font-mono text-slate-500">
          Press <kbd className="px-1 rounded bg-slate-800 text-slate-300">Esc</kbd> to close at any time
        </div>
      </div>
    </div>
  );
};
