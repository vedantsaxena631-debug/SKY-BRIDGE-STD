import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Device } from '../models/Device';
import { serialService } from '../services/serialService';
import { isDbConnected } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const BOOT_TIME = Date.now();

// 1. GET /api/v1/status - Pre-login system status
router.get('/status', async (_req: Request, res: Response) => {
  const nodes: Record<string, { status: string; lastSeen: any }> = {};
  const isDbUp = isDbConnected();

  try {
    const devices = await Device.find({ isDemo: false }).select('deviceId status lastSeen role').lean();
    for (const id of ['A', 'DRONE', 'B']) {
      const d = (devices as any[]).find((x: any) => x.deviceId === id);
      nodes[id] = d
        ? { status: d.status, lastSeen: d.lastSeen }
        : { status: 'unknown', lastSeen: null };
    }
  } catch {
    for (const id of ['A', 'DRONE', 'B']) {
      nodes[id] = { status: 'unknown', lastSeen: null };
    }
  }

  const serial = serialService.getStatus();

  res.json({
    system: {
      api: 'operational',
      database: isDbUp ? 'connected' : 'disconnected',
      serialBridge: serial.connected ? 'connected' : 'not_connected',
      serialPort: serial.connected ? serial.port : null,
      uptimeSeconds: Math.floor((Date.now() - BOOT_TIME) / 1000),
    },
    nodes,
    // Live mode is ready when either team's USB gateway can carry its own outbound messages.
    liveReady: Boolean(serial.connected || nodes['A']?.status === 'online' || nodes['B']?.status === 'online'),
    updatedAt: new Date().toISOString(),
  });
});

// 2. GET /api/v1/health - Quick health verification probe
router.get('/health', (_req: Request, res: Response) => {
  const isDbUp = isDbConnected();
  const isSerialUp = serialService.getStatus().connected;
  const ok = isDbUp;

  const payload = {
    ok,
    db: isDbUp,
    serial: isSerialUp,
    uptimeSeconds: Math.floor(process.uptime()),
  };

  if (!ok) {
    return res.status(503).json(payload);
  }

  return res.json(payload);
});

// 3. GET /api/v1/system/health & GET /api/v1/system/metrics - Genuinely measurable metrics (Admin only)
const metricsHandler = async (req: Request, res: Response) => {
  const isDbUp = isDbConnected();
  let dbPingMs: number | null = null;

  if (isDbUp && mongoose.connection.db) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      dbPingMs = Date.now() - start;
    } catch {
      dbPingMs = null;
    }
  }

  // Retrieve actual Socket.IO namespaces attached to app
  const io = req.app.get('io');
  let liveClients = 0;
  let demoClients = 0;

  if (io) {
    try {
      liveClients = io.of('/live')?.sockets?.size || 0;
      demoClients = io.of('/demo')?.sockets?.size || 0;
    } catch {
      // safe fallback if sockets not yet attached
    }
  }

  const memory = process.memoryUsage();
  const serial = serialService.getStatus();

  res.json({
    ok: isDbUp,
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMB: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapTotalMB: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
        heapUsedMB: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
      },
    },
    database: {
      connected: isDbUp,
      readyState: mongoose.connection.readyState,
      pingMs: dbPingMs,
      host: mongoose.connection.host || 'embedded-memory',
      dbName: mongoose.connection.name || 'skybridge',
    },
    sockets: {
      liveClients,
      demoClients,
      totalConnected: liveClients + demoClients,
    },
    serial: {
      connected: serial.connected,
      port: serial.port,
      baudRate: serial.baudRate,
      linesRead: serial.stats.linesRead,
      linesParsed: serial.stats.linesParsed,
      linesDropped: serial.stats.linesDropped,
      messagesWritten: serial.stats.messagesWritten,
    },
    timestamp: new Date().toISOString(),
  });
};

router.get('/system/health', requireAuth, requireRole('admin'), metricsHandler);
router.get('/system/metrics', requireAuth, requireRole('admin'), metricsHandler);

export default router;
