import { Router, Request, Response } from 'express';
import { serialService } from '../services/serialService';

const router = Router();

// GET /api/v1/serial/ports - List available physical COM/TTY serial ports
router.get('/ports', async (_req: Request, res: Response) => {
  try {
    const ports = await serialService.listAvailablePorts();
    res.json({
      ports,
      activePort: serialService.getStatus().port,
      connected: serialService.getStatus().connected,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: 'SERIAL_PORT_LIST_FAILED' });
  }
});

// GET /api/v1/serial/status - Get current connection state and packet statistics
router.get('/status', (_req: Request, res: Response) => {
  res.json(serialService.getStatus());
});

// POST /api/v1/serial/connect - Connect to a specified serial port
router.post('/connect', async (req: Request, res: Response) => {
  const { port, baudRate } = req.body;
  const targetPort = port || process.env.SERIAL_PORT || 'COM8';
  const targetBaud = Number(baudRate || process.env.SERIAL_BAUD_RATE || 115200);

  try {
    if (serialService.connected) {
      await serialService.disconnect();
    }

    const result = await serialService.connect(targetPort, targetBaud);
    if (!result.connected) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to connect to specified serial port',
        status: serialService.getStatus(),
      });
    }

    return res.json({
      success: true,
      message: `Connected to serial gateway on ${targetPort} @ ${targetBaud} baud`,
      status: serialService.getStatus(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
      code: 'SERIAL_CONNECT_FAILED',
    });
  }
});

// POST /api/v1/serial/disconnect - Disconnect the serial port
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const status = await serialService.disconnect();
    res.json({
      success: true,
      message: 'Serial port disconnected.',
      status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'SERIAL_DISCONNECT_FAILED',
    });
  }
});

export default router;
