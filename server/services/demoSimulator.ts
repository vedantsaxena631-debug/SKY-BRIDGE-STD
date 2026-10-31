import { EventEmitter } from 'events';
import { Message } from '../models/Message';
import { Device } from '../models/Device';

export class BackendDemoSimulator extends EventEmitter {
  private timer: any = null;
  private isRunning: boolean = false;

  start(intervalMs: number = 8000) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      // Simulate periodic demo events
      const rand = Math.random();
      if (rand < 0.4) {
        // Routine packet ping / relay
        const msgID = Math.floor(1000 + Math.random() * 9000);
        const from = Math.random() > 0.5 ? 'A' : 'B';
        const to = from === 'A' ? 'B' : 'A';
        const doc = await Message.create({
          msgID,
          from,
          to,
          payload: from === 'A' ? 'SITREP: PATROL REACHED WAYPOINT CHARLIE' : 'ACK: SECTOR 4 MONITORING ACTIVE',
          type: 'MSG',
          priority: 'routine',
          status: 'relayed',
          source: 'simulator',
          relayCount: 1,
          isDemo: true,
          timestamp: new Date(),
        });

        this.emit('message:relayed', doc.toObject ? doc.toObject() : doc);

        // Deliver after 1.5s
        setTimeout(async () => {
          doc.status = 'delivered';
          doc.ackReceivedAt = new Date();
          await doc.save();
          this.emit('message:delivered', doc.toObject ? doc.toObject() : doc);
        }, 1500);
      } else if (rand < 0.7) {
        // Device heartbeat update
        const id = ['A', 'DRONE', 'B'][Math.floor(Math.random() * 3)];
        const dev = await Device.findOneAndUpdate(
          { deviceId: id, isDemo: true },
          { $set: { status: 'online', lastSeen: new Date() } },
          { new: true, upsert: true }
        );
        this.emit('device:online', dev.toObject ? dev.toObject() : dev);
      }
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }
}

export const backendDemoSimulator = new BackendDemoSimulator();
