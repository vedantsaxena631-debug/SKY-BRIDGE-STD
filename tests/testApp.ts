import express from 'express';
import authRoutes from '../server/routes/auth';
import statusRoutes from '../server/routes/status';
import messageRoutes from '../server/routes/messages';

export function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', statusRoutes);
  app.use('/api/v1/messages', messageRoutes);

  return app;
}
