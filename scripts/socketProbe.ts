import { io } from 'socket.io-client';

const token = process.argv[2];
const host = process.env.API_URL || process.argv[3] || 'http://localhost:3000';
const targetUrl = `${host.replace(/\/$/, '')}/live`;

if (!token) {
  console.log('Usage: npx tsx scripts/socketProbe.ts <jwt-token> [host-url]');
  console.log('Example: npx tsx scripts/socketProbe.ts eyJhbGciOiJIUzI1NiIs... http://localhost:3000');
  process.exit(1);
}

console.log(`[probe] Connecting to ${targetUrl}...`);
const socket = io(targetUrl, {
  auth: { token },
  transports: ['websocket', 'polling'],
  timeout: 5000,
});

socket.on('connect', () => {
  console.log(`[probe] connected successfully! Socket ID: ${socket.id}`);
});

socket.on('connect_error', (err) => {
  console.log(`[probe] rejected by server: ${err.message}`);
  // If demo token was rejected from /live, that confirms strict mode isolation
  process.exit(0);
});

const monitoredEvents = [
  'message:received',
  'message:relayed',
  'message:delivered',
  'message:failed',
  'device:online',
  'device:offline',
  'serial:status',
];

monitoredEvents.forEach((event) => {
  socket.on(event, (payload) => {
    console.log(`[probe event] ${event}: ${JSON.stringify(payload).slice(0, 140)}`);
  });
});

setTimeout(() => {
  console.log('[probe] Probe timeout reached (15s). Exiting.');
  socket.disconnect();
  process.exit(0);
}, 15000);
