// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Seed Script
// Seeds portal_users with test accounts and hashed passwords.
// All accounts default to password: Test@1234
//
// Run: npx tsx scripts/seed-users.ts
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';
import { hash } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_PASSWORD = 'Test@1234';

const users: [string, string, string][] = [
  ['abcdqrst404@gmail.com',     'Priya Sharma',  'teacher'],
  ['official.tishnu@gmail.com', 'Rahul Nair',    'student'],
  ['official4tishnu@gmail.com', 'Seema Verma',   'coordinator'],
  ['dev.poornasree@gmail.com',  'Dr. Mehta',     'academic_operator'],
  ['tech.poornasree@gmail.com',  'Ayesha Khan',   'hr'],
  ['idukki.karan404@gmail.com', 'Nair P.',        'parent'],
  ['tishnuvichuz143@gmail.com', 'Admin Owner',   'owner'],
  ['info.pydart@gmail.com',     'Nour Observer', 'ghost'],
];

async function seed() {
  console.log('🔐 Hashing passwords...');
  const passwordHash = await hash(DEFAULT_PASSWORD, 12);

  console.log('📥 Seeding portal_users...\n');

  for (const [email, name, role] of users) {
    await pool.query(
      `INSERT INTO portal_users (email, full_name, portal_role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         full_name     = $2,
         portal_role   = $3,
         password_hash = $4,
         is_active     = TRUE,
         updated_at    = NOW()`,
      [email, name, role, passwordHash]
    );
    console.log(`  ✅ ${email.padEnd(35)} → ${role}`);
  }

  console.log('\n📋 Current portal_users:');
  const res = await pool.query(
    `SELECT email, full_name, portal_role,
            CASE WHEN password_hash IS NOT NULL THEN '✓ set' ELSE '✗ not set' END AS password
     FROM portal_users ORDER BY portal_role`
  );
  console.table(res.rows);

  console.log(`\n✅ All users seeded. Default password: ${DEFAULT_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
