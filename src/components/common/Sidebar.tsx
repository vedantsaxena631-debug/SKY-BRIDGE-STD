import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Radio,
  Send,
  History,
  FileText,
  Server,
  Plane,
  BarChart3,
  Cpu,
  Bell,
  Activity,
  ShieldAlert,
  BookOpen,
  Settings,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  Code,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    notifications,
    messages,
    focusMode,
    toggleFocusMode,
    hasActiveCritical,
    theme,
  } = useApp();

  const isLight = theme === 'light';
  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'live-comm',
      label: 'Live Communication',
      icon: Radio,
      badge: hasActiveCritical ? 'ALERT' : 'Live',
      isAlert: hasActiveCritical,
    },
    { id: 'send-message', label: 'Send Message', icon: Send, permission: 'operator' },
    { id: 'history', label: 'Message History', icon: History, count: messages.length },
    { id: 'sitrep', label: 'Incident / SITREP', icon: FileText },
    { id: 'devices', label: 'Nodes & Devices', icon: Server },
    { id: 'drone', label: 'Drone Relay', icon: Plane },
    { id: 'stats', label: 'System Statistics', icon: BarChart3 },
    { id: 'landing', label: 'Mission Narrative', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount || undefined },
    { id: 'audit-log', label: 'Audit Log', icon: ShieldAlert, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelect = (id: string) => {
    setActiveTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 ${
          focusMode ? 'w-18' : 'w-64'
        } border-r z-40 transition-all duration-200 flex flex-col justify-between no-print ${
          isLight ? 'bg-[#F3F5F8] border-[#DDE3EA]' : 'bg-[#070A0F] border-[#232B36]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation List */}
        <div className="py-3 px-2 overflow-y-auto flex-1 space-y-1">
          <div className="flex items-center justify-between px-2 pb-2">
            {!focusMode && (
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Operations Console
              </span>
            )}
            <button
              onClick={toggleFocusMode}
              className={`hidden lg:flex p-1 rounded transition-colors ml-auto ${
                isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={focusMode ? 'Expand Sidebar' : 'Focus Mode (Collapse Sidebar)'}
            >
              {focusMode ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          {navItems.map((item) => {
            const isAdminLocked = item.adminOnly && currentUser.role !== 'admin';
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => !isAdminLocked && handleSelect(item.id)}
                disabled={isAdminLocked}
                title={focusMode ? item.label : undefined}
                className={`w-full flex items-center ${
                  focusMode ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                } rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? item.isAlert
                      ? isLight
                        ? 'bg-rose-100 text-rose-800 border border-rose-400 font-semibold'
                        : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                      : isLight
                      ? 'bg-[#2F6FED] text-white font-semibold shadow-sm'
                      : 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/30'
                    : item.isAlert
                    ? isLight
                      ? 'text-rose-600 hover:bg-rose-100/60 animate-pulse'
                      : 'text-rose-400 hover:bg-rose-950/40 animate-pulse'
                    : isAdminLocked
                    ? 'opacity-40 cursor-not-allowed'
                    : isLight
                    ? 'text-[#3F4A5C] hover:text-[#0B1220] hover:bg-slate-200/70'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <item.icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive
                        ? item.isAlert
                          ? isLight ? 'text-rose-700' : 'text-rose-400'
                          : isLight ? 'text-white' : 'text-cyan-400'
                        : item.isAlert
                        ? 'text-rose-500'
                        : isLight
                        ? 'text-slate-500 group-hover:text-slate-800'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!focusMode && <span className="truncate whitespace-nowrap">{item.label}</span>}
                </div>

                {!focusMode && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                          item.isAlert
                            ? 'bg-rose-500/20 text-rose-600 border border-rose-400 animate-pulse'
                            : isLight
                            ? isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-cyan-950 text-cyan-400 border border-cyan-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          isLight
                            ? isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                    {isAdminLocked && (
                      <Lock className="w-3 h-3 text-slate-400" title="Admin access required" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Status & Landing Switcher */}
        <div
          className={`p-2 border-t space-y-2 ${
            isLight ? 'border-[#DDE3EA] bg-[#EDEFF2]/70' : 'border-slate-800 bg-slate-950/80'
          }`}
        >
          <button
            onClick={() => handleSelect('landing')}
            className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              isLight
                ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300'
                : 'text-cyan-400 bg-cyan-950/40 hover:bg-cyan-950 border border-cyan-800/60'
            } ${focusMode ? 'px-1' : 'px-3'}`}
            title="Public Landing Page"
          >
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            {!focusMode && <span>Landing Page</span>}
          </button>

          {!focusMode && (
            <div
              className={`px-3 py-2 rounded border text-[11px] font-mono ${
                isLight ? 'bg-white border-[#DDE3EA] text-slate-600' : 'bg-slate-900/90 border-slate-800/80 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Hardware Gateway:</span>
                <span className="text-purple-500 dark:text-purple-400 font-semibold">SX1278 (433MHz)</span>
              </div>
              <div className="flex items-center justify-between mt-0.5 text-[10px]">
                <span>Airborne Repeater:</span>
                <span className="text-emerald-500 font-semibold">STORE-FORWARD</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
