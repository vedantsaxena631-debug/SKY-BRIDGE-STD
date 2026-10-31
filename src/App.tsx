import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/common/TopBar';
import { Sidebar } from './components/common/Sidebar';
import { DemoBanner } from './components/common/DemoBanner';
import { CommandPalette } from './components/common/CommandPalette';
import { AlertOctagon, ArrowRight, Minimize2, Loader2 } from 'lucide-react';

// Page Views
import { Login } from './components/pages/Login';
import { LandingView } from './components/pages/LandingView';
import { OverviewView } from './components/pages/OverviewView';
import { LiveCommView } from './components/pages/LiveCommView';
import { SendMessageView } from './components/pages/SendMessageView';
import { MessageHistoryView } from './components/pages/MessageHistoryView';
import { SitrepView } from './components/pages/SitrepView';
import { DevicesView } from './components/pages/DevicesView';
import { DroneView } from './components/pages/DroneView';
import { StatsView } from './components/pages/StatsView';
import { NotificationsView } from './components/pages/NotificationsView';
import { AuditLogView } from './components/pages/AuditLogView';
import { SettingsView } from './components/pages/SettingsView';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    notifications,
    theme,
    kioskMode,
    toggleKioskMode,
    focusMode,
    hasActiveCritical,
    unacknowledgedCriticalCount,
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Latest critical notification for ARIA live region
  const latestCritical = notifications.find((n) => n.severity === 'critical' && !n.read);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('overview');
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('live-comm');
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        setActiveTab('send-message');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // If user navigates to landing, render landing full-screen
  if (activeTab === 'landing') {
    return (
      <main id="skybridge-landing-container" className="min-h-screen bg-[#070a0f] text-slate-100">
        <LandingView />
      </main>
    );
  }

  return (
    <div
      id="skybridge-app-container"
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#0B0F14] text-[#E8EBEF]' : 'bg-white text-[#0B1220]'
      }`}
    >
      {/* ARIA Live region for accessibility */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {latestCritical ? `CRITICAL ALERT: ${latestCritical.title}. ${latestCritical.message}` : ''}
      </div>

      {/* Persistent Demo Mode Banner */}
      {!kioskMode && <DemoBanner />}

      {/* Active Incident / Alert Mode Banner (Section 3.3) */}
      {hasActiveCritical && (
        <div
          role="alert"
          className="bg-rose-950 border-b border-rose-800 text-rose-200 px-4 py-1.5 text-xs flex items-center justify-between z-40 transition-all shadow-[0_2px_10px_rgba(220,38,38,0.25)]"
        >
          <div className="flex items-center gap-2 font-mono">
            <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse flex-shrink-0" />
            <span className="font-bold text-rose-300 uppercase tracking-tight">
              INCIDENT ACTIVE: {unacknowledgedCriticalCount} UNACKNOWLEDGED CRITICAL TRANSMISSION(S)
            </span>
          </div>
          <button
            onClick={() => setActiveTab('live-comm')}
            className="flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors text-[11px]"
          >
            <span>Jump to Comm</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main App Navigation TopBar */}
      {!kioskMode && (
        <TopBar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          mobileSidebarOpen={mobileSidebarOpen}
        />
      )}

      {/* Kiosk Mode Floating Exit Pill */}
      {kioskMode && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-full px-3 py-1 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>KIOSK / PRESENTATION MODE</span>
          <button
            onClick={toggleKioskMode}
            className="ml-2 flex items-center gap-1 text-cyan-400 hover:text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800 transition-colors text-[10px]"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      )}

      {/* Main Body Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar (hidden in Kiosk mode) */}
        {!kioskMode && (
          <Sidebar
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Content View Container */}
        <main
          id="main-content-viewport"
          className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] max-w-7xl mx-auto w-full transition-all duration-200 ${
            kioskMode ? 'lg:pl-0' : focusMode ? 'lg:pl-20' : 'lg:pl-68'
          }`}
        >
          {activeTab === 'overview' && <OverviewView />}
          {activeTab === 'live-comm' && <LiveCommView />}
          {activeTab === 'send-message' && <SendMessageView />}
          {activeTab === 'history' && <MessageHistoryView />}
          {activeTab === 'sitrep' && <SitrepView />}
          {activeTab === 'devices' && <DevicesView />}
          {activeTab === 'drone' && <DroneView />}
          {activeTab === 'stats' && <StatsView />}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'audit-log' && <AuditLogView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
};

const RootNavigation: React.FC = () => {
  const { isAuthenticated, restoring } = useAuth();
  const { activeTab, setActiveTab } = useApp();

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#070A0E] flex items-center justify-center text-slate-400 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="text-emerald-500 animate-spin" />
          <span>Verifying SkyBridge session authorization...</span>
        </div>
      </div>
    );
  }

  // Allow visitors to view the cinematic landing narrative
  if (activeTab === 'landing') {
    return (
      <main id="skybridge-landing-container" className="min-h-screen bg-[#070a0f] text-slate-100">
        <LandingView />
      </main>
    );
  }

  // If unauthenticated and on login/overview, present the login screen with landing access
  if (!isAuthenticated) {
    return <Login onOpenLanding={() => setActiveTab('landing')} />;
  }

  return <MainLayout />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <RootNavigation />
      </AppProvider>
    </AuthProvider>
  );
}
