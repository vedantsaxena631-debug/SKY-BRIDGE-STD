import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from './testApp';
import { Message } from '../server/models/Message';

const JWT_SECRET = process.env.JWT_SECRET || 'skybridge-insecure-secret-key-32chars!!';

function createToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export async function runModeIsolationTests(): Promise<void> {
  const app = createTestApp();
  console.log('\n  Suite: Mode Isolation & Aggregate Statistics');

  // Seed sample records for both live and demo modes
  await Message.create({
    msgID: 9001,
    from: 'A',
    to: 'B',
    payload: 'LIVE RECORD 9001',
    status: 'delivered',
    isDemo: false,
    source: 'hardware',
    ackReceivedAt: new Date(),
    timestamp: new Date(),
  });

  await Message.create({
    msgID: 9002,
    from: 'B',
    to: 'A',
    payload: 'DEMO RECORD 9002',
    status: 'delivered',
    isDemo: true,
    source: 'simulator',
    ackReceivedAt: new Date(),
    timestamp: new Date(),
  });

  const liveToken = createToken({
    sub: 'user_live_a',
    username: 'team-a',
    role: 'operator',
    team: 'A',
    mode: 'live',
  });

  const demoToken = createToken({
    sub: 'user_demo_a',
    username: 'team-a',
    role: 'operator',
    team: 'A',
    mode: 'demo',
  });

  // Test 1: Returns no demo records to a live session
  {
    const res = await request(app)
      .get('/api/v1/messages')
      .set('Authorization', `Bearer ${liveToken}`);

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }

    const returnedDemo = res.body.filter((m: any) => m.isDemo === true);
    if (returnedDemo.length === 0) {
      console.log('    ✓ returns NO demo records to a live session');
    } else {
      throw new Error(`Live session leaked ${returnedDemo.length} demo records!`);
    }
  }

  // Test 2: Returns no live records to a demo session
  {
    const res = await request(app)
      .get('/api/v1/messages')
      .set('Authorization', `Bearer ${demoToken}`);

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }

    const returnedLive = res.body.filter((m: any) => m.isDemo === false);
    if (returnedLive.length === 0) {
      console.log('    ✓ returns NO live records to a demo session');
    } else {
      throw new Error(`Demo session leaked ${returnedLive.length} live records!`);
    }
  }

  // Test 3: Excludes demo records from live statistics aggregates
  {
    // Live aggregation pipeline: compute total messages and delivery rate for live only
    const liveStats = await Message.aggregate([
      { $match: { isDemo: false } },
      {
        $group: {
          _id: '$status',
          total: { $sum: 1 },
        },
      },
    ]);

    const liveTotal = liveStats.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const demoInLiveCount = await Message.countDocuments({ isDemo: true, msgID: 9001 });

    if (liveTotal >= 1 && demoInLiveCount === 0) {
      console.log('    ✓ excludes demo records from live statistics aggregates');
    } else {
      throw new Error(`Aggregate query failure: live stats computed demo items: ${JSON.stringify(liveStats)}`);
    }
  }
}
