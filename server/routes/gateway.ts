import { Router, Request, Response } from 'express';
import { requireGatewaySecret } from '../middleware/auth';
import { Message } from '../models/Message';
import { Device } from '../models/Device';
import { serialService } from '../services/serialService';

const router = Router();
const VALID_NODES = ['A', 'B', 'DRONE'];

router.use(requireGatewaySecret);

// GET /api/v1/gateway/outbox - Remote laptop gateway claims next queued message
router.get('/outbox', async (req: Request, res: Response) => {
  try {
    const gatewayId = String(req.query.gatewayId || '').trim();
    if (!gatewayId || gatewayId.length > 80) {
      return res.status(400).json({
        error: 'Valid gatewayId is required.',
      });
    }

    const nodesParam = String(req.query.nodes || '').trim();
    const sourceNodes = nodesParam ? nodesParam.split(',').map((node) => node.trim()) : undefined;
    if (sourceNodes?.some((node) => node !== 'A' && node !== 'B')) {
      return res.status(400).json({
        error: 'Outbox nodes must be A and/or B.',
      });
    }

    const message = await Message.claimNextQueued(gatewayId, 30000, sourceNodes);
    if (!message) {
      return res.json({ message: null });
    }

    return res.json({
      message: {
        id: String(message._id),
        msgID: message.msgID,
        from: message.from,
        to: message.to,
        payload: message.payload,
        priority: message.priority,
        type: message.type,
      },
    });
  } catch (error: any) {
    console.error('[gateway] outbox error:', error.message);
    return res.status(500).json({
      error: 'Could not retrieve gateway outbox.',
    });
  }
});

// POST /api/v1/gateway/events - Remote laptop gateway reports hardware events
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      event,
      gatewayId,
      msgID,
      nodeId,
      from,
      to,
      payload,
    } = req.body;

    if (
      typeof gatewayId !== 'string' ||
      !gatewayId.trim() ||
      gatewayId.length > 80
    ) {
      return res.status(400).json({
        error: 'Invalid gatewayId.',
      });
    }

    // 1. DEVICE HEARTBEAT
    if (event === 'heartbeat') {
      if (!VALID_NODES.includes(nodeId)) {
        return res.status(400).json({
          error: 'Invalid nodeId.',
        });
      }

      const roleName = nodeId === 'DRONE' ? 'Drone Relay' : `Team ${nodeId} Station`;
      const device = await Device.findOneAndUpdate(
        {
          deviceId: nodeId,
          isDemo: false,
        },
        {
          $set: {
            status: 'online',
            lastSeen: new Date(),
            role: roleName,
          },
        },
        {
          returnDocument: 'after',
          upsert: true,
        }
      );

      const deviceData = device?.toObject ? device.toObject() : device;
      if (deviceData) {
        serialService.emit('device:online', deviceData);
      }

      return res.json({
        success: true,
        event,
      });
    }

    // VALIDATE EVENT
    if (
      !['dispatched', 'delivered', 'failed', 'received'].includes(event)
    ) {
      return res.status(400).json({
        error: 'Unsupported gateway event.',
      });
    }

    // 2. INCOMING HARDWARE MESSAGE (Over-The-Air from Team B or Drone)
    if (event === 'received') {
      if (
        !VALID_NODES.includes(from) ||
        !VALID_NODES.includes(to) ||
        from === to ||
        typeof payload !== 'string' ||
        !payload.trim() ||
        Buffer.byteLength(payload, 'utf8') > 179
      ) {
        return res.status(400).json({
          error: 'Invalid received message.',
        });
      }

      let incomingId = Number.isInteger(msgID) ? msgID : 0;
      if (!incomingId) {
        incomingId = Date.now() % 1000000000;
      }

      const existing = await Message.findOne({
        msgID: incomingId,
        isDemo: false,
      });

      if (existing) {
        // If message already exists, treat as repeater relay packet rather than erroring
        existing.relayCount = (existing.relayCount || 0) + 1;
        if (existing.status === 'queued' || existing.status === 'sent_to_bridge') {
          existing.status = 'relayed';
        }
        await existing.save();
        const data = existing.toObject ? existing.toObject() : existing;
        serialService.emit('message:relayed', data);
        await serialService.markSeen(from);
        return res.json({
          success: true,
          msgID: incomingId,
          relayed: true,
        });
      }

      const incoming = await Message.create({
        msgID: incomingId,
        from,
        to,
        payload,
        type: 'MSG',
        priority: 'routine',
        status: 'relayed',
        source: 'hardware',
        relayCount: 1,
        isDemo: false,
        timestamp: new Date(),
      });

      const data = incoming?.toObject ? incoming.toObject() : incoming;
      serialService.emit('message:received', data);

      // A packet from this node proves it is alive
      await serialService.markSeen(from);

      return res.json({
        success: true,
        msgID: incomingId,
      });
    }

    // VALIDATE MESSAGE ID FOR STATUS UPDATES
    if (!Number.isInteger(msgID)) {
      return res.status(400).json({
        error: 'Numeric msgID is required.',
      });
    }

    const message = await Message.findOne({
      msgID,
      isDemo: false,
    });

    if (!message) {
      return res.status(404).json({
        error: 'Live message not found.',
      });
    }

    // 3. MESSAGE DISPATCHED TO HARDWARE
    if (event === 'dispatched') {
      if (message.claimedBy && message.claimedBy !== gatewayId) {
        return res.status(409).json({
          error: 'Message is not claimed by this gateway.',
        });
      }

      if (message.status !== 'queued') {
        if (message.status === 'sent_to_bridge') {
          return res.json({
            success: true,
            status: message.status,
          });
        }
        return res.status(409).json({
          error: 'Message is no longer queued.',
        });
      }

      message.status = 'sent_to_bridge';
      message.claimedBy = undefined;
      message.leaseUntil = null;
      await message.save();

      return res.json({
        success: true,
        status: message.status,
      });
    }

    // 4. MESSAGE DELIVERED (ACK received from remote receiver)
    if (event === 'delivered') {
      if (message.status === 'delivered') {
        return res.json({
          success: true,
          status: 'delivered',
        });
      }

      message.status = 'delivered';
      message.ackReceivedAt = new Date();
      message.claimedBy = undefined;
      message.leaseUntil = null;
      await message.save();

      const data = message?.toObject ? message.toObject() : message;
      serialService.emit('message:delivered', data);

      // An ACK proves the receiving node is alive
      await serialService.markSeen(message.to);

      return res.json({
        success: true,
        status: 'delivered',
      });
    }

    // 5. MESSAGE DELIVERY FAILED
    if (event === 'failed') {
      if (message.status === 'delivered') {
        return res.status(409).json({
          error: 'Delivered message cannot be marked failed.',
        });
      }

      message.status = 'failed';
      message.failureReason = typeof req.body?.failureReason === 'string' && req.body.failureReason.trim() ? req.body.failureReason.trim().slice(0, 240) : 'Hardware gateway reported delivery failure.';
      message.claimedBy = undefined;
      message.leaseUntil = null;
      await message.save();

      const data = message?.toObject ? message.toObject() : message;
      serialService.emit('message:failed', data);

      return res.json({
        success: true,
        status: 'failed',
      });
    }
  } catch (error: any) {
    console.error('[gateway] event error:', error.message);
    return res.status(500).json({
      error: 'Could not process gateway event.',
    });
  }
});

export default router;
