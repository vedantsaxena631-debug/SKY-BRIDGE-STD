import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  _id: string;
  msgID: number;
  from: string;
  to: string;
  payload: string;
  type: string;
  priority: string;
  status: string;
  source: string;
  relayCount: number;
  isDemo: boolean;
  failureReason?: string;
  claimedBy?: string;
  leaseUntil?: Date | null;
  dispatchAttempts?: number;
  ackReceivedAt?: Date | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDoc extends Omit<IMessage, '_id'>, Document {
  _id: any;
  toObject(): any;
  toJSON(): any;
  save(): Promise<this>;
}

// 1. Real Mongoose Schema declaration with required indexes
export const MessageSchema = new Schema<IMessageDoc>(
  {
    msgID: { type: Number, required: true },
    from: { type: String, required: true, enum: ['A', 'B', 'DRONE'] },
    to: { type: String, required: true, enum: ['A', 'B', 'DRONE'] },
    payload: { type: String, required: true, maxlength: 200 },
    type: { type: String, default: 'MSG', enum: ['MSG', 'ACK', 'HEARTBEAT', 'PING', 'STATUS'] },
    priority: { type: String, default: 'routine', enum: ['routine', 'urgent', 'emergency', 'critical', 'ROUTINE', 'URGENT', 'CRITICAL', 'EMERGENCY', 'NORMAL', 'normal'] },
    status: {
      type: String,
      default: 'queued',
      enum: ['queued', 'sent_to_bridge', 'relayed', 'delivered', 'failed'],
    },
    source: { type: String, default: 'hardware' },
    relayCount: { type: Number, default: 0 },
    isDemo: { type: Boolean, required: true, index: true },
    failureReason: { type: String },
    claimedBy: { type: String },
    leaseUntil: { type: Date, default: null },
    dispatchAttempts: { type: Number, default: 0 },
    ackReceivedAt: { type: Date, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes matching Viva & Performance specifications
MessageSchema.index({ msgID: 1, isDemo: 1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ status: 1, isDemo: 1 });
MessageSchema.index({ isDemo: 1, status: 1, leaseUntil: 1, timestamp: 1 });

const MongoMessageModel = mongoose.models.Message || mongoose.model<IMessageDoc>('Message', MessageSchema);

// 2. High-Fidelity Fallback Model for container/offline dev with matching Mongoose API
class MemoryMessageStore {
  private messages: IMessage[] = [
    {
      _id: 'msg_demo_1',
      msgID: 101,
      from: 'A',
      to: 'B',
      payload: 'EVAC LZ CLEAR // TEAM READY',
      type: 'MSG',
      priority: 'routine',
      status: 'delivered',
      source: 'simulator',
      relayCount: 1,
      isDemo: true,
      ackReceivedAt: new Date(Date.now() - 350000),
      timestamp: new Date(Date.now() - 360000),
      createdAt: new Date(Date.now() - 360000),
      updatedAt: new Date(Date.now() - 360000),
    },
    {
      _id: 'msg_demo_2',
      msgID: 102,
      from: 'B',
      to: 'A',
      payload: 'COORDINATES RECEIVED // STANDBY',
      type: 'MSG',
      priority: 'routine',
      status: 'delivered',
      source: 'simulator',
      relayCount: 1,
      isDemo: true,
      ackReceivedAt: new Date(Date.now() - 170000),
      timestamp: new Date(Date.now() - 180000),
      createdAt: new Date(Date.now() - 180000),
      updatedAt: new Date(Date.now() - 180000),
    },
  ];

  getIndexes() {
    return [
      { key: { _id: 1 } },
      { key: { msgID: 1, isDemo: 1 } },
      { key: { timestamp: -1 } },
      { key: { status: 1, isDemo: 1 } },
      { key: { isDemo: 1, status: 1, leaseUntil: 1, timestamp: 1 } },
    ];
  }

  async claimNextQueued(gatewayId: string, leaseMs = 30000): Promise<any | null> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseMs);

    // MongoDB: atomic claim prevents two gateways claiming the same message.
    if (mongoose.connection.readyState === 1) {
      return (MongoMessageModel as any).findOneAndUpdate(
        {
          isDemo: false,
          status: 'queued',
          $or: [
            { leaseUntil: null },
            { leaseUntil: { $exists: false } },
            { leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            claimedBy: gatewayId,
            leaseUntil,
          },
          $inc: {
            dispatchAttempts: 1,
          },
        },
        {
          returnDocument: 'after',
          sort: { timestamp: 1 },
        }
      ).lean().exec();
    }

    // In-memory fallback: synchronous selection and update.
    const index = this.messages.findIndex((message) => {
      if (message.isDemo !== false || message.status !== 'queued') {
        return false;
      }

      return (
        !message.leaseUntil ||
        new Date(message.leaseUntil).getTime() <= now.getTime()
      );
    });

    if (index === -1) return null;

    const message = this.messages[index];

    const claimed = {
      ...message,
      claimedBy: gatewayId,
      leaseUntil,
      dispatchAttempts: (message.dispatchAttempts || 0) + 1,
      updatedAt: now,
    };

    this.messages[index] = claimed;
    return { ...claimed };
  }

  async countDocuments(filter: any = {}): Promise<number> {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.countDocuments(filter);
    }

    return this.messages.filter((m) => {
      // Check 1: isDemo exists
      if (filter.isDemo && typeof filter.isDemo === 'object' && '$exists' in filter.isDemo) {
        if (filter.isDemo.$exists === false && m.isDemo !== undefined && m.isDemo !== null) return false;
        if (filter.isDemo.$exists === true && (m.isDemo === undefined || m.isDemo === null)) return false;
      } else if (filter.isDemo !== undefined && m.isDemo !== filter.isDemo) {
        return false;
      }

      // Check 2: source
      if (filter.source && m.source !== filter.source) return false;

      // Check 3: status and ackReceivedAt
      if (filter.status && m.status !== filter.status) return false;
      if (filter.ackReceivedAt === null && m.ackReceivedAt !== null && m.ackReceivedAt !== undefined) return false;

      // Check 4: $expr: { $eq: ['$from', '$to'] }
      if (filter.$expr && filter.$expr.$eq) {
        const [a, b] = filter.$expr.$eq;
        const valA = a.startsWith('$') ? (m as any)[a.slice(1)] : a;
        const valB = b.startsWith('$') ? (m as any)[b.slice(1)] : b;
        if (valA !== valB) return false;
      }

      if (filter.from && m.from !== filter.from) return false;
      if (filter.to && m.to !== filter.to) return false;
      if (filter.type && m.type !== filter.type) return false;

      return true;
    }).length;
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.aggregate(pipeline);
    }

    let docs = [...this.messages];

    for (const stage of pipeline) {
      if (stage.$match) {
        docs = docs.filter((d) => {
          const match = stage.$match;
          if (match.isDemo !== undefined && d.isDemo !== match.isDemo) return false;
          if (match.status && d.status !== match.status) return false;
          if (match.n && match.n.$gt !== undefined && (d as any).n <= match.n.$gt) return false;
          return true;
        });
      }

      if (stage.$group) {
        const groups = new Map<string, any>();
        const groupSpec = stage.$group;

        for (const doc of docs) {
          let key: string;
          if (typeof groupSpec._id === 'object') {
            const idObj: any = {};
            for (const [k, expr] of Object.entries(groupSpec._id)) {
              const field = (expr as string).replace('$', '');
              idObj[k] = (doc as any)[field];
            }
            key = JSON.stringify(idObj);
          } else {
            const field = (groupSpec._id as string).replace('$', '');
            key = String((doc as any)[field]);
          }

          if (!groups.has(key)) {
            let idVal = null;
            try {
              idVal = JSON.parse(key);
            } catch {
              idVal = key;
            }
            groups.set(key, { _id: idVal, count: 0, n: 0 });
          }
          const curr = groups.get(key);
          curr.count += 1;
          curr.n += 1;
        }

        docs = Array.from(groups.values());
      }
    }

    return docs;
  }

  async findOne(filter: any): Promise<any | null> {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.findOne(filter);
    }

    const msg = this.messages.find((m) => {
      if (filter.msgID !== undefined && m.msgID !== filter.msgID) return false;
      if (filter.isDemo !== undefined && m.isDemo !== filter.isDemo) return false;
      if (filter._id && m._id !== filter._id) return false;
      return true;
    });

    if (!msg) return null;

    return {
      ...msg,
      toObject: () => ({ ...msg }),
      toJSON: () => ({ ...msg }),
      save: async () => {
        const idx = this.messages.findIndex((x) => x._id === msg._id);
        if (idx !== -1) this.messages[idx] = { ...msg, updatedAt: new Date() };
        return msg;
      },
    };
  }

  find(filter: any = {}) {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.find(filter);
    }

    let result = this.messages.filter((m) => {
      if (filter.isDemo !== undefined && m.isDemo !== filter.isDemo) return false;
      if (filter.type && m.type !== filter.type) return false;
      if (filter.from && m.from !== filter.from) return false;
      if (filter.to && m.to !== filter.to) return false;
      if (filter.status && m.status !== filter.status) return false;
      return true;
    });

    const queryObj: any = {
      sort: (sortObj: any) => {
        if (sortObj?.timestamp === -1) {
          result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return queryObj;
      },
      limit: (n: number) => {
        result = result.slice(0, n);
        return queryObj;
      },
      lean: () => result.map((m) => ({ ...m })),
      select: () => queryObj,
      then: (resolve: any, reject?: any) => {
        try {
          resolve(
            result.map((m) => ({
              ...m,
              toObject: () => ({ ...m }),
              toJSON: () => ({ ...m }),
              save: async () => {
                const idx = this.messages.findIndex((x) => x._id === m._id);
                if (idx !== -1) this.messages[idx] = { ...m, updatedAt: new Date() };
                return m;
              },
            }))
          );
        } catch (e) {
          if (reject) reject(e);
        }
      },
    };
    return queryObj;
  }

  async create(data: Partial<IMessage>): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.create(data);
    }

    const newMsg: IMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      msgID: data.msgID || Math.floor(1000 + Math.random() * 9000),
      from: data.from || 'A',
      to: data.to || 'B',
      payload: data.payload || '',
      type: data.type || 'MSG',
      priority: data.priority || 'routine',
      status: data.status || 'queued',
      source: data.source || (data.isDemo ? 'simulator' : 'hardware'),
      relayCount: data.relayCount ?? 0,
      isDemo: Boolean(data.isDemo),
      ackReceivedAt: data.ackReceivedAt || (data.status === 'delivered' ? new Date() : null),
      failureReason: data.failureReason,
      timestamp: data.timestamp || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messages.unshift(newMsg);
    return {
      ...newMsg,
      toObject: () => ({ ...newMsg }),
      toJSON: () => ({ ...newMsg }),
      save: async () => newMsg,
    };
  }

  async deleteMany(filter: any): Promise<{ deletedCount: number }> {
    if (mongoose.connection.readyState === 1) {
      return MongoMessageModel.deleteMany(filter);
    }

    const beforeCount = this.messages.length;
    this.messages = this.messages.filter((m) => {
      // Must enforce isDemo: true strictly if purging demo records
      if (filter.isDemo !== undefined && m.isDemo === filter.isDemo) return false;
      return true;
    });
    return { deletedCount: beforeCount - this.messages.length };
  }

  _getAllRaw() {
    return [...this.messages];
  }
}

export const Message = new MemoryMessageStore();
export default Message;
