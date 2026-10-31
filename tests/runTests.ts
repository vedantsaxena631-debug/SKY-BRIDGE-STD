import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup';
import { runAuthTests } from './auth.test';
import { runMessageIdentityTests } from './messages.test';
import { runModeIsolationTests } from './modeIsolation.test';
import { runSerialParsingTests } from './serial.test';

async function main() {
  console.log('\n======================================================');
  console.log('       SKYBRIDGE AUTOMATED BACKEND TEST SUITE        ');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  try {
    const uri = await setupTestDatabase();
    console.log(`[test-runner] MongoDB test engine mounted at: ${uri}`);

    const suites: [string, () => Promise<void>][] = [
      ['Authentication & Session Tokens', runAuthTests],
      ['Message Identity & Sizing Rules', runMessageIdentityTests],
      ['Mode Isolation & Live Statistics', runModeIsolationTests],
      ['Serial Line Ingestion & Deduplication', runSerialParsingTests],
    ];

    for (const [name, run] of suites) {
      try {
        await run();
        passed++;
      } catch (err: any) {
        console.error(`\n  [FAIL] Suite failed: ${name}`);
        console.error(`         ${err.message}\n`);
        failed++;
      }
      await clearTestDatabase();
    }

    await teardownTestDatabase();

    console.log('\n------------------------------------------------------');
    console.log(` SUMMARY: ${passed} SUITES PASSED · ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err: any) {
    console.error('[test-runner] Fatal setup failure:', err);
    await teardownTestDatabase().catch(() => {});
    process.exit(1);
  }
}

main();
