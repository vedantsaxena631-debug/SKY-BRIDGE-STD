import { serialService } from '../server/services/serialService';
import { Message } from '../server/models/Message';
import { Device } from '../server/models/Device';

export async function runSerialParsingTests(): Promise<void> {
  console.log('\n  Suite: Hardware Serial Ingestion & Parsing');

  // Unverified serial traffic must not create messages or mark a node online.
  serialService.verifiedNodeId = null;
  const unverifiedPacket = JSON.stringify({
    type: 'MSG',
    from: 'A',
    to: 'B',
    msgID: 7699,
    payload: 'UNVERIFIED DEVICE',
  });
  await (serialService as any)._handleLine(unverifiedPacket);
  const unverifiedMessage = await Message.findOne({ msgID: 7699, isDemo: false });
  const unverifiedDevices = await Device.find({ deviceId: 'A', isDemo: false }).lean();
  if (unverifiedMessage || unverifiedDevices.some((device: any) => device.status === 'online')) {
    throw new Error('Unverified serial traffic was accepted as real LoRa hardware.');
  }

  // A failed radio-init event is not sufficient; successful initialization is required.
  await (serialService as any)._handleLine(JSON.stringify({
    type: 'SYSTEM_EVENT',
    event: 'NODE_ONLINE',
    nodeId: 'TEAM_A',
    radioReady: false,
  }));
  if (serialService.verifiedNodeId) {
    throw new Error('Node was accepted without a successful LoRa initialization.');
  }

  // Current firmware emits this only after the SX1278 initialization succeeds.
  await (serialService as any)._handleLine(JSON.stringify({
    type: 'SYSTEM_EVENT',
    event: 'NODE_ONLINE',
    nodeId: 'TEAM_A',
    radioReady: true,
  }));
  if (serialService.verifiedNodeId !== 'A') {
    throw new Error('Valid Team A LoRa-ready handshake was not accepted.');
  }
  console.log('    ✓ ignores unverified devices and accepts a radio-ready node handshake');

  // Test 1: Stores a valid JSON line
  {
    const validPacket = JSON.stringify({
      type: 'MSG',
      from: 'A',
      to: 'B',
      msgID: 7701,
      payload: 'BEACON TEST PACKET',
      relayCount: 1,
    });

    // Feed the line directly into serial handler
    await (serialService as any)._handleLine(validPacket);

    const doc = await Message.findOne({ msgID: 7701, isDemo: false });
    if (doc && doc.payload === 'BEACON TEST PACKET' && doc.source === 'hardware' && doc.isDemo === false) {
      console.log('    ✓ stores a valid JSON line from hardware into database');
    } else {
      throw new Error(`Failed to store valid serial packet: ${JSON.stringify(doc)}`);
    }
  }

  // Test 2: Skips a malformed line without dropping the next valid one
  {
    const initialDropped = serialService.stats.linesDropped;
    const malformedLine = '{"type":"MSG","from":INVALID_JSON,,,}';
    const nextValidPacket = JSON.stringify({
      type: 'MSG',
      from: 'B',
      to: 'A',
      msgID: 7702,
      payload: 'FOLLOW UP RECOVERY PACKET',
      relayCount: 1,
    });

    // Feed bad line
    await (serialService as any)._handleLine(malformedLine);
    // Immediately feed good line
    await (serialService as any)._handleLine(nextValidPacket);

    const recoveredDoc = await Message.findOne({ msgID: 7702, isDemo: false });

    if (serialService.stats.linesDropped > initialDropped && recoveredDoc) {
      console.log('    ✓ skips a malformed line without dropping the next valid one');
    } else {
      throw new Error('Parser crashed or dropped the subsequent valid packet');
    }
  }

  // Test 3: Increments relayCount instead of duplicating on a repeat msgID
  {
    const repeatPacket = JSON.stringify({
      type: 'MSG',
      from: 'A',
      to: 'B',
      msgID: 7701, // Identical msgID to Test 1!
      payload: 'BEACON TEST PACKET',
      relayCount: 1,
    });

    const countBefore = await Message.countDocuments({ msgID: 7701, isDemo: false });
    await (serialService as any)._handleLine(repeatPacket);
    const countAfter = await Message.countDocuments({ msgID: 7701, isDemo: false });
    const updatedDoc = await Message.findOne({ msgID: 7701, isDemo: false });

    if (countBefore === countAfter && updatedDoc.relayCount > 1) {
      console.log('    ✓ increments relayCount instead of duplicating on repeat msgID');
    } else {
      throw new Error(`Repeat msgID caused duplicate rows! Count before: ${countBefore}, after: ${countAfter}`);
    }
  }

  // Test 4: Marks a message delivered when its ACK arrives
  {
    const ackPacket = JSON.stringify({
      type: 'ACK',
      from: 'B',
      to: 'A',
      msgID: 7701,
    });

    await (serialService as any)._handleLine(ackPacket);

    const deliveredDoc = await Message.findOne({ msgID: 7701, isDemo: false });
    if (deliveredDoc && deliveredDoc.status === 'delivered' && deliveredDoc.ackReceivedAt) {
      console.log('    ✓ marks a message delivered when physical ACK arrives');
    } else {
      throw new Error(`Message was not marked delivered upon ACK arrival: ${JSON.stringify(deliveredDoc)}`);
    }
  }

  // Test 5: Ingests physical ESP32 SB1 ASCII multi-line protocol blocks
  {
    const asciiLines = [
      '==============================',
      'MESSAGE RECEIVED',
      '==============================',
      'FROM: TEAM_B',
      'TO: TEAM_A',
      'PRIORITY: NORMAL',
      'MESSAGE ID: 8801_1',
      'MESSAGE: GROUND SEARCH REPORT',
      'RSSI: -45',
      'SNR: 9.00',
      '==============================',
    ];

    for (const l of asciiLines) {
      await (serialService as any)._handleLine(l);
    }

    const doc = await Message.findOne({ msgID: 8801, isDemo: false });
    if (doc && doc.payload === 'GROUND SEARCH REPORT' && doc.from === 'B' && doc.to === 'A') {
      console.log('    ✓ ingests and stores physical ESP32 SB1 ASCII telemetry frame');
    } else {
      throw new Error(`Failed to parse SB1 ASCII message: ${JSON.stringify(doc)}`);
    }

    // Now feed ACK frame
    const ackLines = [
      '==============================',
      'ACK RECEIVED',
      '==============================',
      'FROM: TEAM_B',
      'PACKET ID: 8801_1',
      'STATUS: DELIVERED',
      '==============================',
    ];

    for (const l of ackLines) {
      await (serialService as any)._handleLine(l);
    }

    const ackedDoc = await Message.findOne({ msgID: 8801, isDemo: false });
    if (ackedDoc && ackedDoc.status === 'delivered' && ackedDoc.ackReceivedAt) {
      console.log('    ✓ marks message delivered when physical SB1 ASCII ACK frame arrives');
    } else {
      throw new Error(`Failed to deliver on SB1 ASCII ACK: ${JSON.stringify(ackedDoc)}`);
    }
  }
}

