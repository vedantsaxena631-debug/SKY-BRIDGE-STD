import { EventEmitter } from 'events';
import { Message } from '../models/Message';
import { Device } from '../models/Device';
import { SystemEvent } from '../models/SystemEvent';
import { generateCorrelationId, logTrace } from '../utils/trace';

const VALID_NODES = ['A', 'B', 'DRONE'];
const VALID_TYPES = ['MSG', 'ACK', 'HEARTBEAT', 'PING', 'STATUS'];
const ESP_USB_BRIDGE_IDS = new Set(['303a', '10c4', '1a86', '0403', '067b']);

/**
 * Maps a callsign such as "TEAM_A", "A", "Node B" or "DRONE RELAY" to A, B or DRONE.
 * Matches whole tokens only, so "TEAM_B" can never be mistaken for Team A.
 */
export function nodeFromName(raw: unknown): 'A' | 'B' | 'DRONE' | null {
  const tokens = String(raw ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t === 'DRONE' || t === 'RELAY' || t === 'REPEATER')) return 'DRONE';
  const last = tokens[tokens.length - 1];
  return last === 'A' || last === 'B' ? last : null;
}

export class SerialService extends EventEmitter {
  public port: any = null;
  public parser: any = null;
  public connected: boolean = false;
  public portPath: string | null = null;
  public baudRate: number | null = null;
  public reconnectDelay: number = 1000;
  public maxReconnectDelay: number = 30000;
  public reconnectTimer: any = null;
  public shuttingDown: boolean = false;
  public lastError: string | null = null;
  public stats = { linesRead: 0, linesParsed: 0, linesDropped: 0, messagesWritten: 0 };

  // Protocol autodetection & ASCII block parser state
  public detectedProtocol: 'JSON' | 'SB1_ASCII' = 'JSON';
  private _asciiBlock: Record<string, string> = {};
  private _currentBlockType: string = 'NONE';
  private _pendingOutboxMap = new Map<number, { packet: any; sentAt: number }>();

  public verifiedNodeId: 'A' | 'B' | 'DRONE' | null = null;
  private autoDetectTimer: any = null;
  private probeTimer: any = null;
  private autoDetectInProgress = false;
  private autoDetectEnabled = false;
  private rejectedPorts = new Map<string, number>();

  constructor() {
    super();
  }

  async listAvailablePorts() {
    try {
      let SerialPortModule: any;
      try {
        SerialPortModule = await import('serialport' as any);
      } catch {
        return [];
      }
      const SerialPort = SerialPortModule.SerialPort;
      const ports = await SerialPort.list();
      return ports.map((p: any) => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Unknown',
        friendlyName: p.friendlyName || p.path,
        pnpId: p.pnpId,
        vendorId: p.vendorId,
        productId: p.productId,
      }));
    } catch (err: any) {
      console.warn('[serial] listAvailablePorts notice:', err.message);
      return [];
    }
  }

  startAutoDetect(intervalMs: number = 1000) {
    this.autoDetectEnabled = true;
    if (this.autoDetectTimer) return;
    void this._scanForHardware();
    this.autoDetectTimer = setInterval(() => void this._scanForHardware(), intervalMs);
    console.log('[serial] USB hardware auto-detection enabled.');
  }

  private async _scanForHardware() {
    if (!this.autoDetectEnabled || this.connected || this.autoDetectInProgress) return;
    this.autoDetectInProgress = true;
    try {
      const ports = await this.listAvailablePorts();
      const configuredPaths = new Set(
        [process.env.SERIAL_PORT, process.env.SERIAL_PORT_A, process.env.SERIAL_PORT_B]
          .map((path) => (path || '').trim())
          .filter(Boolean)
      );
      const now = Date.now();
      const presentPaths = new Set(ports.map((candidate: any) => candidate.path));
      for (const rejectedPath of this.rejectedPorts.keys()) {
        if (!presentPaths.has(rejectedPath)) this.rejectedPorts.delete(rejectedPath);
      }
      const candidates = [...ports].sort((left: any, right: any) =>
        Number(configuredPaths.has(right.path)) - Number(configuredPaths.has(left.path))
      );
      for (const candidate of candidates) {
        if (this.connected) break;
        const vendorId = String(candidate.vendorId || '').toLowerCase();
        const isConfigured = configuredPaths.has(candidate.path);
        if (!isConfigured && !ESP_USB_BRIDGE_IDS.has(vendorId.replace(/^0x/, ''))) continue;
        if ((this.rejectedPorts.get(candidate.path) || 0) > now) continue;

        const result = await this.connect(
          candidate.path,
          Number(process.env.SERIAL_BAUD_RATE || 115200)
        );
        if (result.connected) break;
        this.rejectedPorts.set(candidate.path, Date.now() + 5000);
      }
    } finally {
      this.autoDetectInProgress = false;
    }
  }

  async connect(
    portPath: string = process.env.SERIAL_PORT || '',
    baudRate: number = Number(process.env.SERIAL_BAUD_RATE || 115200)
  ) {
    if (this.connected) return { connected: true, port: this.portPath };

    if (!portPath) {
      this.lastError = 'SERIAL_PORT is not set in .env';
      console.warn('[serial] no SERIAL_PORT configured - Live Mode will show an empty network.');
      return { connected: false, error: this.lastError };
    }

    this.portPath = portPath;
    this.baudRate = baudRate;

    try {
      let SerialPortModule: any;
      let readlineModule: any;
      try {
        SerialPortModule = await import('serialport' as any);
        readlineModule = await import('@serialport/parser-readline' as any);
      } catch {
        this.lastError = 'serialport module not installed on this host';
        console.warn(`[serial] ${this.lastError}`);
        return { connected: false, error: this.lastError };
      }

      const SerialPort = SerialPortModule.SerialPort;
      const ReadlineParser = readlineModule.ReadlineParser;

      return new Promise<{ connected: boolean; port?: string | null; error?: string }>((resolve) => {
        this.port = new SerialPort({ path: portPath, baudRate, autoOpen: false });

        this.port.open((err: any) => {
          if (err) {
            this.connected = false;
            this.lastError = err.message;
            console.warn(`[serial] could not open ${portPath}: ${err.message}`);
            this.emit('status', this.getStatus());
            this._scheduleReconnect();
            return resolve({ connected: false, error: err.message });
          }

          this.connected = true;
          this.lastError = null;
          this.reconnectDelay = 1000;
          console.log(`[serial] connected on ${portPath} @ ${baudRate}`);

          this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
          this.parser.on('data', (line: string) => this._handleLine(line));

          this.port.on('close', () => {
            this.connected = false;
            this.verifiedNodeId = null;
            if (this.probeTimer) clearTimeout(this.probeTimer);
            this.probeTimer = null;
            console.warn('[serial] port closed');
            this.emit('status', this.getStatus());
            if (!this.shuttingDown) this._scheduleReconnect();
          });

          this.port.on('error', (e: any) => {
            this.lastError = e.message;
            console.error('[serial] error:', e.message);
            this.emit('status', this.getStatus());
          });

          this.emit('status', this.getStatus());
          this._logEvent('serial_connected', `Serial bridge connected on ${portPath}`);
          this._beginHardwareProbe(portPath);
          resolve({ connected: true, port: portPath });
        });
      });
    } catch (e: any) {
      this.connected = false;
      this.lastError = e.message;
      return { connected: false, error: e.message };
    }
  }

  private _scheduleReconnect() {
    if (this.shuttingDown || this.autoDetectEnabled || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    console.log(`[serial] retrying in ${delay / 1000}s`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      await this.connect(this.portPath || undefined, this.baudRate || undefined);
    }, delay);
  }

  async disconnect() {
    this.shuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    if (this.port?.isOpen) {
      await new Promise((r) => this.port.close(r));
    }
    this.connected = false;
    this.verifiedNodeId = null;
    this.port = null;
    this.parser = null;
    this.portPath = null;
    this.shuttingDown = false;
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  getStatus() {
    return {
      connected: this.connected && this.verifiedNodeId !== null,
      port: this.verifiedNodeId ? this.portPath : null,
      baudRate: this.baudRate || null,
      nodeId: this.verifiedNodeId,
      lastError: this.lastError,
      stats: { ...this.stats },
      protocol: this.detectedProtocol,
    };
  }

  private async _handleLine(rawLine: string) {
    this.stats.linesRead += 1;
    const line = rawLine.trim();
    if (!line) return;
    console.log("[serial:rx]", JSON.stringify(line));

    // 1. JSON PROTOCOL SUPPORT
    if (line.startsWith('{')) {
      let packet: any;
      try {
        packet = JSON.parse(line);
      } catch {
        this.stats.linesDropped += 1;
        console.warn('[serial] dropped unparseable line:', line.slice(0, 120));
        return;
      }

      if (packet?.type === 'SYSTEM_EVENT') {
        const nodeId = nodeFromName(packet.nodeId);
        if (packet.event === 'NODE_ONLINE' && packet.radioReady === true && nodeId) {
          this.verifiedNodeId = nodeId;
          if (this.probeTimer) clearTimeout(this.probeTimer);
          this.probeTimer = null;
          if (this.portPath) this.rejectedPorts.delete(this.portPath);
          await this._touchDevice(nodeId);
          this.emit('status', this.getStatus());
          console.log(`[serial] verified LoRa hardware ${nodeId} on ${this.portPath}.`);
        } else if (packet.event === 'RADIO_INIT_FAILED') {
          this.verifiedNodeId = null;
          if (this.portPath) void this._rejectUnverifiedPort(this.portPath, packet.details || 'LoRa radio initialization failed.');
        }
        return;
      }

      if (!this.verifiedNodeId) {
        this.stats.linesDropped += 1;
        return;
      }

      if (!this._isValidPacket(packet)) {
        this.stats.linesDropped += 1;
        console.warn('[serial] dropped invalid packet:', JSON.stringify(packet).slice(0, 120));
        return;
      }

      this.detectedProtocol = 'JSON';
      this.stats.linesParsed += 1;
      const correlationId = generateCorrelationId();

      if (packet.type === 'MSG' || packet.type === 'ACK') {
        logTrace(
          correlationId,
          'serial.in',
          `msgID=${packet.msgID} from=${packet.from || '-'} to=${packet.to || '-'} bytes=${Buffer.byteLength(rawLine, 'utf8')}`
        );
        logTrace(
          correlationId,
          'validate.ok',
          `payload=${packet.payload ? Buffer.byteLength(packet.payload, 'utf8') : 0}B type=${packet.type}`
        );
      }

      try {
        switch (packet.type) {
          case 'HEARTBEAT':
            return await this._handleHeartbeat(packet);
          case 'ACK':
            return await this._handleAck(packet, correlationId);
          case 'STATUS':
            return await this._handleStatus(packet);
          case 'MSG':
          case 'PING':
            return await this._handleMessage(packet, correlationId);
          default:
            return;
        }
      } catch (err: any) {
        console.error('[serial] failed handling packet:', err.message);
      }
      return;
    }

    // Legacy/plain serial text cannot prove the radio initialized, so it is
    // ignored for node presence and hardware message handling.
    if (!this.verifiedNodeId) return;

    // 2. SB1 ASCII PROTOCOL SUPPORT (Standard SkyBridge ESP32 firmware)
    await this._handleAsciiLine(line);
  }

  private async _handleAsciiLine(line: string) {
    // Detect board identity and peer from boot banners and status lines.
    // Callsigns are matched as whole tokens: "TEAM_B" must never count as Team A.
    const isPayloadLine = /^(MESSAGE|FROM|TO|PRIORITY|MESSAGE ID|PACKET ID|ACK ID|RSSI|STATUS)\b/.test(line);
    if (line.includes('SKYBRIDGE SYSTEM') || line.includes('SKYBRIDGE LORA') || line.includes('NODE_ONLINE')) {
      this.detectedProtocol = 'SB1_ASCII';
      await this._touchDevice('A');
    }
    if (!isPayloadLine && /\b(DRONE|REPEATER)\b/.test(line)) {
      await this._touchDevice('DRONE');
    }
    if (line.startsWith('NODE:') || line.startsWith('CONNECTED PEER:')) {
      const node = nodeFromName(line.slice(line.indexOf(':') + 1));
      if (node) await this._touchDevice(node);
      return;
    }

    // Block Headers
    if (line.includes('MESSAGE RECEIVED')) {
      this._currentBlockType = 'MESSAGE_RECEIVED';
      this._asciiBlock = {};
      return;
    }
    if (line.includes('ACK RECEIVED')) {
      this._currentBlockType = 'ACK_RECEIVED';
      this._asciiBlock = {};
      return;
    }
    if (line.includes('MESSAGE TRANSMITTED')) {
      this._currentBlockType = 'MESSAGE_TRANSMITTED';
      this._asciiBlock = {};
      return;
    }

    // Key-Value parsing
    if (line.startsWith('FROM:')) {
      this._asciiBlock.from = line.replace('FROM:', '').trim();
      return;
    }
    if (line.startsWith('TO:')) {
      this._asciiBlock.to = line.replace('TO:', '').trim();
      return;
    }
    if (line.startsWith('PRIORITY:')) {
      this._asciiBlock.priority = line.replace('PRIORITY:', '').trim();
      return;
    }
    if (line.startsWith('MESSAGE ID:') || line.startsWith('PACKET ID:') || line.startsWith('ACK ID:')) {
      const idStr = line.split(':')[1]?.trim() || '';
      this._asciiBlock.packetID = idStr;
      return;
    }
    if (line.startsWith('MESSAGE:')) {
      this._asciiBlock.payload = line.replace('MESSAGE:', '').trim();
      return;
    }
    if (line.startsWith('RSSI:')) {
      this._asciiBlock.rssi = line.replace('RSSI:', '').trim();
      return;
    }
    if (line.startsWith('SNR:')) {
      this._asciiBlock.snr = line.replace('SNR:', '').trim();
      return;
    }
    if (line.startsWith('STATUS:')) {
      this._asciiBlock.status = line.replace('STATUS:', '').trim().toLowerCase();
      return;
    }

    // Single-line signals
    if (line.startsWith('ACK SENT')) {
      await this._touchDevice('B');
      return;
    }

    // Block Terminator / End of Frame
    if (line.startsWith('===') || line.includes('WAITING FOR ACK') || line.includes('STATUS: DELIVERED')) {
      if (this._currentBlockType === 'MESSAGE_RECEIVED' && this._asciiBlock.from && this._asciiBlock.payload) {
        const rawFrom = this._asciiBlock.from.toUpperCase();
        const from = rawFrom.endsWith('_A') || rawFrom === 'A' ? 'A' : 'B';
        const rawTo = (this._asciiBlock.to || 'TEAM_A').toUpperCase();
        const to = rawTo.endsWith('_B') || rawTo === 'B' ? 'B' : 'A';
        const payload = this._asciiBlock.payload;
        const prioRaw = (this._asciiBlock.priority || 'routine').toLowerCase();
        const priority = prioRaw.includes('emerg') ? 'critical' : prioRaw.includes('urg') ? 'urgent' : 'routine';

        let msgID = 0;
        if (this._asciiBlock.packetID) {
          const primaryId = this._asciiBlock.packetID.split('_')[0];
          const num = parseInt(primaryId, 10);
          if (!isNaN(num) && num > 0) {
            msgID = num % 1000000000;
          } else {
            const digits = this._asciiBlock.packetID.replace(/\D/g, '');
            msgID = Number(digits.slice(-6)) || Math.floor(1000 + Math.random() * 9000);
          }
        } else {
          msgID = Math.floor(1000 + Math.random() * 9000);
        }

        const correlationId = generateCorrelationId();
        this.stats.linesParsed += 1;
        await this._handleMessage(
          {
            type: 'MSG',
            from,
            to,
            payload,
            priority,
            msgID,
            relayCount: 0,
          },
          correlationId
        );

        this._currentBlockType = 'NONE';
        this._asciiBlock = {};
        return;
      }

      if (this._currentBlockType === 'ACK_RECEIVED' || this._asciiBlock.status === 'delivered') {
        const rawFrom = (this._asciiBlock.from || 'TEAM_B').toUpperCase();
        const from = rawFrom.endsWith('_A') || rawFrom === 'A' ? 'A' : 'B';

        let msgID = 0;
        if (this._asciiBlock.packetID) {
          const primaryId = this._asciiBlock.packetID.split('_')[0];
          const num = parseInt(primaryId, 10);
          if (!isNaN(num) && num > 0) {
            msgID = num % 1000000000;
          }
        }
        if (!msgID && this._pendingOutboxMap.size > 0) {
          const keys = Array.from(this._pendingOutboxMap.keys());
          msgID = keys[keys.length - 1];
          this._pendingOutboxMap.delete(msgID);
        }

        if (msgID) {
          const correlationId = generateCorrelationId();
          this.stats.linesParsed += 1;
          await this._handleAck(
            {
              type: 'ACK',
              from,
              msgID,
            },
            correlationId
          );
        }

        this._currentBlockType = 'NONE';
        this._asciiBlock = {};
        return;
      }
    }
  }

  private _isValidPacket(p: any) {
    if (!p || typeof p !== 'object') return false;
    if (!VALID_TYPES.includes(p.type)) return false;

    // Normalize callsigns from firmware: "TEAM_A" -> "A", "TEAM_B" -> "B"
    if (p.from) {
      const fromStr = String(p.from).toUpperCase();
      p.from = fromStr.endsWith('_A') || fromStr === 'A' ? 'A' : fromStr.endsWith('_B') || fromStr === 'B' ? 'B' : fromStr;
    }
    if (p.to) {
      const toStr = String(p.to).toUpperCase();
      p.to = toStr.endsWith('_A') || toStr === 'A' ? 'A' : toStr.endsWith('_B') || toStr === 'B' ? 'B' : toStr;
    }

    if (p.from && !VALID_NODES.includes(p.from)) return false;
    if (p.to && !VALID_NODES.includes(p.to) && p.to !== 'BROADCAST') return false;
    if (p.type === 'MSG') {
      if (typeof p.msgID !== 'number') return false;
      if (typeof p.payload !== 'string' || p.payload.length === 0) return false;
      if (Buffer.byteLength(p.payload, 'utf8') > 179) return false;
    }
    if (p.type === 'ACK' && typeof p.msgID !== 'number') return false;
    return true;
  }

  private _beginHardwareProbe(portPath: string) {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => {
      if (!this.connected || this.portPath !== portPath || this.verifiedNodeId) return;
      void this._rejectUnverifiedPort(portPath, 'No LoRa-ready node was reported by this USB device.');
    }, 4500);

    const port = this.port;
    if (!port?.isOpen) return;
    port.set({ dtr: false, rts: false }, (lineError: any) => {
      if (lineError) {
        console.warn(`[serial] reset lines unavailable on ${portPath}: ${lineError.message}`);
        return;
      }
      setTimeout(() => port.set({ rts: true }, (err: any) => {
        if (err) console.warn(`[serial] reset pulse failed on ${portPath}: ${err.message}`);
      }), 200);
      setTimeout(() => port.set({ rts: false }, (err: any) => {
        if (err) console.warn(`[serial] reset release failed on ${portPath}: ${err.message}`);
      }), 350);
    });
  }

  private async _rejectUnverifiedPort(portPath: string, reason: string) {
    if (this.portPath !== portPath || this.verifiedNodeId) return;
    this.rejectedPorts.set(portPath, Date.now() + 30000);
    this.lastError = String(reason).slice(0, 240);
    console.warn(`[serial] ignored non-LoRa USB device on ${portPath}: ${this.lastError}`);
    this.shuttingDown = true;
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    if (this.port?.isOpen) {
      await new Promise<void>((resolve) => this.port.close(() => resolve()));
    }
    this.connected = false;
    this.verifiedNodeId = null;
    this.port = null;
    this.parser = null;
    this.portPath = null;
    this.shuttingDown = false;
    this.emit('status', this.getStatus());
  }

  private async _handleMessage(packet: any, correlationId?: string) {
    const existing = await Message.findOne({ msgID: packet.msgID, isDemo: false });

    if (existing) {
      existing.relayCount = (existing.relayCount || 0) + 1;
      if (existing.status === 'queued' || existing.status === 'sent_to_bridge') {
        existing.status = 'relayed';
      }
      await existing.save();
      this.stats.messagesWritten += 1;
      if (correlationId) {
        logTrace(correlationId, 'db.write', `_id=${existing._id} relayCount=${existing.relayCount} isDemo=false (updated)`);
        logTrace(correlationId, 'socket.emit', `ns=/live event=message:relayed clients=active`);
      }
      this.emit('message:relayed', existing.toObject ? existing.toObject() : existing);
      return;
    }

    const dbStart = Date.now();
    const doc = await Message.create({
      msgID: packet.msgID,
      from: packet.from,
      to: packet.to,
      payload: packet.payload,
      type: packet.type,
      priority: packet.priority || 'routine',
      status: 'relayed',
      source: 'hardware',
      relayCount: packet.relayCount ?? 1,
      isDemo: false, // hardware data is never demo
      timestamp: new Date(),
    });
    const dbElapsed = Date.now() - dbStart;

    this.stats.messagesWritten += 1;
    if (correlationId) {
      logTrace(correlationId, 'db.write', `_id=${doc._id} isDemo=false (${dbElapsed}ms)`);
      logTrace(correlationId, 'socket.emit', `ns=/live event=message:received clients=active`);
    }
    this.emit('message:received', doc.toObject ? doc.toObject() : doc);
    await this._touchDevice(packet.from);
  }

  private async _handleAck(packet: any, correlationId?: string) {
    const original = await Message.findOne({ msgID: packet.msgID, isDemo: false });
    if (!original) return;

    original.status = 'delivered';
    original.ackReceivedAt = new Date();
    await original.save();

    if (correlationId) {
      logTrace(correlationId, 'db.write', `_id=${original._id} status=delivered ack=recorded`);
      logTrace(correlationId, 'socket.emit', `ns=/live event=message:delivered clients=active`);
    }
    this.emit('message:delivered', original.toObject ? original.toObject() : original);
    await this._touchDevice(packet.from);
  }

  private async _handleStatus(packet: any) {
    if (packet.status !== 'FAILED_NO_ACK' || typeof packet.msgID !== 'number') return;
    const msg = await Message.findOne({ msgID: packet.msgID, isDemo: false });
    if (!msg || msg.status === 'delivered') return;

    msg.status = 'failed';
    msg.failureReason = 'No acknowledgment received';
    await msg.save();
    this.emit('message:failed', msg.toObject ? msg.toObject() : msg);
  }

  private async _handleHeartbeat(packet: any) {
    await this._touchDevice(packet.from, packet.battery);
  }

  private async _touchDevice(deviceId: string, batteryVolts?: number) {
    const normalizedDeviceId = nodeFromName(deviceId);
    if (!normalizedDeviceId) return;
    try {
      const update: any = { status: 'online', lastSeen: new Date() };
      if (typeof batteryVolts === 'number') update.batteryVolts = batteryVolts;

      const device = await Device.findOneAndUpdate(
        { deviceId: normalizedDeviceId, isDemo: false },
        { $set: update },
        { returnDocument: 'after', upsert: true }
      );
      this.emit('device:online', device.toObject ? device.toObject() : device);
    } catch (err: any) {
      console.warn(`[serial] error touching device ${deviceId}:`, err.message);
    }
  }

  /** Marks a node as heard from just now and tells every connected dashboard. */
  async markSeen(deviceId: string, batteryVolts?: number) {
    await this._touchDevice(deviceId, batteryVolts);
  }

  async send(packet: any) {
    if (!this.connected || !this.verifiedNodeId || !this.port?.isOpen) {
      const err: any = new Error('Serial bridge not connected');
      err.code = 'SERIAL_DISCONNECTED';
      throw err;
    }

    if (typeof packet.msgID === 'number') {
      this._pendingOutboxMap.set(packet.msgID, { packet, sentAt: Date.now() });
    }

    let line = '';
    if (this.detectedProtocol === 'JSON') {
      line = JSON.stringify(packet) + '\n';
    } else {
      // SB1 ASCII format: SEND|<PRIORITY>|<RECEIVER>|<PAYLOAD>\n
      const prioStr = String(packet.priority || 'routine').toUpperCase();
      const prio = prioStr.includes('EMERG') || prioStr.includes('CRIT') ? 'EMERGENCY' : prioStr.includes('URG') ? 'URGENT' : 'NORMAL';
      const receiver = packet.to === 'A' ? 'TEAM_A' : packet.to === 'B' ? 'TEAM_B' : packet.to;
      line = `SEND|${prio}|${receiver}|${packet.payload}\r\n`;
      console.log('[serial:tx]', JSON.stringify(line.trim()));
    }

    return new Promise((resolve, reject) => {
      this.port.write(line, (err: any) => {
        if (err) return reject(err);
        this.port.drain((drainErr: any) => (drainErr ? reject(drainErr) : resolve(true)));
      });
    });
  }

  private async _logEvent(type: string, message: string) {
    try {
      await SystemEvent.create({ type, message, isDemo: false, timestamp: new Date() });
    } catch (err: any) {
      console.error('[serial] could not log system event:', err.message);
    }
  }
}

export const serialService = new SerialService();

export function startHeartbeatSweep(intervalMs: number = 5000) {
  const timeout = Number(process.env.HEARTBEAT_TIMEOUT_MS || 20000);
  return setInterval(async () => {
    try {
      // Keep only the node that passed its firmware LoRa-init handshake online.
      if (serialService.connected && serialService.verifiedNodeId) {
        await serialService.markSeen(serialService.verifiedNodeId);
      }

      const cutoff = new Date(Date.now() - timeout);
      const staleFilter: any = { isDemo: false, status: 'online', lastSeen: { $lt: cutoff } };
      if (serialService.connected && serialService.verifiedNodeId) {
        staleFilter.deviceId = { $ne: serialService.verifiedNodeId };
      }
      const stale: any[] = await Device.find(staleFilter);
      for (const device of stale) {
        device.status = 'offline';
        await device.save();
        serialService.emit('device:offline', device.toObject ? device.toObject() : device);
      }
    } catch (err: any) {
      console.warn('[heartbeat] sweep error:', err.message);
    }
  }, intervalMs);
}
