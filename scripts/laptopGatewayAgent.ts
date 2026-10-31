/**
 * SkyBridge Laptop Gateway Agent
 * 
 * Bridges local USB ESP32 LoRa hardware to a LIVE deployed cloud website
 * (e.g., Render, Railway, Vercel, AWS).
 * 
 * Usage:
 *   $env:CLOUD_API_URL="https://your-app.onrender.com/api/v1"
 *   $env:GATEWAY_SECRET="your-gateway-secret"
 *   npm run gateway
 */

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api/v1';
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || 'skybridge-gateway-secret-token-2026';
const GATEWAY_ID = process.env.GATEWAY_ID || `gateway_${require('os').hostname()}`;
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM8';
const BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE || 115200);

console.log('\n============================================================');
console.log('      SKYBRIDGE CLOUD-TO-HARDWARE GATEWAY AGENT             ');
console.log('============================================================\n');
console.log(`Cloud Server Target : ${CLOUD_API_URL}`);
console.log(`Gateway Client ID   : ${GATEWAY_ID}`);
console.log(`Physical LoRa Port  : ${SERIAL_PORT} @ ${BAUD_RATE} baud\n`);

// "TEAM_B" -> "B", "TEAM_A" -> "A", "DRONE" -> "DRONE". Whole tokens only.
function nodeFromName(raw: unknown): 'A' | 'B' | 'DRONE' | null {
  const tokens = String(raw ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t === 'DRONE' || t === 'RELAY' || t === 'REPEATER')) return 'DRONE';
  const last = tokens[tokens.length - 1];
  return last === 'A' || last === 'B' ? last : null;
}

async function sendCloudEvent(eventData: any) {
  try {
    const res = await fetch(`${CLOUD_API_URL}/gateway/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': GATEWAY_SECRET,
      },
      body: JSON.stringify({
        ...eventData,
        gatewayId: GATEWAY_ID,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn(`[cloud-agent] Event ${eventData.event} notice (${res.status}):`, errBody.error || res.statusText);
    }
  } catch (err: any) {
    console.error('[cloud-agent] Network error posting event to cloud:', err.message);
  }
}

async function startGateway() {
  let port: SerialPort;
  try {
    port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
  } catch (err: any) {
    console.error(`[cloud-agent] Could not open ${SERIAL_PORT}:`, err.message);
    process.exit(1);
  }

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  let currentBlockType = 'NONE';
  let asciiBlock: Record<string, string> = {};
  const pendingMsgMap = new Map<number, string>();

  parser.on('data', async (raw: string) => {
    const line = raw.trim();
    if (!line) return;

    // 1. JSON Support
    if (line.startsWith('{')) {
      try {
        const pkt = JSON.parse(line);
        if (pkt.type === 'MSG') {
          await sendCloudEvent({
            event: 'received',
            from: nodeFromName(pkt.from) ?? pkt.from,
            to: nodeFromName(pkt.to) ?? pkt.to,
            payload: pkt.payload,
            msgID: pkt.msgID,
          });
        } else if (pkt.type === 'HEARTBEAT') {
          const nodeId = nodeFromName(pkt.from);
          if (nodeId) await sendCloudEvent({ event: 'heartbeat', nodeId });
        } else if (pkt.type === 'ACK') {
          await sendCloudEvent({
            event: 'delivered',
            msgID: pkt.msgID,
          });
        }
      } catch {}
      return;
    }

    // Status lines from the board: keep the named node marked online
    if (line.startsWith('NODE:') || line.startsWith('CONNECTED PEER:')) {
      const nodeId = nodeFromName(line.slice(line.indexOf(':') + 1));
      if (nodeId) await sendCloudEvent({ event: 'heartbeat', nodeId });
      return;
    }

    // 2. ASCII SB1 Support
    if (line.includes('MESSAGE RECEIVED')) {
      currentBlockType = 'MESSAGE_RECEIVED';
      asciiBlock = {};
      return;
    }
    if (line.includes('ACK RECEIVED')) {
      currentBlockType = 'ACK_RECEIVED';
      asciiBlock = {};
      return;
    }

    if (line.startsWith('FROM:')) asciiBlock.from = line.replace('FROM:', '').trim();
    if (line.startsWith('TO:')) asciiBlock.to = line.replace('TO:', '').trim();
    if (line.startsWith('MESSAGE ID:') || line.startsWith('PACKET ID:')) asciiBlock.packetID = line.split(':')[1]?.trim() || '';
    if (line.startsWith('MESSAGE:')) asciiBlock.payload = line.replace('MESSAGE:', '').trim();
    if (line.startsWith('STATUS:')) asciiBlock.status = line.replace('STATUS:', '').trim().toLowerCase();

    if (line.startsWith('===') || line.includes('STATUS: DELIVERED') || line.includes('WAITING FOR ACK')) {
      if (currentBlockType === 'MESSAGE_RECEIVED' && asciiBlock.from && asciiBlock.payload) {
        const rawFrom = asciiBlock.from.toUpperCase();
        const from = rawFrom.endsWith('_A') || rawFrom === 'A' ? 'A' : 'B';
        const rawTo = (asciiBlock.to || 'TEAM_A').toUpperCase();
        const to = rawTo.endsWith('_B') || rawTo === 'B' ? 'B' : 'A';
        const digits = (asciiBlock.packetID || '').replace(/\D/g, '');
        const msgID = Number(digits.slice(-6)) || Math.floor(1000 + Math.random() * 9000);

        console.log(`[LoRa -> Cloud] Over-the-air packet from ${from} to ${to}: "${asciiBlock.payload}"`);
        await sendCloudEvent({
          event: 'received',
          from,
          to,
          payload: asciiBlock.payload,
          msgID,
        });

        currentBlockType = 'NONE';
        asciiBlock = {};
        return;
      }

      if (currentBlockType === 'ACK_RECEIVED' || asciiBlock.status === 'delivered') {
        const primaryId = (asciiBlock.packetID || '').split('_')[0];
        let msgID = parseInt(primaryId, 10);
        if (isNaN(msgID) && pendingMsgMap.size > 0) {
          msgID = Array.from(pendingMsgMap.keys()).pop() || 0;
        }

        if (msgID) {
          console.log(`[LoRa -> Cloud] Physical ACK confirmed for msgID ${msgID}`);
          pendingMsgMap.delete(msgID);
          await sendCloudEvent({
            event: 'delivered',
            msgID,
          });
        }

        currentBlockType = 'NONE';
        asciiBlock = {};
        return;
      }
    }
  });

  // Team A is online only while its USB port is really open. If the cable comes out, stop and say so,
  // so the website shows Team A offline within ~20 seconds instead of staying green.
  port.on('close', () => {
    console.error('[cloud-agent] USB port closed. Team A is now offline. Plug the board back in and run the gateway again.');
    process.exit(1);
  });

  port.on('error', (e: Error) => {
    console.error('[cloud-agent] USB port error:', e.message);
  });

  const beat = () => {
    if (port.isOpen) sendCloudEvent({ event: 'heartbeat', nodeId: 'A' });
  };
  setInterval(beat, 10000);
  beat();

  // Outbox polling loop (fetch messages submitted by web users on the deployed site)
  let outboxWarned = false;
  setInterval(async () => {
    try {
      const res = await fetch(`${CLOUD_API_URL}/gateway/outbox?gatewayId=${encodeURIComponent(GATEWAY_ID)}`, {
        headers: { 'x-gateway-secret': GATEWAY_SECRET },
      });
      if (!res.ok) {
        if (!outboxWarned) {
          outboxWarned = true;
          console.warn(
            `[cloud-agent] Cannot read outbox (${res.status}).` +
              (res.status === 401 ? ' GATEWAY_SECRET does not match the one set on the server.' : '')
          );
        }
        return;
      }
      outboxWarned = false;
      const data = await res.json();
      if (!data.message) return;

      const msg = data.message;
      console.log(`[Cloud -> LoRa] Outbox packet claimed: msgID=${msg.msgID} to=${msg.to} "${msg.payload}"`);

      // Transmit to physical ESP32
      const prioStr = String(msg.priority || 'routine').toUpperCase();
      const prio = prioStr.includes('EMERG') || prioStr.includes('CRIT') ? 'EMERGENCY' : prioStr.includes('URG') ? 'URGENT' : 'NORMAL';
      const receiver = msg.to === 'A' ? 'TEAM_A' : msg.to === 'B' ? 'TEAM_B' : msg.to;
      const serialLine = `SEND|${prio}|${receiver}|${msg.payload}\n`;

      pendingMsgMap.set(msg.msgID, msg.payload);
      port.write(serialLine);

      // Report dispatched to cloud
      await sendCloudEvent({
        event: 'dispatched',
        msgID: msg.msgID,
      });
    } catch {}
  }, 1200);

  console.log('[cloud-agent] Gateway agent active and listening. Press Ctrl+C to stop.');
}

startGateway();
