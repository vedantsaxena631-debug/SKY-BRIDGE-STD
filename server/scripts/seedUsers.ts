import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const accounts = [
  { username: 'admin', role: 'admin', team: null, envKey: 'SEED_ADMIN_PASSWORD', defaultPass: 'admin123' },
  { username: 'team-a', role: 'operator', team: 'A', envKey: 'SEED_OPERATOR_A_PASSWORD', defaultPass: 'teama123' },
  { username: 'team-b', role: 'operator', team: 'B', envKey: 'SEED_OPERATOR_B_PASSWORD', defaultPass: 'teamb123' },
  { username: 'observer', role: 'viewer', team: null, envKey: 'SEED_VIEWER_PASSWORD', defaultPass: 'viewer123' },
];

export async function seedUsers() {
  console.log('[seed] checking SkyBridge seed accounts...');

  for (const account of accounts) {
    const password = process.env[account.envKey] || account.defaultPass;

    const existing = await User.findOne({ username: account.username });
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = account.role;
      existing.team = account.team;
      await existing.save();
      console.log(`[seed] updated  ${account.username.padEnd(10)} role=${account.role} team=${account.team ?? '-'}`);
    } else {
      await User.create({
        username: account.username,
        passwordHash,
        role: account.role as any,
        team: account.team as any,
      });
      console.log(`[seed] created  ${account.username.padEnd(10)} role=${account.role} team=${account.team ?? '-'}`);
    }
  }

  console.log('[seed] user seeding complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
