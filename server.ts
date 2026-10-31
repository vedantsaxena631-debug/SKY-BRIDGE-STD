import fs from 'fs';

// Guard against EPERM when traversing upwards into user directory for package.json
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (path: any, ...args: any[]) {
  try {
    return (originalReadFileSync as any).apply(this, [path, ...args]);
  } catch (err: any) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      return '{}';
    }
    throw err;
  }
} as any;

import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import connectDatabase from './server/db';
import authRoutes from './server/routes/auth';
import statusRoutes from './server/routes/status';
import messageRoutes from './server/routes/messages';
import gatewayRoutes from './server/routes/gateway';
import serialRoutes from './server/routes/serial';
import { attachSockets } from './server/sockets';
import {
  serialService,
  startHeartbeatSweep,
} from './server/services/serialService';
import { backendDemoSimulator } from './server/services/demoSimulator';
import { seedUsers } from './server/scripts/seedUsers';

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Limit body size
  app.use(express.json({ limit: '10kb' }));

  // Safe request logging (No passwords, secrets or JWT bodies)
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/@') ||
      req.path.startsWith('/src') ||
      req.path.startsWith('/node_modules')
    ) {
      return next();
    }
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api')) {
        console.log(
          `[http] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
        );
      }
    });
    next();
  });

  // Connect Database
  await connectDatabase().catch((err) =>
    console.warn('[db] initial boot connection notice:', err.message)
  );

  // Initialize seed accounts
  await seedUsers().catch((err) =>
    console.error('[seed] error:', err)
  );

  // Initialize Socket.IO
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
  });
  app.set('io', io);

  attachSockets(io, {
    demoSimulator: backendDemoSimulator,
  });
  backendDemoSimulator.start();

  // Local / Remote Gateway Mode
  const gatewayMode = (
    process.env.GATEWAY_MODE || 'local'
  ).toLowerCase();

  if (gatewayMode === 'remote') {
    console.log(
      '[gateway] Remote mode enabled. Render serial connection disabled.'
    );
  } else {
    serialService
      .connect()
      .catch((err) =>
        console.warn('[serial] connect notice:', err.message)
      );
  }

  // Marks a node offline when nothing has been heard from it. Runs in local and remote gateway mode.
  startHeartbeatSweep();

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', statusRoutes);
  app.use('/api/v1/messages', messageRoutes);
  app.use('/api/v1/gateway', gatewayRoutes);
  app.use('/api/v1/serial', serialRoutes);

  // General Health Route
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SkyBridge Mission Gateway',
    });
  });

  // Vite / Production Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[skybridge] Server running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('[skybridge] Fatal server error:', err);
  process.exit(1);
});
