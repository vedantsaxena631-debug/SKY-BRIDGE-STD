import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { seedUsers } from '../server/scripts/seedUsers';

let mongoServer: MongoMemoryServer | null = null;

export async function setupTestDatabase() {
  if (mongoServer) return mongoServer.getUri();
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'skybridge_test' },
  });
  const uri = mongoServer.getUri();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  await seedUsers();
  return uri;
}

export async function teardownTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export async function clearTestDatabase() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      if (collection.collectionName !== 'users') {
        await collection.deleteMany({});
      }
    }
  }
}
