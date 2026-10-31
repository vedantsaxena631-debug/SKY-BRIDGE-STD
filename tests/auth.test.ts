import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from './testApp';
import { resetRateLimits } from '../server/middleware/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'skybridge-insecure-secret-key-32chars!!';

export async function runAuthTests(): Promise<void> {
  const app = createTestApp();
  resetRateLimits();

  console.log('\n  Suite: Authentication & Session Verification');

  // Test 1: Rejects a correct password with the wrong role tab
  {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'team-a',
        password: process.env.SEED_OPERATOR_A_PASSWORD || 'teama123',
        claimedRole: 'admin', // WRONG ROLE TAB for team-a (which is operator)
        mode: 'demo',
      });

    if (res.status === 401 && res.body.error) {
      console.log('    ✓ rejects a correct password with the wrong role tab (401)');
    } else {
      throw new Error(`Expected 401 on wrong role tab, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }

  // Test 2: Issues a token carrying role, team and mode
  {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'team-a',
        password: process.env.SEED_OPERATOR_A_PASSWORD || 'teama123',
        claimedRole: 'operator',
        mode: 'demo',
      });

    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Expected 200 with token, got ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const decoded: any = jwt.verify(res.body.token, JWT_SECRET);
    if (decoded.role === 'operator' && decoded.team === 'A' && decoded.mode === 'demo' && decoded.username === 'team-a') {
      console.log('    ✓ issues a valid JWT token carrying role, team, and mode');
    } else {
      throw new Error(`Token payload mismatch: ${JSON.stringify(decoded)}`);
    }
  }

  // Test 3: Rate-limits repeated failures with 429
  {
    resetRateLimits();
    let got429 = false;

    // Send 22 requests rapidly
    for (let i = 0; i < 22; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'team-a',
          password: 'wrongpassword',
          claimedRole: 'operator',
          mode: 'demo',
        });

      if (res.status === 429) {
        got429 = true;
        break;
      }
    }

    if (got429) {
      console.log('    ✓ rate-limits rapid login attempts with honest 429');
    } else {
      throw new Error('Rate limiter did not trip with 429 after 20 attempts');
    }
    resetRateLimits();
  }
}
