import { EventEmitter } from 'events';
import { Message } from '../models/Message';
import { Device } from '../models/Device';
import { SystemEvent } from '../models/SystemEvent';
import { generateCorrelationId, logTrace } from '../utils/trace';

const VALID_NODES = ['A', 'B', 'DRONE'];
const VALID_TYPES = ['MSG', 'ACK', 'HEARTBEAT', 'PING', 'STATUS'];

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
            console.warn('[serial] port closed');
            this.emit('status', this.getStatus());
            if (!this.shuttingDown) this._scheduleReconnect();
          });

          this.port.on('error', (e: any) => {
            this.lastError = e.message;
            console.error('[serial] error:', e.message);
            this.emit('status', this.getStatus());
          });

          // Team A is the gateway connected locally
          this._touchDevice('A');

          this.emit('status', this.getStatus());
          this._logEvent('serial_connected', `Serial bridge connected on ${portPath}`);
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
    if (this.shuttingDown || this.reconnectTimer) return;
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
    if (this.port?.isOpen) {
      await new Promise((r) => this.port.close(r));
    }
    this.connected = false;
    this.shuttingDown = false;
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  getStatus() {
    return {
      connected: this.connected,
      port: this.portPath || null,
      baudRate: this.baudRate || null,
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

    // Any line received over serial from the local gateway confirms Team A hardware is alive
    await this._touchDevice('A');

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
    if (!deviceId) return;
    try {
      const update: any = { status: 'online', lastSeen: new Date() };
      if (typeof batteryVolts === 'number') update.batteryVolts = batteryVolts;

      const device = await Device.findOneAndUpdate(
        { deviceId, isDemo: false },
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
    if (!this.connected || !this.port?.isOpen) {
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
      // Keep Team A (connected host gateway) online as long as serial port is connected
      if (serialService.connected) {
        // Tells dashboards too (the old silent database write never reached the browser)
        await serialService.markSeen('A');
      }

      const cutoff = new Date(Date.now() - timeout);
      // Sweeps devices that are genuinely stale (excluding connected base station 'A')
      const staleFilter: any = { isDemo: false, status: 'online', lastSeen: { $lt: cutoff } };
      if (serialService.connected) {
        staleFilter.deviceId = { $ne: 'A' };
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
