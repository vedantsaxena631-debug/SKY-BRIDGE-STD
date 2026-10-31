import connectDatabase, { disconnectDatabase } from '../server/db';
import { Message } from '../server/models/Message';

interface SeedOptions {
  messages: number;
  days: number;
  wipe: boolean;
}

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  let messages = 120;
  let days = 7;
  let wipe = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--messages' && args[i + 1]) {
      messages = parseInt(args[i + 1], 10) || 120;
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      days = parseFloat(args[i + 1]) || 7;
      i++;
    } else if (args[i] === '--wipe') {
      wipe = true;
    }
  }

  return { messages, days, wipe };
}

const SAMPLE_PAYLOADS = [
  'LZ ALPHA CLEARED // WIND 04KT 280 // SECURE',
  'TEAM ADVANCING TO SECTOR 4 RIDGE LINE',
  'SITREP: WATER SOURCE IDENTIFIED AT WAYPOINT 02',
  'RELAY LINK OPTIMAL // RSSI -94dBm SNR +7.5dB',
  'MEDICAL PACK DELIVERED AT WAYPOINT 07',
  'BEACON PING CONFIRMED FROM DRONE PAYLOAD',
  'SEARCH TRAIL COMMENCED HEADING NORTHWEST',
  'DRONE BATTERY AT 68% // CONTINUING ORBIT',
  'HIGH WINDS DETECTED ON CREST // PROCEED WITH CAUTION',
  'SHELTER POINT SECURED // ALL TEAMS ACCOUNTED',
  'COORDINATES VERIFIED: LAT 34.0522 LON -118.2437',
  'STANDBY FOR SCHEDULED FREQUENCY HOPPING',
];

export async function seedDemoData(options: SeedOptions) {
  console.log('\n--- SKYBRIDGE REALISTIC DEMO DATA SEEDER ---');

  if (options.wipe) {
    console.log('[seeder] --wipe specified. Deleting ONLY records with isDemo: true...');
    // STRICT SAFETY: Hardcoded isDemo: true. Non-negotiable. Cannot touch live data.
    const purge = await Message.deleteMany({ isDemo: true });
    console.log(`[seeder] Purged ${purge.deletedCount} demo records safely.`);
  }

  console.log(`[seeder] Generating ${options.messages} realistic demo messages across ${options.days} days...`);

  const now = Date.now();
  const rangeMs = options.days * 24 * 60 * 60 * 1000;
  const created: any[] = [];

  for (let i = 0; i < options.messages; i++) {
    // Spread timestamps across the range with pseudo-Poisson realistic dispersion
    const timeOffset = Math.random() * rangeMs;
    const msgTimestamp = new Date(now - timeOffset);

    // Realistic status mix: ~80% delivered, ~12% failed, ~8% relayed/sent
    const rand = Math.random();
    let status = 'delivered';
    let failureReason: string | undefined;
    let ackReceivedAt: Date | null = null;

    if (rand < 0.12) {
      status = 'failed';
      failureReason = 'No acknowledgment received after 3 LoRa retransmissions';
    } else if (rand < 0.20) {
      status = 'relayed';
    } else {
      status = 'delivered';
      // Believable physical LoRa flight ACK latency: 800ms to 4200ms
      const ackDelayMs = Math.floor(800 + Math.random() * 3400);
      ackReceivedAt = new Date(msgTimestamp.getTime() + ackDelayMs);
    }

    const isFromA = Math.random() > 0.45;
    const from = isFromA ? 'A' : 'B';
    const to = isFromA ? 'B' : 'A';
    const payload = SAMPLE_PAYLOADS[i % SAMPLE_PAYLOADS.length];
    const msgID = 2000 + i;

    const doc = await Message.create({
      msgID,
      from,
      to,
      payload,
      type: 'MSG',
      priority: Math.random() > 0.85 ? 'urgent' : 'routine',
      status,
      failureReason,
      source: 'simulator',
      relayCount: Math.floor(1 + Math.random() * 2),
      // NON-NEGOTIABLE CORE SAFETY:
      isDemo: true,
      ackReceivedAt,
      timestamp: msgTimestamp,
    });

    created.push(doc);
  }

  console.log(`[seeder] Successfully seeded ${created.length} demo records (all guaranteed isDemo: true).`);
  return created.length;
}

if (process.argv[1]?.endsWith('seedDemoData.ts') || process.argv[1]?.endsWith('seedDemoData.js')) {
  (async () => {
    try {
      await connectDatabase();
      const opts = parseArgs();
      await seedDemoData(opts);
      await disconnectDatabase();
      process.exit(0);
    } catch (err: any) {
      console.error('[seedDemoData] fatal error:', err.message);
      process.exit(1);
    }
  })();
}
