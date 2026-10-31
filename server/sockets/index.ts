import { Server as SocketIOServer } from 'socket.io';
import { verifySocketToken } from '../middleware/auth';
import { serialService } from '../services/serialService';
import { Device } from '../models/Device';

// What every live dashboard needs on connect. A node counts as online only if it was heard from recently,
// so a stale "online" left in the database after a restart is never shown.
async function liveDeviceSnapshot() {
  const timeout = Number(process.env.HEARTBEAT_TIMEOUT_MS || 20000);
  const rows: any[] = await Device.find({ isDemo: false });
  return rows.map((d) => {
    const o = d.toObject ? d.toObject() : d;
    const fresh = o.lastSeen && Date.now() - new Date(o.lastSeen).getTime() < timeout;
    return {
      deviceId: o.deviceId,
      status: o.status === 'online' && fresh ? 'online' : 'offline',
      lastSeen: o.lastSeen,
      batteryVolts: o.batteryVolts,
    };
  });
}

export function attachSockets(io: SocketIOServer, { demoSimulator }: { demoSimulator?: any } = {}) {
  const live = io.of('/live');
  const demo = io.of('/demo');
  const publicStatus = io.of('/public-status'); // unauthenticated, status only

  // ---- admission control -------------------------------------------------
  live.use(verifySocketToken);
  live.use((socket: any, next: (err?: Error) => void) => {
    if (socket.user.mode !== 'live') {
      return next(new Error('This session is not a live session.'));
    }
    next();
  });

  demo.use(verifySocketToken);
  demo.use((socket: any, next: (err?: Error) => void) => {
    if (socket.user.mode !== 'demo') {
      return next(new Error('This session is not a demo session.'));
    }
    next();
  });

  live.on('connection', async (socket: any) => {
    console.log(`[socket/live] ${socket.user.username} connected`);
    socket.emit('serial:status', serialService.getStatus());
    try {
      socket.emit('devices:snapshot', await liveDeviceSnapshot());
    } catch (err: any) {
      console.warn('[socket/live] could not send device snapshot:', err.message);
    }
    socket.on('disconnect', () => console.log(`[socket/live] ${socket.user.username} disconnected`));
  });

  demo.on('connection', (socket: any) => {
    console.log(`[socket/demo] ${socket.user.username} connected`);
    socket.emit('mode:banner', { isDemo: true, message: 'Demo Mode — simulated data' });
    socket.on('disconnect', () => console.log(`[socket/demo] ${socket.user.username} disconnected`));
  });

  // ---- hardware -> /live only -------------------------------------------
  const liveEvents = [
    'message:received',
    'message:relayed',
    'message:delivered',
    'message:failed',
    'device:online',
    'device:offline',
  ];
  liveEvents.forEach((event) => {
    serialService.on(event, (payload) => live.emit(event, payload));
  });

  serialService.on('status', (status) => {
    live.emit('serial:status', status);
    publicStatus.emit('serial:status', { connected: status.connected, port: status.port });
  });

  // ---- simulator -> /demo only -------------------------------------------
  if (demoSimulator) {
    const demoEvents = [...liveEvents, 'system:event'];
    demoEvents.forEach((event) => {
      demoSimulator.on(event, (payload: any) => demo.emit(event, { ...payload, isDemo: true }));
    });
  }

  return { live, demo, publicStatus };
}
