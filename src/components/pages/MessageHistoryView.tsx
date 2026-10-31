import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Message, MessagePriority, MessageStatus, NodeId } from '../../types';
import {
  History,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  ArrowRight,
  Shield,
} from 'lucide-react';

export const MessageHistoryView: React.FC = () => {
  const { messages, exportMessagesCsv, resendMessage, currentUser, mode } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.payload.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.msgID.toString().includes(searchTerm) ||
      m.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.to.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === 'ALL' || m.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              TRANSMISSION LOG & HISTORY
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auditable log of all packets relayed across the airborne drone communication link.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="export-csv-btn"
            onClick={exportMessagesCsv}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filtering Controls */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by payload, msgID, sender, or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RELAYED">Relayed</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED_NO_ACK">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Msg ID</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Payload Content</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    No message records found matching current query.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{msg.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-cyan-300">#{msg.msgID}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200">{msg.from}</span>
                        <ArrowRight className="w-3 h-3 text-cyan-400" />
                        <span className="text-slate-200">{msg.to}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          msg.priority === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : msg.priority === 'URGENT'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {msg.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-sans text-slate-200">
                      {msg.payload}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          msg.status === 'ACKNOWLEDGED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : msg.status === 'DELIVERED'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : msg.status === 'RELAYED'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {msg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {msg.isDemo ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                          DEMO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          LIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedMessage(msg)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                          title="View transmission trace"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role !== 'viewer' && (
                          <button
                            onClick={() => resendMessage(msg.id)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-300 transition-colors"
                            title="Resend with fresh msgID (Loop-safe)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between px-4">
          <span>Showing {filteredMessages.length} of {messages.length} total recorded packets</span>
          <span>Indexed by msgID & timestamp</span>
        </div>
      </div>

      {/* Message Detail Modal (Trace hops) */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-sm font-bold text-slate-100">
                  Packet Detail: msgID #{selectedMessage.msgID}
                </span>
                {selectedMessage.isDemo && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    DEMO
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <div className="text-slate-400">Payload:</div>
                <div className="text-sm font-sans font-semibold text-slate-100">
                  "{selectedMessage.payload}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">ROUTE</div>
                  <div>{selectedMessage.from} → {selectedMessage.to}</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">PRIORITY</div>
                  <div className="font-bold text-cyan-400">{selectedMessage.priority}</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">RELAY COUNT</div>
                  <div>{selectedMessage.relayCount} hop(s)</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">ACK VERIFIED</div>
                  <div className="text-emerald-400">{selectedMessage.ackReceivedAt || 'Pending'}</div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hop Timeline & Delivery Path
                </div>
                <div className="space-y-2">
                  {selectedMessage.hops?.map((h, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-200">{h.node}</div>
                          <div className="text-[10px] text-slate-400 font-sans">{h.action}</div>
                        </div>
                      </div>
                      <div className="text-slate-500">{h.timestamp}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
