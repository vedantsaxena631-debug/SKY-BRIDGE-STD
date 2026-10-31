export type NodeId = 'TEAM_A' | 'DRONE_RELAY' | 'TEAM_B';

export type MessageStatus = 
  | 'QUEUED'
  | 'SENT_TO_BRIDGE'
  | 'RELAYED'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'FAILED_NO_ACK'
  | 'FAILED';

export type MessagePriority = 'ROUTINE' | 'URGENT' | 'CRITICAL';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  callsign: string;
  team?: 'A' | 'B' | null;
  avatar?: string;
}

export interface Message {
  id: string;
  msgID: number;
  from: NodeId;
  to: NodeId;
  payload: string;
  priority: MessagePriority;
  status: MessageStatus;
  timestamp: string;
  relayCount: number;
  isDemo: boolean;
  isTestPing?: boolean;
  ackReceivedAt?: string;
  failureReason?: string;
  hops?: {
    node: NodeId;
    action: string;
    timestamp: string;
  }[];
}

export interface DeviceNode {
  id: NodeId;
  name: string;
  role: string;
  type: 'GROUND_NODE' | 'AERIAL_RELAY';
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE';
  lastSeen: string;
  hardware: {
    mcu: string;
    loraModule: string;
    frequency: string;
    antenna: string;
    powerSource: string;
  };
  uptimePercent: number; // Derived honestly from recorded heartbeat logs
  heartbeatsCount: number;
  firmwareVersion: string; // Ground truth: "v1.2.0-esp32-sx1278" or "Not provided by hardware"
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'INFO' | 'RELAY' | 'ACK' | 'ALERT' | 'WARNING' | 'SYSTEM';
  message: string;
  sourceNode?: NodeId;
  isDemo: boolean;
  priority?: MessagePriority;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  relatedMsgId?: number;
  isDemo: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  target: string;
  metadata?: Record<string, any>;
}

export interface SerialBridgeState {
  connected: boolean;
  port: string;
  baudRate: number;
  lastPacketTime?: string;
  reconnectAttempts: number;
  statusMessage: string;
  isSimulated: boolean;
}

export interface SubsystemHealth {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  description: string;
  details: string;
}
