/**
 * Five Tests Verification Suite for SkyBridge v3.0
 */

import { io } from 'socket.io-client';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const SOCKET_BASE = 'http://127.0.0.1:3000';

async function runFiveTests() {
  console.log('\n============================================================');
  console.log('  SKYBRIDGE v3.0 FIVE TESTS VERIFICATION SUITE');
  console.log('============================================================\n');

  let passedCount = 0;

  // --- TEST 1: Operator-A Cross-Send Rejection ---
  console.log('[TEST 1] Operator-A Cross-Send Rejection...');
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'team-a',
        password: 'teama123',
        claimedRole: 'operator',
        mode: 'demo',
      }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed for team-a: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.token;

    // Now attempt to spoof sender as Team B
    const spoofRes = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from: 'B',
        to: 'A',
        payload: 'UNAUTHORIZED_SPOOF_PACKET',
        priority: 'routine',
        type: 'MSG',
      }),
    });

    if (spoofRes.status === 403) {
      const spoofBody = await spoofRes.json();
      console.log(`  ✓ PASS: HTTP 403 correctly returned: "${spoofBody.error}"`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: Expected status 403, got ${spoofRes.status}`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL Test 1:`, err.message);
  }

  // --- TEST 2: Login Role-Mismatch Rejection ---
  console.log('\n[TEST 2] Login Role-Mismatch Rejection...');
  try {
    const mismatchRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'observer',
        password: 'viewer123',
        claimedRole: 'admin', // Mismatch: observer account is a 'viewer'
        mode: 'demo',
      }),
    });

    if (mismatchRes.status === 401) {
      const body = await mismatchRes.json();
      console.log(`  ✓ PASS: HTTP 401 generic rejection returned: "${body.error}"`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: Expected status 401, got ${mismatchRes.status}`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL Test 2:`, err.message);
  }

  // --- TEST 3: Live Query Isolation ---
  console.log('\n[TEST 3] Live Query Isolation...');
  try {
    const liveLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'team-a',
        password: 'teama123',
        claimedRole: 'operator',
        mode: 'live',
      }),
    });
    const liveAuth = await liveLoginRes.json();
    const liveToken = liveAuth.token;

    const messagesRes = await fetch(`${API_BASE}/messages`, {
      headers: { Authorization: `Bearer ${liveToken}` },
    });
    const messages = await messagesRes.json();

    if (!Array.isArray(messages)) {
      throw new Error(`Expected array of messages, got: ${JSON.stringify(messages)}`);
    }

    const anyDemoInLive = messages.some((m: any) => m.isDemo === true);
    if (!anyDemoInLive) {
      console.log(`  ✓ PASS: Live query returned ${messages.length} messages, 0 demo records found.`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: Demo records leaked into Live query!`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL Test 3:`, err.message);
  }

  // --- TEST 4: Demo Write Isolation ---
  console.log('\n[TEST 4] Demo Write Isolation...');
  try {
    const demoLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'team-a',
        password: 'teama123',
        claimedRole: 'operator',
        mode: 'demo',
      }),
    });
    const demoAuth = await demoLoginRes.json();
    const demoToken = demoAuth.token;

    // Send valid Demo message
    const sendDemoRes = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${demoToken}`,
      },
      body: JSON.stringify({
        from: 'A',
        to: 'B',
        payload: 'DEMO_ISOLATED_TEST_PAYLOAD_' + Date.now(),
        priority: 'routine',
        type: 'MSG',
      }),
    });
    const sentDemoMsg = await sendDemoRes.json();

    if (sentDemoMsg.isDemo === true) {
      console.log(`  ✓ Demo message created with isDemo=true (source=${sentDemoMsg.source}).`);
    } else {
      throw new Error(`Sent message was not marked isDemo=true: ${JSON.stringify(sentDemoMsg)}`);
    }

    // Query live session to guarantee this demo message is NOT in live results
    const liveLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'team-a',
        password: 'teama123',
        claimedRole: 'operator',
        mode: 'live',
      }),
    });
    const liveAuth = await liveLoginRes.json();
    const liveMessagesRes = await fetch(`${API_BASE}/messages`, {
      headers: { Authorization: `Bearer ${liveAuth.token}` },
    });
    const liveMessages = await liveMessagesRes.json();
    const leaked = Array.isArray(liveMessages) && liveMessages.some((m: any) => m._id === sentDemoMsg._id || m.id === sentDemoMsg.id);

    if (!leaked) {
      console.log(`  ✓ PASS: Demo message is absent from live query. Full write isolation verified.`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: Demo message leaked into live database view!`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL Test 4:`, err.message);
  }

  // --- TEST 5: Socket.IO Namespace Isolation ---
  console.log('\n[TEST 5] Socket.IO Namespace Isolation...');
  try {
    const demoRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'team-a',
        password: 'teama123',
        claimedRole: 'operator',
        mode: 'demo',
      }),
    });
    const demoLogin = await demoRes.json();
    const demoToken = demoLogin.token;

    // 1. Connect Demo token to /live namespace - MUST BE REJECTED
    const rejectedPromise = new Promise<boolean>((resolve) => {
      const socket = io(`${SOCKET_BASE}/live`, {
        auth: { token: demoToken },
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 4000,
      });

      socket.on('connect_error', (_err) => {
        socket.disconnect();
        resolve(true); // Correctly rejected
      });

      socket.on('connect', () => {
        socket.disconnect();
        resolve(false); // Wrong: should not have connected!
      });
    });

    const isRejected = await rejectedPromise;
    if (isRejected) {
      console.log(`  ✓ Live namespace correctly refused connection from Demo token.`);
    } else {
      throw new Error(`Live namespace allowed connection from Demo token!`);
    }

    // 2. Connect Demo token to /demo namespace - MUST BE ACCEPTED
    const acceptedDemoPromise = new Promise<boolean>((resolve) => {
      const socket = io(`${SOCKET_BASE}/demo`, {
        auth: { token: demoToken },
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 4000,
      });

      socket.on('connect', () => {
        socket.disconnect();
        resolve(true);
      });

      socket.on('connect_error', (err) => {
        console.error('  Demo connection error:', err.message);
        socket.disconnect();
        resolve(false);
      });
    });

    const isDemoAccepted = await acceptedDemoPromise;
    if (isDemoAccepted) {
      console.log(`  ✓ Demo namespace accepted connection with Demo token.`);
      console.log(`  ✓ PASS: Socket.IO namespace isolation fully verified.`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: Demo namespace refused Demo token!`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL Test 5:`, err.message);
  }

  console.log('\n============================================================');
  console.log(`  RESULTS: ${passedCount} / 5 TESTS PASSED`);
  console.log('============================================================\n');

  if (passedCount === 5) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFiveTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
