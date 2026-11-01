/**
 * Bridges both USB-connected ESP32 LoRa stations to the live SkyBridge API.
 * Team A and Team B use the same newline-delimited JSON protocol as firmware.
 */
import 'dotenv/config';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

type NodeId = 'A' | 'B';
type NetworkNodeId = NodeId | 'DRONE';
type PendingState = 'awaiting_ack' | 'busy_wait' | 'ack_pending' | 'failure_pending';
type GatewayNodeMode = NodeId | 'BOTH';

interface GatewayPort {
  nodeId: NodeId | null;
  expectedNodeId: NodeId | null;
  portName: string;
  port: SerialPort;
  ready: boolean;
  validationTimer: ReturnType<typeof setTimeout> | null;
}

interface PendingTransmission {
  nodeId: NodeId;
  targetNodeId: NodeId;
  serialLine: string;
  attempts: number;
  startedAt: number;
  lastEventAttemptAt: number;
  busySince: number | null;
  busyRetryTimer: ReturnType<typeof setTimeout> | null;
  state: PendingState;
}

const CLOUD_API_URL = (process.env.CLOUD_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || 'skybridge-gateway-secret-token-2026';
const GATEWAY_ID = process.env.GATEWAY_ID || 'gateway_' + (process.env.COMPUTERNAME || 'laptop');
const BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE || 115200);
const configuredNodeMode = (process.env.GATEWAY_NODE || 'BOTH').toUpperCase();
if (configuredNodeMode !== 'A' && configuredNodeMode !== 'B' && configuredNodeMode !== 'BOTH') {
  throw new Error('GATEWAY_NODE must be A, B, or BOTH.');
}
const GATEWAY_NODE_MODE = configuredNodeMode as GatewayNodeMode;
const ACTIVE_NODES: NodeId[] = GATEWAY_NODE_MODE === 'BOTH' ? ['A', 'B'] : [GATEWAY_NODE_MODE];
const SERIAL_PORTS: Partial<Record<NodeId, string>> = {
  A: process.env.SERIAL_PORT_A?.trim() || undefined,
  B: process.env.SERIAL_PORT_B?.trim() || undefined,
};
const GENERIC_SERIAL_PORT = process.env.SERIAL_PORT?.trim() || '';
const ESP_USB_BRIDGE_IDS = new Set(['303a', '10c4', '1a86', '0403', '067b']);
const MAX_PAYLOAD_BYTES = 179;
const ACK_TIMEOUT_MS = 8000;
const MAX_RADIO_ATTEMPTS = 3;
const HOST_BUSY_RETRY_MS = 1000;
const HOST_BUSY_MAX_WAIT_MS = 10000;

const gatewayPorts = new Map<NodeId, GatewayPort>();
const gatewayPortsByPath = new Map<string, GatewayPort>();
const rejectedPorts = new Map<string, number>();
const pendingTransmissions = new Map<number, PendingTransmission>();
let outboxPollInProgress = false;
let pendingSweepInProgress = false;
let portScanInProgress = false;
let outboxWarned = false;

function nodeFromName(raw: unknown): NetworkNodeId | null {
  const tokens = String(raw ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.some((token) => token === 'DRONE' || token === 'RELAY' || token === 'REPEATER')) return 'DRONE';
  const last = tokens[tokens.length - 1];
  return last === 'A' || last === 'B' ? last : null;
}

function callsign(nodeId: NodeId): string {
  return 'TEAM_' + nodeId;
}

function serialPortName(nodeId: NodeId): string {
  return gatewayPorts.get(nodeId)?.portName || SERIAL_PORTS[nodeId] || GENERIC_SERIAL_PORT || 'auto-detected port';
}

function normalizePriority(raw: unknown): string {
  const priority = String(raw || 'ROUTINE').toUpperCase();
  if (priority.includes('CRIT') || priority.includes('EMERG')) return 'CRITICAL';
  if (priority.includes('URG')) return 'URGENT';
  return 'ROUTINE';
}

async function sendCloudEvent(eventData: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch(CLOUD_API_URL + '/gateway/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': GATEWAY_SECRET,
      },
      body: JSON.stringify({ ...eventData, gatewayId: GATEWAY_ID }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.warn('[cloud-agent] Event ' + String(eventData.event) + ' notice (' + response.status + '):', body.error || response.statusText);
    }
    return response.ok;
  } catch (error: any) {
    console.error('[cloud-agent] Network error posting event to cloud:', error?.message || error);
    return false;
  }
}

async function resolvePendingTransmission(
  msgID: number,
  event: 'delivered' | 'failed',
  failureReason?: string
): Promise<void> {
  const pending = pendingTransmissions.get(msgID);
  if (!pending) return;

  if (pending.busyRetryTimer) clearTimeout(pending.busyRetryTimer);
  pending.busyRetryTimer = null;
  pending.state = event === 'delivered' ? 'ack_pending' : 'failure_pending';
  pending.lastEventAttemptAt = Date.now();
  if (await sendCloudEvent({ event, msgID, ...(failureReason ? { failureReason } : {}) })) {
    pendingTransmissions.delete(msgID);
    console.log('[LoRa -> Cloud] Message ' + msgID + ' ' + event + '.');
  }
}

async function retryTransmission(msgID: number, reason: string): Promise<void> {
  const pending = pendingTransmissions.get(msgID);
  if (!pending) return;

  if (pending.attempts >= MAX_RADIO_ATTEMPTS) {
    console.warn('[LoRa] msgID=' + msgID + ' failed after ' + pending.attempts + ' radio attempts (' + reason + ').');
    await resolvePendingTransmission(msgID, 'failed', reason);
    return;
  }

  const portState = gatewayPorts.get(pending.nodeId);
  if (!portState?.ready || !portState.port.isOpen) {
    pending.startedAt = Date.now() - ACK_TIMEOUT_MS - 1;
    console.warn('[LoRa] msgID=' + msgID + ' retry waiting for Team ' + pending.nodeId + ' serial link.');
    return;
  }

  if (pending.busyRetryTimer) clearTimeout(pending.busyRetryTimer);
  pending.busyRetryTimer = null;
  pending.attempts += 1;
  pending.state = 'awaiting_ack';
  pending.startedAt = Date.now();
  pending.lastEventAttemptAt = pending.startedAt;
  pending.busySince = null;
  console.warn('[LoRa] msgID=' + msgID + ' ' + reason + '; retrying attempt ' + pending.attempts + '/' + MAX_RADIO_ATTEMPTS + '.');

  try {
    await writeSerialLine(portState, pending.serialLine);
    console.log('[Cloud -> LoRa] Retrying ' + pending.nodeId + ' to ' + pending.targetNodeId +
      ' msgID=' + msgID + ' via ' + serialPortName(pending.nodeId) + '.');
  } catch (error: any) {
    console.error('[serial ' + pending.nodeId + '] retry write failed for msgID=' + msgID + ':', error?.message || error);
    pending.startedAt = Date.now() - ACK_TIMEOUT_MS - 1;
  }
}

function retryWhenHostIsBusy(msgID: number): void {
  const pending = pendingTransmissions.get(msgID);
  if (!pending) return;

  pending.busySince ??= Date.now();
  if (Date.now() - pending.busySince >= HOST_BUSY_MAX_WAIT_MS) {
    void resolvePendingTransmission(msgID, 'failed', 'Radio host remained busy for 10 seconds.');
    return;
  }

  if (pending.attempts > 0) pending.attempts -= 1; // HOST_CMD_BUSY means no radio transmission occurred.
  pending.state = 'busy_wait';
  if (pending.busyRetryTimer) return;

  pending.busyRetryTimer = setTimeout(() => {
    pending.busyRetryTimer = null;
    if (pendingTransmissions.get(msgID) !== pending || pending.state !== 'busy_wait') return;

    const portState = gatewayPorts.get(pending.nodeId);
    if (!portState?.ready || !portState.port.isOpen) {
      retryWhenHostIsBusy(msgID);
      return;
    }

    pending.attempts += 1;
    pending.state = 'awaiting_ack';
    pending.startedAt = Date.now();
    void writeSerialLine(portState, pending.serialLine).catch((error: any) => {
      console.error('[serial ' + pending.nodeId + '] busy retry write failed for msgID=' + msgID + ':', error?.message || error);
      retryWhenHostIsBusy(msgID);
    });
  }, HOST_BUSY_RETRY_MS);
}

async function handleSerialLine(state: GatewayPort, raw: string): Promise<void> {
  const line = raw.trim();
  if (!line) return;

  let packet: any;
  try {
    packet = JSON.parse(line);
  } catch {
    console.warn('[serial ' + state.nodeId + '] ignored non-JSON line:', line.slice(0, 100));
    return;
  }

  if (!packet || typeof packet !== 'object') return;

  if (packet.type === 'SYSTEM_EVENT') {
    if (packet.event === 'NODE_ONLINE' && packet.radioReady === true) {
      const nodeId = nodeFromName(packet.nodeId);
      if (!nodeId || nodeId === 'DRONE' || !ACTIVE_NODES.includes(nodeId) ||
          (state.expectedNodeId && state.expectedNodeId !== nodeId)) {
        void rejectGatewayPort(state, 'Firmware reported an unsupported or unexpected node identity.');
        return;
      }

      const existing = gatewayPorts.get(nodeId);
      if (existing && existing !== state) {
        void rejectGatewayPort(state, 'Another USB port already owns Team ' + nodeId + '.');
        return;
      }

      if (state.validationTimer) clearTimeout(state.validationTimer);
      state.validationTimer = null;
      state.nodeId = nodeId;
      state.ready = true;
      gatewayPorts.set(nodeId, state);
      console.log('[serial ' + nodeId + '] SX1278 radio initialized on ' + state.portName + '.');
      await sendCloudEvent({ event: 'heartbeat', nodeId });
    } else if (packet.event === 'RADIO_INIT_FAILED') {
      void rejectGatewayPort(state, packet.details || 'SX1278 radio initialization failed.');
    }
    return;
  }

  if (!state.ready || !state.nodeId) return;

  if (packet.type === 'HEARTBEAT') {
    const nodeId = nodeFromName(packet.from);
    if (nodeId) await sendCloudEvent({ event: 'heartbeat', nodeId });
    return;
  }

  if (packet.type === 'MSG') {
    const from = nodeFromName(packet.from);
    const to = nodeFromName(packet.to);
    const msgID = Number(packet.msgID);
    if (!from || !to || from === to || !Number.isSafeInteger(msgID) || msgID <= 0 ||
        typeof packet.payload !== 'string' || !packet.payload.trim() ||
        Buffer.byteLength(packet.payload, 'utf8') > MAX_PAYLOAD_BYTES) {
      console.warn('[serial ' + state.nodeId + '] ignored invalid message packet.');
      return;
    }

    console.log('[LoRa -> Cloud] Received ' + from + ' to ' + to + ' msgID=' + msgID + '.');
    await sendCloudEvent({
      event: 'received',
      from,
      to,
      payload: packet.payload,
      msgID,
    });
    return;
  }

  if (packet.type === 'ACK') {
    const msgID = Number(packet.msgID);
    if (Number.isSafeInteger(msgID) && msgID > 0) {
      const pending = pendingTransmissions.get(msgID);
      // Both radios echo ACK packets to USB: the target when it transmits one,
      // and the source when it actually receives one. Only the source-side echo
      // proves end-to-end delivery.
      if (pending && pending.nodeId !== state.nodeId) {
        console.warn('[serial ' + state.nodeId + '] ignored ACK for msgID=' + msgID +
          ' because the sending station has not confirmed receiving it.');
        return;
      }
      if (!pending) return;
      await resolvePendingTransmission(msgID, 'delivered');
    }
    return;
  }

  if (packet.type === 'STATUS') {
    const msgID = Number(packet.msgID);
    const status = String(packet.payload || packet.status || '').toUpperCase();
    if (!Number.isSafeInteger(msgID) || msgID <= 0) return;

    const pending = pendingTransmissions.get(msgID);
    if (pending && pending.nodeId !== state.nodeId && pending.targetNodeId !== state.nodeId) {
      console.warn('[serial ' + state.nodeId + '] ignored STATUS for msgID=' + msgID + ' from an unrelated station.');
      return;
    }

    if (status === 'HOST_CMD_BUSY') {
      console.warn('[serial ' + state.nodeId + '] host is busy for msgID=' + msgID + '; waiting to retry.');
      retryWhenHostIsBusy(msgID);
    } else if (status === 'HOST_CMD_REJECTED') {
      await resolvePendingTransmission(msgID, 'failed', status);
    } else if (status === 'FAILED_NO_ACK' || status === 'RADIO_TX_FAILED') {
      await retryTransmission(msgID, status);
    } else if (status === 'RADIO_ACK_TX_FAILED') {
      console.warn('[serial ' + state.nodeId + '] receiver could not transmit ACK for msgID=' + msgID + '.');
    }
  }
}

async function rejectGatewayPort(state: GatewayPort, reason: string): Promise<void> {
  if (state.validationTimer) clearTimeout(state.validationTimer);
  state.validationTimer = null;
  state.ready = false;
  if (state.nodeId && gatewayPorts.get(state.nodeId) === state) {
    gatewayPorts.delete(state.nodeId);
  }
  state.nodeId = null;
  rejectedPorts.set(state.portName, Date.now() + 30000);
  console.warn('[serial] ignored ' + state.portName + ': ' + reason);
  if (state.port.isOpen) {
    await new Promise<void>((resolve) => state.port.close(() => resolve()));
  }
}

function openNodePort(portName: string, expectedNodeId: NodeId | null): void {
  if (gatewayPortsByPath.has(portName)) return;
  try {
    const port = new SerialPort({ path: portName, baudRate: BAUD_RATE, autoOpen: false });
    const state: GatewayPort = {
      nodeId: null,
      expectedNodeId,
      portName,
      port,
      ready: false,
      validationTimer: null,
    };
    gatewayPortsByPath.set(portName, state);

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', (raw: string) => {
      void handleSerialLine(state, raw);
    });

    port.on('open', () => {
      console.log('[serial] probing USB device on ' + portName + ' @ ' + BAUD_RATE + '.');
      state.validationTimer = setTimeout(() => {
        if (!state.ready) void rejectGatewayPort(state, 'No LoRa-ready firmware response.');
      }, 4500);

      // Reboot after attaching so the firmware reports the result of SX1278 initialization.
      port.set({ dtr: false, rts: false }, (lineError) => {
        if (lineError) {
          console.warn('[serial] reset lines unavailable on ' + portName + ':', lineError.message);
          return;
        }
        setTimeout(() => {
          port.set({ rts: true }, (resetError) => {
            if (resetError) console.warn('[serial] reset pulse failed on ' + portName + ':', resetError.message);
          });
        }, 200);
        setTimeout(() => {
          port.set({ rts: false }, (releaseError) => {
            if (releaseError) console.warn('[serial] reset release failed on ' + portName + ':', releaseError.message);
          });
        }, 350);
      });
    });
    port.on('close', () => {
      if (state.validationTimer) clearTimeout(state.validationTimer);
      state.validationTimer = null;
      state.ready = false;
      if (state.nodeId && gatewayPorts.get(state.nodeId) === state) {
        gatewayPorts.delete(state.nodeId);
      }
      gatewayPortsByPath.delete(portName);
      console.log('[serial] USB device removed from ' + portName + '.');
    });
    port.on('error', (error: Error) => {
      state.ready = false;
      console.error('[serial] ' + portName + ' error:', error.message);
    });
    port.open((error) => {
      if (error) {
        gatewayPortsByPath.delete(portName);
        rejectedPorts.set(portName, Date.now() + 5000);
        console.warn('[serial] could not open ' + portName + ':', error.message);
      }
    });
  } catch (error: any) {
    gatewayPortsByPath.delete(portName);
    rejectedPorts.set(portName, Date.now() + 5000);
    console.warn('[serial] could not probe ' + portName + ':', error?.message || error);
  }
}

async function scanSerialPorts(): Promise<void> {
  if (portScanInProgress) return;
  portScanInProgress = true;
  try {
    const ports = await SerialPort.list();
    const presentPaths = new Set(ports.map((candidate) => candidate.path));
    for (const rejectedPath of rejectedPorts.keys()) {
      if (!presentPaths.has(rejectedPath)) rejectedPorts.delete(rejectedPath);
    }
    const expectedByPath = new Map<string, NodeId>();
    for (const nodeId of ['A', 'B'] as const) {
      const path = SERIAL_PORTS[nodeId];
      if (path) expectedByPath.set(path, nodeId);
    }

    const now = Date.now();
    const candidates = [...ports].sort((left, right) => {
      const leftConfigured = expectedByPath.has(left.path) || left.path === GENERIC_SERIAL_PORT;
      const rightConfigured = expectedByPath.has(right.path) || right.path === GENERIC_SERIAL_PORT;
      return Number(rightConfigured) - Number(leftConfigured);
    });
    for (const candidate of candidates) {
      const portName = candidate.path;
      if (gatewayPortsByPath.has(portName)) continue;
      if ((rejectedPorts.get(portName) || 0) > now) continue;

      const expectedNodeId = expectedByPath.get(portName) || null;
      const isConfigured = Boolean(expectedNodeId) || portName === GENERIC_SERIAL_PORT;
      const vendorId = String(candidate.vendorId || '').toLowerCase().replace(/^0x/, '');
      if (!isConfigured && !ESP_USB_BRIDGE_IDS.has(vendorId)) continue;
      if (expectedNodeId && !ACTIVE_NODES.includes(expectedNodeId)) continue;
      openNodePort(portName, expectedNodeId);
    }
  } catch (error: any) {
    console.warn('[serial] USB port scan failed:', error?.message || error);
  } finally {
    portScanInProgress = false;
  }
}

function writeSerialLine(state: GatewayPort, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    state.port.write(line, (writeError) => {
      if (writeError) return reject(writeError);
      state.port.drain((drainError) => drainError ? reject(drainError) : resolve());
    });
  });
}

async function pollOutbox(): Promise<void> {
  if (outboxPollInProgress || pendingTransmissions.size > 0) return;

  const availableNodes = Array.from(gatewayPorts.values())
    .filter((state) => state.ready && state.port.isOpen)
    .map((state) => state.nodeId)
    .filter((nodeId): nodeId is NodeId => nodeId !== null);
  if (availableNodes.length === 0) return;

  outboxPollInProgress = true;
  try {
    const query = new URLSearchParams({ gatewayId: GATEWAY_ID, nodes: availableNodes.join(',') });
    const response = await fetch(CLOUD_API_URL + '/gateway/outbox?' + query.toString(), {
      headers: { 'x-gateway-secret': GATEWAY_SECRET },
    });

    if (!response.ok) {
      if (!outboxWarned) {
        outboxWarned = true;
        console.warn('[cloud-agent] Cannot read outbox (' + response.status + ').');
      }
      return;
    }
    outboxWarned = false;

    const data = await response.json();
    const message = data?.message;
    if (!message) return;

    const from = nodeFromName(message.from);
    const to = nodeFromName(message.to);
    const fromNode: NodeId | null = from === 'A' || from === 'B' ? from : null;
    const toNode: NodeId | null = to === 'A' || to === 'B' ? to : null;
    const msgID = Number(message.msgID);
    const state = fromNode ? gatewayPorts.get(fromNode) : undefined;

    if (!state || !fromNode || !toNode || fromNode === toNode || !state.ready || !state.port.isOpen ||
        !Number.isSafeInteger(msgID) || msgID <= 0 || typeof message.payload !== 'string' ||
        !message.payload.trim() || Buffer.byteLength(message.payload, 'utf8') > MAX_PAYLOAD_BYTES) {
      console.warn('[cloud-agent] Outbox packet cannot be sent; reporting failure for msgID=' + String(message.msgID) + '.');
      await sendCloudEvent({ event: 'failed', msgID });
      return;
    }

    const serialPacket = {
      from: callsign(fromNode),
      to: callsign(toNode),
      msgID,
      payload: message.payload,
      priority: normalizePriority(message.priority),
      relayCount: 0,
      type: 'MSG',
    };
    const pending: PendingTransmission = {
      nodeId: fromNode,
      targetNodeId: toNode,
      serialLine: JSON.stringify(serialPacket) + '\n',
      attempts: 1,
      startedAt: Date.now(),
      lastEventAttemptAt: Date.now(),
      busySince: null,
      busyRetryTimer: null,
      state: 'awaiting_ack',
    };
    pendingTransmissions.set(msgID, pending);

    // Mark the lease as dispatched before the radio can return a fast ACK.
    if (!await sendCloudEvent({ event: 'dispatched', msgID })) {
      pendingTransmissions.delete(msgID);
      return;
    }

    try {
      await writeSerialLine(state, pending.serialLine);
      console.log('[Cloud -> LoRa] Dispatched ' + from + ' to ' + to + ' msgID=' + msgID + ' via ' + serialPortName(fromNode) + '.');
    } catch (error: any) {
      console.error('[serial ' + from + '] write failed for msgID=' + msgID + ':', error?.message || error);
      await retryTransmission(msgID, 'serial write failed');
    }
  } catch (error: any) {
    console.error('[cloud-agent] Outbox polling error:', error?.message || error);
  } finally {
    outboxPollInProgress = false;
  }
}

async function sweepPendingTransmissions(): Promise<void> {
  if (pendingSweepInProgress) return;
  pendingSweepInProgress = true;
  try {
    const now = Date.now();
    for (const [msgID, pending] of pendingTransmissions) {
      if (pending.state === 'awaiting_ack' && now - pending.startedAt > ACK_TIMEOUT_MS) {
        await retryTransmission(msgID, 'ACK timeout');
      } else if (pending.state !== 'awaiting_ack' && now - pending.lastEventAttemptAt > 2000) {
        if (pending.state === 'busy_wait') continue;
        const event = pending.state === 'ack_pending' ? 'delivered' : 'failed';
        await resolvePendingTransmission(msgID, event);
      }
    }
  } finally {
    pendingSweepInProgress = false;
  }
}

function startGateway(): void {
  if (SERIAL_PORTS.A && SERIAL_PORTS.B && SERIAL_PORTS.A === SERIAL_PORTS.B) {
    console.error('[cloud-agent] Team A and Team B cannot share the same serial port.');
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('      SKYBRIDGE TWO-TEAM CLOUD-TO-HARDWARE GATEWAY          ');
  console.log('============================================================\n');
  console.log('Cloud Server Target : ' + CLOUD_API_URL);
  console.log('Gateway Client ID   : ' + GATEWAY_ID);
  console.log('Gateway Team Mode   : ' + GATEWAY_NODE_MODE);
  console.log('Serial Port Scan    : enabled (SX1278-ready firmware required)');
  console.log('Baud Rate           : ' + BAUD_RATE);

  void scanSerialPorts();
  setInterval(() => void scanSerialPorts(), 1000);

  setInterval(() => {
    for (const state of gatewayPorts.values()) {
      if (state.ready && state.nodeId && state.port.isOpen) {
        void sendCloudEvent({ event: 'heartbeat', nodeId: state.nodeId });
      }
    }
  }, 10000);
  setInterval(() => void pollOutbox(), 1200);
  setInterval(() => void sweepPendingTransmissions(), 1000);

  console.log('[cloud-agent] Gateway is waiting for Team A/Team B USB LoRa hardware.');
}

startGateway();
