import { db } from '../src/prisma/db';
import { hashPassword } from '../src/lib/admin-auth';

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Operations Admin';

  if (!email || !password) {
    console.error('❌ Error: Missing required admin bootstrap credentials.');
    console.error('Please provide ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD environment variables.');
    console.error('Example:');
    console.error('  ADMIN_BOOTSTRAP_EMAIL="admin@example.com" ADMIN_BOOTSTRAP_PASSWORD="YourSecurePassword" npx tsx scripts/bootstrap-admin.ts');
    process.exit(1);
  }

  console.log(`[Admin Bootstrap] Initializing admin account...`);
  console.log(`  Target Email: ${email}`);

  const existing = await db.orm.public.Admin
    .where({ email })
    .first();

  const passwordHash = hashPassword(password);

  if (existing) {
    await db.orm.public.Admin
      .where({ id: existing.id })
      .update({
        passwordHash,
        name,
      });
    console.log(`✓ Updated existing admin account: ${existing.id}`);
  } else {
    const created = await db.orm.public.Admin
      .create({
        email,
        passwordHash,
        name,
        role: 'ADMIN',
      });
    console.log(`✓ Created new admin account: ${created.id}`);
  }

  console.log(`=== Admin Bootstrap Complete ===`);
  console.log(`✓ Account for ${email} is ready.`);
  // Password is NEVER printed to stdout or logs.
  process.exit(0);
}

main().catch((err) => {
  console.error('[Admin Bootstrap Error]', err instanceof Error ? err.message : err);
  process.exit(1);
});
