import connectDatabase, { disconnectDatabase } from '../server/db';
import { Message } from '../server/models/Message';
import { User } from '../server/models/User';

export async function runIntegrityChecks(): Promise<{ success: boolean; failures: number; details: Record<string, any> }> {
  console.log('\n======================================================');
  console.log('    SKYBRIDGE DATA INTEGRITY VERIFICATION (VIVA PROOF) ');
  console.log('======================================================\n');

  let failures = 0;
  const details: Record<string, any> = {};

  // Check 1: Records with no mode flag
  const unflagged = await Message.countDocuments({ isDemo: { $exists: false } });
  details.unflagged = unflagged;
  if (unflagged > 0) {
    console.error(`[FAIL] Check 1: ${unflagged} records missing isDemo flag.`);
    failures++;
  } else {
    console.log(' [PASS] Check 1: 0 records missing mode flag.');
  }

  // Check 2: Demo records that leaked in from hardware
  const leakedHardware = await Message.countDocuments({ isDemo: true, source: 'hardware' });
  details.leakedHardware = leakedHardware;
  if (leakedHardware > 0) {
    console.error(`[FAIL] Check 2: ${leakedHardware} demo records tagged as physical hardware.`);
    failures++;
  } else {
    console.log(' [PASS] Check 2: 0 hardware demo records (hardware is strictly live).');
  }

  // Check 3: Delivered with no acknowledgment timestamp
  const missingAck = await Message.countDocuments({ status: 'delivered', ackReceivedAt: null });
  details.missingAck = missingAck;
  if (missingAck > 0) {
    console.error(`[FAIL] Check 3: ${missingAck} messages marked delivered without ACK timestamp.`);
    failures++;
  } else {
    console.log(' [PASS] Check 3: 0 delivered messages lacking physical ACK timestamp.');
  }

  // Check 4: A message claiming to be from and to the same node
  const selfAddressed = await Message.countDocuments({ $expr: { $eq: ['$from', '$to'] } });
  details.selfAddressed = selfAddressed;
  if (selfAddressed > 0) {
    console.error(`[FAIL] Check 4: ${selfAddressed} self-addressed messages (from === to).`);
    failures++;
  } else {
    console.log(' [PASS] Check 4: 0 self-addressed messages.');
  }

  // Check 5: Duplicate msgIDs within the same mode
  const duplicates = await Message.aggregate([
    { $group: { _id: { id: '$msgID', demo: '$isDemo' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  details.duplicates = duplicates.length;
  if (duplicates.length > 0) {
    console.error(`[FAIL] Check 5: ${duplicates.length} duplicate msgIDs detected within mode.`);
    failures++;
  } else {
    console.log(' [PASS] Check 5: 0 duplicate msgIDs within the same mode.');
  }

  // Check 6: Any password field that isn't a bcrypt hash
  const invalidHashes = await User.countDocuments({ passwordHash: { $not: /^\$2[aby]\$/ } });
  details.invalidHashes = invalidHashes;
  if (invalidHashes > 0) {
    console.error(`[FAIL] Check 6: ${invalidHashes} user records lack valid bcrypt hash prefix.`);
    failures++;
  } else {
    console.log(' [PASS] Check 6: All stored passwords are secure bcrypt hashes.');
  }

  console.log('\n------------------------------------------------------');
  if (failures === 0) {
    console.log(' RESULT: ALL 6 CHECKS CLEAN (0 defects). Database is certified.');
  } else {
    console.error(` RESULT: INTEGRITY FAILED (${failures} defects found).`);
  }
  console.log('======================================================\n');

  return { success: failures === 0, failures, details };
}

// If executed directly from CLI
if (process.argv[1]?.endsWith('verifyIntegrity.ts') || process.argv[1]?.endsWith('verifyIntegrity.js')) {
  (async () => {
    try {
      await connectDatabase();
      const result = await runIntegrityChecks();
      await disconnectDatabase();
      process.exit(result.success ? 0 : 1);
    } catch (err: any) {
      console.error('[verifyIntegrity] fatal error:', err.message);
      process.exit(1);
    }
  })();
}
