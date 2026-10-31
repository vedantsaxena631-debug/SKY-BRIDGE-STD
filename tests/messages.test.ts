import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from './testApp';

const JWT_SECRET = process.env.JWT_SECRET || 'skybridge-insecure-secret-key-32chars!!';

function createToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export async function runMessageIdentityTests(): Promise<void> {
  const app = createTestApp();
  console.log('\n  Suite: Message Identity & Validation Enforcement');

  const tokenOperatorA = createToken({
    sub: 'user_team_a',
    username: 'team-a',
    role: 'operator',
    team: 'A',
    mode: 'demo',
  });

  const tokenViewer = createToken({
    sub: 'user_viewer',
    username: 'observer',
    role: 'viewer',
    team: null,
    mode: 'demo',
  });

  // Test 1: Lets operator A send from A
  {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenOperatorA}`)
      .send({
        from: 'A',
        to: 'B',
        payload: 'LZ SECURE // STANDBY',
        type: 'MSG',
      });

    if (res.status === 201 && res.body.from === 'A' && res.body.to === 'B') {
      console.log('    ✓ lets operator A send from A (201)');
    } else {
      throw new Error(`Expected 201 for operator A send, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }

  // Test 2: Rejects operator A sending from B (403)
  {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenOperatorA}`)
      .send({
        from: 'B', // Spoofed team identity!
        to: 'A',
        payload: 'SPOOFED PACKET',
        type: 'MSG',
      });

    if (res.status === 403) {
      console.log('    ✓ rejects operator A attempting to send as Team B (403)');
    } else {
      throw new Error(`Expected 403 on cross-team spoof, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }

  // Test 3: Rejects a viewer sending anything (403)
  {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenViewer}`)
      .send({
        from: 'A',
        to: 'B',
        payload: 'VIEWER TEST MESSAGE',
        type: 'MSG',
      });

    if (res.status === 403) {
      console.log('    ✓ rejects a viewer account attempting to send messages (403)');
    } else {
      throw new Error(`Expected 403 for viewer send, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }

  // Test 4: Rejects a payload over 200 bytes (400)
  {
    const oversizedPayload = 'X'.repeat(300);
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenOperatorA}`)
      .send({
        from: 'A',
        to: 'B',
        payload: oversizedPayload,
        type: 'MSG',
      });

    if (res.status === 400 && res.body.code === 'PAYLOAD_TOO_LARGE') {
      console.log('    ✓ rejects a payload over 200 bytes with honest 400');
    } else {
      throw new Error(`Expected 400 on oversized payload, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }

  // Test 5: Rejects self-addressed message from === to (400)
  {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenOperatorA}`)
      .send({
        from: 'A',
        to: 'A',
        payload: 'SELF MESSAGE',
        type: 'MSG',
      });

    if (res.status === 400 && res.body.code === 'SELF_ADDRESSED_MESSAGE') {
      console.log('    ✓ rejects self-addressed message from === to (400)');
    } else {
      throw new Error(`Expected 400 for self-addressed message, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }
}
