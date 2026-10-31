import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  CheckCheck,
  Filter,
  AlertTriangle,
  Info,
  Clock,
  Radio,
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useApp();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    return n.severity === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              NOTIFICATION CENTER
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time critical emergency alarms, relay confirmations, and system alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 text-xs font-mono border-b border-slate-800 pb-3">
        <span className="text-slate-400 flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5" /> Severity:
        </span>
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilter(sev)}
            className={`px-3 py-1 rounded-lg uppercase transition-colors ${
              filter === sev
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl divide-y divide-slate-800/60 overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-mono text-xs">
            No notifications matching current filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => markNotificationAsRead(item.id)}
              className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                !item.read ? 'bg-slate-800/30' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                      item.severity === 'critical'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : item.severity === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    {item.severity}
                  </span>

                  {item.isDemo && (
                    <span className="text-[9px] font-mono px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      DEMO
                    </span>
                  )}

                  <span className="text-xs font-mono text-slate-400">{item.timestamp}</span>

                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </div>

                <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.message}</p>
              </div>

              {item.relatedMsgId && (
                <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                  Ref: <span className="text-cyan-400">#{item.relatedMsgId}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
