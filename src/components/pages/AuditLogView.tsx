import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  Download,
  Search,
  Lock,
  Clock,
  User,
  Activity,
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  if (currentUser.role !== 'admin') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-100 font-mono">
          ADMIN PRIVILEGES REQUIRED
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The System Audit Log is restricted exclusively to personnel with the{' '}
          <code className="text-cyan-300">ADMIN</code> security role. Current role:{' '}
          <strong className="text-rose-400 font-mono uppercase">{currentUser.role}</strong>.
        </p>
        <p className="text-[11px] text-slate-500">
          Switch active role in the top right user menu to test Admin capabilities.
        </p>
      </div>
    );
  }

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              SECURITY AUDIT TRAIL (ADMIN ONLY)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of all user actions, execution mode changes, serial connects, and packet dispatches.
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
          Access Granted: {currentUser.name}
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter audit entries by action, actor, or target..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Audit Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target / Resource</th>
                <th className="py-3 px-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                    No audit records match query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{entry.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{entry.actor}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-bold bg-slate-800 text-slate-300">
                        {entry.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-cyan-300 font-semibold">{entry.action}</td>
                    <td className="py-3 px-4 text-slate-300">{entry.target}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-[11px] font-mono text-slate-500 px-4 flex justify-between items-center">
          <span>Persisted into auditLogs collection</span>
          <span>Role-Based Access Control (RBAC) Verified</span>
        </div>
      </div>
    </div>
  );
};
