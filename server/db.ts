import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;
let isReconnecting = false;
let configuredUri: string | null = null;

export async function connectDatabase() {
  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected successfully');
    isReconnecting = false;
  });

  mongoose.connection.on('error', (err) => {
    console.warn(`[db] MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected.');
    if (!isReconnecting && configuredUri) {
      scheduleReconnect();
    }
  });

  try {
    if (process.env.MONGODB_URI) {
      configuredUri = process.env.MONGODB_URI;
      console.log(`[db] Connecting to external MongoDB at ${configuredUri.replace(/:([^:@]{1,})@/, ':****@')}`);
      await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 3000,
      });
    } else {
      console.log('[db] No MONGODB_URI set; initializing embedded MongoDB instance for live operations...');
      mongoMemoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'skybridge',
        },
      });
      configuredUri = mongoMemoryServer.getUri();
      console.log(`[db] Embedded MongoDB ready at ${configuredUri}`);
      await mongoose.connect(configuredUri);
    }
  } catch (err: any) {
    console.warn(`[db] MongoDB connection failed: ${err.message}. Server starting in decoupled mode; auto-reconnect scheduled.`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isReconnecting || !configuredUri) return;
  isReconnecting = true;
  setTimeout(async () => {
    isReconnecting = false;
    if (mongoose.connection.readyState !== 1 && configuredUri) {
      try {
        await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 2000 });
      } catch {
        scheduleReconnect();
      }
    }
  }, 4000);
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function reconnectDatabase(): Promise<void> {
  if (configuredUri && mongoose.connection.readyState !== 1) {
    await mongoose.connect(configuredUri);
  }
}

export async function stopDatabaseInstance(): Promise<void> {
  await disconnectDatabase();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
}

export default connectDatabase;
