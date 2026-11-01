import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import {
  AuditLogEntry,
  DeviceNode,
  Message,
  MessagePriority,
  NodeId,
  NotificationItem,
  SerialBridgeState,
  SystemEvent,
  User,
  UserRole,
} from '../types';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_DEVICES,
  INITIAL_EVENTS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_USERS,
} from '../data/initialData';
import { demoSimulator } from '../services/demoSimulator';
import { audioAlert } from '../utils/audioAlert';

interface AppContextType {
  mode: 'DEMO' | 'LIVE';
  theme: 'dark' | 'light';
  currentUser: User;
  users: User[];
  messages: Message[];
  devices: DeviceNode[];
  events: SystemEvent[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
  serialBridge: SerialBridgeState;
  soundEnabled: boolean;
  reducedMotion: boolean;
  activeTransmission: Message | null;
  activeTab: string;
  kioskMode: boolean;
  focusMode: boolean;
  density: 'comfortable' | 'compact';
  highContrast: boolean;
  hasActiveCritical: boolean;
  unacknowledgedCriticalCount: number;
  setActiveTab: (tab: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSoundEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setCurrentUser: (user: User) => void;
  toggleDemoMode: () => void;
  toggleKioskMode: () => void;
  toggleFocusMode: () => void;
  setDensity: (d: 'comfortable' | 'compact') => void;
  toggleHighContrast: () => void;
  switchUserRole: (role: UserRole) => void;
  sendMessage: (
    from: NodeId,
    to: NodeId,
    payload: string,
    priority: MessagePriority,
    isTestPing?: boolean
  ) => Promise<Message>;
  resendMessage: (messageId: string) => Promise<void>;
  sendTestPing: (from?: NodeId, to?: NodeId) => Promise<Message>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  connectSerial: (port?: string, baud?: number) => void;
  disconnectSerial: () => void;
  exportMessagesCsv: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapBackendNode = (node: unknown, fallback: NodeId): NodeId => {
  if (node === 'A') return 'TEAM_A';
  if (node === 'B') return 'TEAM_B';
  if (node === 'DRONE') return 'DRONE_RELAY';
  return typeof node === 'string' ? (node as NodeId) : fallback;
};

const mapBackendStatus = (status: unknown, fallback: Message['status'] = 'QUEUED'): Message['status'] => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'sent_to_bridge') return 'SENT_TO_BRIDGE';
  if (normalized === 'relayed') return 'RELAYED';
  if (normalized === 'delivered') return 'ACKNOWLEDGED';
  if (normalized === 'failed') return 'FAILED';
  if (normalized === 'failed_no_ack') return 'FAILED_NO_ACK';
  if (normalized === 'queued') return 'QUEUED';
  return fallback;
};

const mapBackendMessage = (message: any, fallback?: Message): Message => {
  const from = mapBackendNode(message?.from, fallback?.from || 'TEAM_A');
  const to = mapBackendNode(message?.to, fallback?.to || 'TEAM_B');
  const timestamp = message?.timestamp ? new Date(message.timestamp) : null;
  const ackReceivedAt = message?.ackReceivedAt ? new Date(message.ackReceivedAt) : null;
  const backendMsgId = Number(message?.msgID);

  return {
    id: String(message?._id || message?.id || fallback?.id || `msg_${message?.msgID || Date.now()}`),
    msgID: Number.isFinite(backendMsgId) ? backendMsgId : fallback?.msgID || 0,
    from,
    to,
    payload: typeof message?.payload === 'string' ? message.payload : fallback?.payload || '',
    priority: String(message?.priority || fallback?.priority || 'ROUTINE').toUpperCase() as MessagePriority,
    status: mapBackendStatus(message?.status, fallback?.status),
    timestamp: timestamp && !Number.isNaN(timestamp.getTime())
      ? timestamp.toLocaleTimeString()
      : fallback?.timestamp || new Date().toLocaleTimeString(),
    relayCount: Number(message?.relayCount ?? fallback?.relayCount ?? 0),
    isDemo: typeof message?.isDemo === 'boolean' ? message.isDemo : fallback?.isDemo ?? false,
    isTestPing: message?.type === 'PING' || fallback?.isTestPing || false,
    ackReceivedAt: ackReceivedAt && !Number.isNaN(ackReceivedAt.getTime())
      ? ackReceivedAt.toLocaleTimeString()
      : fallback?.ackReceivedAt,
    failureReason: typeof message?.failureReason === 'string' ? message.failureReason : fallback?.failureReason,
    hops: fallback?.hops || [
      {
        node: from,
        action: 'LoRa RF Transmission',
        timestamp: timestamp && !Number.isNaN(timestamp.getTime())
          ? timestamp.toLocaleTimeString()
          : new Date().toLocaleTimeString(),
      },
    ],
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const sessionMode = auth.mode === 'live' ? 'LIVE' : 'DEMO';

  const [mode, setMode] = useState<'DEMO' | 'LIVE'>(sessionMode);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Derive currentUser authoritatively from AuthContext
  const getAuthUser = (): User => {
    if (!auth.user) return INITIAL_USERS[0];
    const match = INITIAL_USERS.find(
      (u) => u.username.toLowerCase() === auth.user?.username.toLowerCase()
    );
    if (match) return match;
    return {
      id: auth.user.id,
      username: auth.user.username,
      name: auth.user.name || auth.user.username,
      role: auth.user.role as UserRole,
      callsign: auth.user.callsign || auth.user.username.toUpperCase(),
      team: (auth.user.team as any) || undefined,
      avatar: auth.user.username.slice(0, 2).toUpperCase(),
    };
  };

  const [currentUser, setCurrentUser] = useState<User>(getAuthUser());

  // Check 13: In Live Mode with all hardware off: Nodes offline, feed empty, stats zero
  const [messages, setMessages] = useState<Message[]>(
    sessionMode === 'LIVE' ? [] : INITIAL_MESSAGES
  );
  const [devices, setDevices] = useState<DeviceNode[]>(
    sessionMode === 'LIVE'
      ? INITIAL_DEVICES.map((d) => ({
          ...d,
          status: 'UNKNOWN',
          lastSeen: 'Never',
          uptimePercent: 0,
          heartbeatsCount: 0,
          firmwareVersion: 'Not provided by hardware',
        }))
      : INITIAL_DEVICES
  );
  const [events, setEvents] = useState<SystemEvent[]>(
    sessionMode === 'LIVE'
      ? [{ id: 'evt_init', timestamp: new Date().toLocaleTimeString(), type: 'SYSTEM', sourceNode: 'DRONE_RELAY', message: 'Live Mode selected. Awaiting live gateway telemetry.', isDemo: false }]
      : INITIAL_EVENTS
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [activeTransmission, setActiveTransmission] = useState<Message | null>(null);

  // Sync mode and user whenever auth changes
  useEffect(() => {
    const nextMode = auth.mode === 'live' ? 'LIVE' : 'DEMO';
    setMode(nextMode);
    setCurrentUser(getAuthUser());
    if (nextMode === 'LIVE') {
      setMessages([]);
      setDevices(INITIAL_DEVICES.map((d) => ({
        ...d,
        status: 'UNKNOWN',
        lastSeen: 'Never',
        uptimePercent: 0,
        heartbeatsCount: 0,
        firmwareVersion: 'Not provided by hardware',
      })));
      setEvents([
        {
          id: `evt_live_init_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'SYSTEM',
          sourceNode: 'DRONE_RELAY',
          message: 'Live Mode selected. Awaiting live gateway telemetry.',
          isDemo: false,
        },
      ]);
      setNotifications([]);
      setAuditLogs([]);
      setActiveTransmission(null);
      setSerialBridge((prev) => ({
        ...prev,
        connected: false,
        port: '',
        statusMessage: 'Awaiting live gateway telemetry.',
        isSimulated: false,
      }));
    } else {
      setMessages(INITIAL_MESSAGES);
      setDevices(INITIAL_DEVICES);
      setEvents(INITIAL_EVENTS);
      setNotifications(INITIAL_NOTIFICATIONS);
      setAuditLogs(INITIAL_AUDIT_LOGS);
      setActiveTransmission(null);
      setSerialBridge((prev) => ({
        ...prev,
        connected: false,
        port: '',
        statusMessage: 'Demo simulation bridge active.',
        isSimulated: true,
      }));
    }
  }, [auth.mode, auth.user?.username]);

  // Live polling for real hardware messages & serial state
  useEffect(() => {
    if (mode !== 'LIVE') return;

    const fetchLiveUpdates = async () => {
      try {
        const [msgsRes, serialRes, statusRes] = await Promise.allSettled([
          api.get('/messages'),
          api.get('/serial/status'),
          api.get('/status'),
        ]);

        if (msgsRes.status === 'fulfilled' && Array.isArray(msgsRes.value)) {
          const mappedMsgs: Message[] = msgsRes.value.map((m: any) => mapBackendMessage(m));
          setMessages((prev) => {
            const unpersistedFailures = prev.filter(
              (message) => message.status === 'FAILED' &&
                !mappedMsgs.some((latest) => latest.id === message.id || latest.msgID === message.msgID)
            );
            return [...unpersistedFailures, ...mappedMsgs];
          });
          setActiveTransmission((current) => {
            if (!current) return null;
            const latest = mappedMsgs.find(
              (message) => message.id === current.id || message.msgID === current.msgID
            );
            if (!latest) return current.status === 'FAILED' ? null : current;
            return ['ACKNOWLEDGED', 'FAILED', 'FAILED_NO_ACK'].includes(latest.status) ? null : latest;
          });
        }

        if (serialRes.status === 'fulfilled' && serialRes.value) {
          const s = serialRes.value;
          setSerialBridge((prev) => ({
            ...prev,
            connected: Boolean(s.connected),
            port: s.port || prev.port,
            baudRate: s.baudRate || 115200,
            statusMessage: s.connected
              ? 'Connected to ESP32 Gateway on ' + s.port + ' @ ' + s.baudRate + ' baud'
              : 'Serial bridge disconnected',
            isSimulated: false,
          }));
        }

        if (statusRes.status === 'fulfilled' && statusRes.value?.nodes) {
          const nodes = statusRes.value.nodes;
          setDevices((prev) => prev.map((device) => {
            const nodeId = device.id === 'TEAM_A' ? 'A' : device.id === 'TEAM_B' ? 'B' : 'DRONE';
            const node = nodes[nodeId];
            const reportedStatus = String(node?.status || 'unknown').toLowerCase();
            const status: DeviceNode['status'] =
              reportedStatus === 'online'
                ? 'ONLINE'
                : reportedStatus === 'standby'
                ? 'STANDBY'
                : reportedStatus === 'offline'
                ? 'OFFLINE'
                : 'UNKNOWN';

            return {
              ...device,
              status,
              lastSeen: node?.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : 'Never',
            };
          }));
        }
      } catch (err) {}
    };

    fetchLiveUpdates();
    const interval = setInterval(fetchLiveUpdates, 1500);
    return () => clearInterval(interval);
  }, [mode]);

  // New Design System Modes
  const [kioskMode, setKioskMode] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [highContrast, setHighContrast] = useState<boolean>(false);

  const [serialBridge, setSerialBridge] = useState<SerialBridgeState>({
    connected: false,
    port: '/dev/ttyUSB0',
    baudRate: 115200,
    statusMessage:
      sessionMode === 'LIVE'
        ? 'Live mode active. Physical hardware disconnected.'
        : 'Demo simulation bridge active.',
    reconnectAttempts: 0,
    isSimulated: sessionMode === 'DEMO',
  });

  // Calculate real unacknowledged critical messages (Incident / Alert Mode trigger)
  const unacknowledgedCritical = messages.filter(
    (m) => m.priority === 'CRITICAL' && m.status !== 'ACKNOWLEDGED'
  );
  const hasActiveCritical = unacknowledgedCritical.length > 0;
  const unacknowledgedCriticalCount = unacknowledgedCritical.length;

  // Apply theme and contrast attributes to html/body elements
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
    root.setAttribute('data-density', density);
    document.body.setAttribute('data-demo-mode', String(mode === 'DEMO'));

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, highContrast, density, mode]);

  // Handle system motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
    }
  }, []);

  // Kiosk mode auto-rotation (18 seconds between Overview, Live Comm, and Statistics)
  useEffect(() => {
    if (!kioskMode) return;

    const rotationTabs = ['overview', 'live-comm', 'stats'];
    const timer = setInterval(() => {
      setActiveTab((curr) => {
        const nextIdx = (rotationTabs.indexOf(curr) + 1) % rotationTabs.length;
        return rotationTabs[nextIdx];
      });
    }, 18000);

    return () => clearInterval(timer);
  }, [kioskMode]);

  // Handle Escape key to exit Kiosk Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && kioskMode) {
        setKioskMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [kioskMode]);

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
  };

  const toggleKioskMode = () => {
    setKioskMode((prev) => !prev);
  };

  const toggleFocusMode = () => {
    setFocusMode((prev) => !prev);
  };

  const toggleHighContrast = () => {
    setHighContrast((prev) => !prev);
  };

  const switchUserRole = (role: UserRole) => {
    const found = INITIAL_USERS.find((u) => u.role === role) || INITIAL_USERS[0];
    setCurrentUser(found);
    const newAudit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: found.username,
      role: found.role,
      action: 'ROLE_SWITCH',
      target: `Switched active operator context to ${found.name} (${role.toUpperCase()})`,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  const toggleDemoMode = () => {
    // Mode is immutable in the session token. Switching modes means signing out and back in
    const targetMode = mode === 'DEMO' ? 'live' : 'demo';
    auth.switchModeViaLogout(targetMode);
  };

  const connectSerial = (port = '/dev/ttyUSB0', baud = 115200) => {
    setSerialBridge({
      connected: true,
      port,
      baudRate: baud,
      statusMessage: `Connected to ESP32 LoRa Gateway on ${port} @ ${baud} baud.`,
      lastPacketTime: new Date().toLocaleTimeString(),
      reconnectAttempts: 0,
      isSimulated: mode === 'DEMO',
    });

    const newAudit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: currentUser.username,
      role: currentUser.role,
      action: 'SERIAL_CONNECT',
      target: port,
      metadata: { baudRate: baud, mode },
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  const disconnectSerial = () => {
    setSerialBridge((prev) => ({
      ...prev,
      connected: false,
      statusMessage: 'Serial connection closed by user.',
    }));

    const newAudit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: currentUser.username,
      role: currentUser.role,
      action: 'SERIAL_DISCONNECT',
      target: serialBridge.port,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const sendMessage = useCallback(
    async (
      from: NodeId,
      to: NodeId,
      payload: string,
      priority: MessagePriority,
      isTestPing = false
    ): Promise<Message> => {
      const msgID = demoSimulator.getNextMsgId();
      const nowStr = new Date().toLocaleTimeString();

      const newMsg: Message = {
        id: `msg_${Date.now()}_${msgID}`,
        msgID,
        from,
        to,
        payload,
        priority,
        status: 'QUEUED',
        timestamp: nowStr,
        relayCount: 0,
        isDemo: mode === 'DEMO',
        isTestPing,
        hops: [
          {
            node: from,
            action: isTestPing ? 'Test Ping Initiated' : 'Message Queued for LoRa Transfer',
            timestamp: nowStr,
          },
        ],
      };

      // Map to backend wire format: 'TEAM_A' -> 'A', 'TEAM_B' -> 'B'
      const backendFrom = from === 'TEAM_A' ? 'A' : from === 'TEAM_B' ? 'B' : from;
      const backendTo = to === 'TEAM_A' ? 'A' : to === 'TEAM_B' ? 'B' : to;

      let submittedMessage = newMsg;
      try {
        const response = await api.post('/messages', {
          from: backendFrom,
          to: backendTo,
          payload,
          priority: priority.toLowerCase(),
          type: isTestPing ? 'PING' : 'MSG',
        });
        if (mode === 'LIVE') {
          submittedMessage = mapBackendMessage(response, newMsg);
        }
      } catch (err: any) {
        if (mode === 'LIVE') {
          const failureReason = String(err?.message || 'Live transmission failed.');
          const failedMsg: Message = {
            ...newMsg,
            status: 'FAILED',
            failureReason,
            hops: [
              ...newMsg.hops,
              {
                node: from,
                action: `Failed: ${failureReason}`,
                timestamp: nowStr,
              },
            ],
          };
          setMessages((prev) => [failedMsg, ...prev]);
          setActiveTransmission(failedMsg);
          setTimeout(() => {
            setActiveTransmission((current) => current?.id === failedMsg.id ? null : current);
          }, 3000);
          const failureNotif: NotificationItem = {
            id: `notif_fail_${Date.now()}`,
            title: 'Live Transmission Failed',
            message: `Could not transmit to ${to}: ${failureReason}`,
            severity: 'critical',
            timestamp: nowStr,
            read: false,
            relatedMsgId: msgID,
            isDemo: false,
          };
          setNotifications((prev) => [failureNotif, ...prev]);
          throw err;
        }
      }

      setMessages((prev) => [submittedMessage, ...prev]);
      setActiveTransmission(submittedMessage);

      // Audit Log
      const audit: AuditLogEntry = {
        id: `aud_${Date.now()}`,
        timestamp: nowStr,
        actor: currentUser.username,
        role: currentUser.role,
        action: isTestPing ? 'SEND_TEST_PING' : 'SEND_MESSAGE',
        target: `${from} -> ${to}`,
        metadata: { msgID: submittedMessage.msgID, payload, priority, isDemo: mode === 'DEMO' },
      };
      setAuditLogs((prev) => [audit, ...prev]);

      // Sound notification for critical messages
      if (soundEnabled && priority === 'CRITICAL' && !isTestPing) {
        audioAlert.playCriticalAlert();
      }

      // Add notification
      if (!isTestPing) {
        const notif: NotificationItem = {
          id: `notif_${Date.now()}`,
          title: priority === 'CRITICAL' ? 'CRITICAL Priority Alert' : 'Message Dispatched',
          message: `${from} -> ${to}: "${payload.slice(0, 45)}${payload.length > 45 ? '...' : ''}"`,
          severity: priority === 'CRITICAL' ? 'critical' : priority === 'URGENT' ? 'warning' : 'info',
          timestamp: nowStr,
          read: false,
          relatedMsgId: msgID,
          isDemo: mode === 'DEMO',
        };
        setNotifications((prev) => [notif, ...prev]);
      }

      if (mode === 'DEMO') {
        // Only the isolated demo session may synthesize relay and ACK events.
        demoSimulator.simulateHopTransmission(submittedMessage, {
          onMessageUpdate: (updatedMsg) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
            setActiveTransmission(updatedMsg);
          },
          onEvent: (event) => {
            setEvents((prev) => [event, ...prev]);
          },
          onAckReceived: (ackedMsg) => {
            if (soundEnabled) {
              audioAlert.playAckPing();
            }
            setTimeout(() => {
              setActiveTransmission((curr) => (curr?.id === ackedMsg.id ? null : curr));
            }, 3000);
          },
        });
      }

      return submittedMessage;
    },
    [currentUser, mode, soundEnabled]
  );

  const resendMessage = async (messageId: string) => {
    const existing = messages.find((m) => m.id === messageId);
    if (!existing) return;
    await sendMessage(
      existing.from,
      existing.to,
      existing.payload,
      existing.priority,
      existing.isTestPing
    );
  };

  const sendTestPing = async (from?: NodeId, to?: NodeId): Promise<Message> => {
    const defaultFrom: NodeId =
      currentUser.role === 'operator' && currentUser.team === 'B' ? 'TEAM_B' : 'TEAM_A';
    const resolvedFrom = from ?? defaultFrom;
    const resolvedTo = to ?? (resolvedFrom === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A');

    return sendMessage(resolvedFrom, resolvedTo, 'PING // LORA DIAGNOSTIC PROBE', 'ROUTINE', true);
  };

  const exportMessagesCsv = () => {
    const headers = ['Timestamp', 'Message ID', 'From', 'To', 'Payload', 'Priority', 'Status', 'Relay Count', 'ACK Received', 'Is Demo'];
    const rows = messages.map((m) => [
      `"${m.timestamp}"`,
      m.msgID,
      m.from,
      m.to,
      `"${m.payload.replace(/"/g, '""')}"`,
      m.priority,
      m.status,
      m.relayCount,
      `"${m.ackReceivedAt || 'N/A'}"`,
      m.isDemo ? 'YES' : 'NO',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `skybridge_messages_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        theme,
        currentUser,
        users: INITIAL_USERS,
        messages,
        devices,
        events,
        notifications,
        auditLogs,
        serialBridge,
        soundEnabled,
        reducedMotion,
        activeTransmission,
        activeTab,
        kioskMode,
        focusMode,
        density,
        highContrast,
        hasActiveCritical,
        unacknowledgedCriticalCount,
        setActiveTab,
        setTheme,
        setSoundEnabled,
        setReducedMotion,
        setCurrentUser,
        toggleDemoMode,
        toggleKioskMode,
        toggleFocusMode,
        setDensity,
        toggleHighContrast,
        switchUserRole,
        sendMessage,
        resendMessage,
        sendTestPing,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        connectSerial,
        disconnectSerial,
        exportMessagesCsv,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
