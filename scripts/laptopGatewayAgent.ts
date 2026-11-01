/**
 * Bridges both USB-connected ESP32 LoRa stations to the live SkyBridge API.
 * Team A and Team B use the same newline-delimited JSON protocol as firmware.
 */
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

type NodeId = 'A' | 'B';
type NetworkNodeId = NodeId | 'DRONE';
type PendingState = 'awaiting_ack' | 'busy_wait' | 'ack_pending' | 'failure_pending';
type GatewayNodeMode = NodeId | 'BOTH';

interface GatewayPort {
  nodeId: NodeId;
  port: SerialPort;
  ready: boolean;
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
const SERIAL_PORTS: Record<NodeId, string> = {
  A: process.env.SERIAL_PORT_A || process.env.SERIAL_PORT || 'COM8',
  B: process.env.SERIAL_PORT_B || 'COM12',
};
const MAX_PAYLOAD_BYTES = 179;
const ACK_TIMEOUT_MS = 8000;
const MAX_RADIO_ATTEMPTS = 3;
const HOST_BUSY_RETRY_MS = 1000;
const HOST_BUSY_MAX_WAIT_MS = 10000;

const gatewayPorts = new Map<NodeId, GatewayPort>();
const pendingTransmissions = new Map<number, PendingTransmission>();
let outboxPollInProgress = false;
let pendingSweepInProgress = false;
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
      ' msgID=' + msgID + ' via ' + SERIAL_PORTS[pending.nodeId] + '.');
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
    if (packet.event === 'NODE_ONLINE') {
      state.ready = true;
      console.log('[serial ' + state.nodeId + '] radio initialized on ' + SERIAL_PORTS[state.nodeId] + '.');
      await sendCloudEvent({ event: 'heartbeat', nodeId: state.nodeId });
    } else if (packet.event === 'RADIO_INIT_FAILED') {
      state.ready = false;
      console.error('[serial ' + state.nodeId + '] radio initialization failed:', packet.details || 'Unknown hardware error.');
    }
    return;
  }

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

function openNodePort(nodeId: NodeId): void {
  const portName = SERIAL_PORTS[nodeId];
  try {
    const port = new SerialPort({ path: portName, baudRate: BAUD_RATE });
    const state: GatewayPort = { nodeId, port, ready: false };
    gatewayPorts.set(nodeId, state);

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', (raw: string) => {
      void handleSerialLine(state, raw);
    });

    port.on('open', () => {
      console.log('[serial ' + nodeId + '] connected to ' + portName + ' @ ' + BAUD_RATE + '.');
      // Reboot the station after attaching so its one-time NODE_ONLINE event is not missed.
      port.set({ dtr: false, rts: false }, (lineError) => {
        if (lineError) {
          console.warn('[serial ' + nodeId + '] could not initialize reset lines:', lineError.message);
          return;
        }
        setTimeout(() => {
          port.set({ rts: true }, (resetError) => {
            if (resetError) console.warn('[serial ' + nodeId + '] reset pulse failed:', resetError.message);
          });
        }, 200);
        setTimeout(() => {
          port.set({ rts: false }, (releaseError) => {
            if (releaseError) console.warn('[serial ' + nodeId + '] reset release failed:', releaseError.message);
          });
        }, 350);
      });
    });
    port.on('close', () => {
      state.ready = false;
      console.error('[serial ' + nodeId + '] ' + portName + ' closed; waiting for gateway restart.');
    });
    port.on('error', (error: Error) => {
      state.ready = false;
      console.error('[serial ' + nodeId + '] ' + portName + ' error:', error.message);
    });
  } catch (error: any) {
    console.error('[serial ' + nodeId + '] could not open ' + portName + ':', error?.message || error);
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
    .map((state) => state.nodeId);
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
      console.log('[Cloud -> LoRa] Dispatched ' + from + ' to ' + to + ' msgID=' + msgID + ' via ' + SERIAL_PORTS[from] + '.');
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
  if (ACTIVE_NODES.length === 2 && SERIAL_PORTS.A === SERIAL_PORTS.B) {
    console.error('[cloud-agent] Team A and Team B cannot share the same serial port.');
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('      SKYBRIDGE TWO-TEAM CLOUD-TO-HARDWARE GATEWAY          ');
  console.log('============================================================\n');
  console.log('Cloud Server Target : ' + CLOUD_API_URL);
  console.log('Gateway Client ID   : ' + GATEWAY_ID);
  console.log('Gateway Team Mode   : ' + GATEWAY_NODE_MODE);
  for (const nodeId of ACTIVE_NODES) {
    console.log('Team ' + nodeId + ' Radio Port   : ' + SERIAL_PORTS[nodeId] + ' @ ' + BAUD_RATE + ' baud');
  }
  console.log('');

  for (const nodeId of ACTIVE_NODES) openNodePort(nodeId);

  setInterval(() => {
    for (const state of gatewayPorts.values()) {
      if (state.ready && state.port.isOpen) {
        void sendCloudEvent({ event: 'heartbeat', nodeId: state.nodeId });
      }
    }
  }, 10000);
  setInterval(() => void pollOutbox(), 1200);
  setInterval(() => void sweepPendingTransmissions(), 1000);

  console.log('[cloud-agent] Gateway is listening for both team radios.');
}

startGateway();
