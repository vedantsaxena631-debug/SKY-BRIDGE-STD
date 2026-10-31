import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice {
  _id: string;
  deviceId: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen: Date | null;
  batteryVolts?: number;
  role?: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeviceDoc extends Omit<IDevice, '_id'>, Document {
  _id: any;
  toObject(): any;
  save(): Promise<this>;
}

// MongoDB Schema
export const DeviceSchema = new Schema<IDeviceDoc>(
  {
    deviceId: { type: String, required: true },
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded'],
      default: 'offline',
    },
    lastSeen: { type: Date, default: null },
    batteryVolts: { type: Number },
    role: { type: String },
    isDemo: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

// Indexes
DeviceSchema.index({ deviceId: 1, isDemo: 1 });
DeviceSchema.index({ isDemo: 1, status: 1, lastSeen: 1 });

const MongoDeviceModel =
  mongoose.models.Device ||
  mongoose.model<IDeviceDoc>('Device', DeviceSchema);

// In-memory fallback for offline development & mock environments
class MemoryDeviceStore {
  private devices: IDevice[] = [
    {
      _id: 'dev_demo_a',
      deviceId: 'A',
      status: 'online',
      lastSeen: new Date(),
      batteryVolts: 4.12,
      role: 'Team A Station',
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 'dev_demo_drone',
      deviceId: 'DRONE',
      status: 'online',
      lastSeen: new Date(),
      batteryVolts: 15.8,
      role: 'Drone Relay',
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 'dev_demo_b',
      deviceId: 'B',
      status: 'online',
      lastSeen: new Date(),
      batteryVolts: 3.98,
      role: 'Team B Station',
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  find(filter: any = {}) {
    if (mongoose.connection.readyState === 1) {
      return MongoDeviceModel.find(filter);
    }

    const result = this.devices.filter((device) => {
      if (filter.isDemo !== undefined && device.isDemo !== filter.isDemo) {
        return false;
      }
      if (typeof filter.deviceId === 'string') {
        if (device.deviceId !== filter.deviceId) return false;
      } else if (filter.deviceId?.$ne) {
        if (device.deviceId === filter.deviceId.$ne) return false;
      }
      if (filter.status && device.status !== filter.status) {
        return false;
      }
      if (filter.lastSeen?.$lt) {
        if (!device.lastSeen || new Date(device.lastSeen) >= new Date(filter.lastSeen.$lt)) {
          return false;
        }
      }
      return true;
    });

    const queryObj: any = {
      select: (_fields: string) => queryObj,
      lean: () => result.map((device) => ({ ...device })),
      then: (resolve: any, reject?: any) => {
        const documents = result.map((device) => ({
          ...device,
          toObject: () => ({ ...device }),
          save: async () => {
            const index = this.devices.findIndex((item) => item._id === device._id);
            if (index !== -1) {
              device.updatedAt = new Date();
              this.devices[index] = { ...device };
            }
            return device;
          },
        }));
        return Promise.resolve(documents).then(resolve, reject);
      },
    };
    return queryObj;
  }

  async findOneAndUpdate(
    filter: any,
    update: any,
    options: any = {}
  ): Promise<any> {
    // MongoDB implementation
    if (mongoose.connection.readyState === 1) {
      return (MongoDeviceModel as any)
        .findOneAndUpdate(filter, update, { returnDocument: 'after', ...options })
        .exec();
    }

    // In-memory implementation
    let device = this.devices.find((item) => {
      if (filter.deviceId && item.deviceId !== filter.deviceId) {
        return false;
      }
      if (filter.isDemo !== undefined && item.isDemo !== filter.isDemo) {
        return false;
      }
      return true;
    });

    if (!device && options.upsert) {
      device = {
        _id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        deviceId: filter.deviceId,
        status: 'offline',
        lastSeen: null,
        isDemo: filter.isDemo ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.devices.push(device);
    }

    if (!device) return null;

    if (update.$set) {
      Object.assign(device, update.$set);
    } else {
      Object.assign(device, update);
    }

    device.updatedAt = new Date();

    return {
      ...device,
      toObject: () => ({ ...device }),
      save: async () => device,
    };
  }
}

export const Device = new MemoryDeviceStore();
export default Device;
