import * as dotenv from 'dotenv';
dotenv.config();
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const hash = await bcrypt.hash('GuildClub@2026', 10);
  await sql`
    UPDATE users 
    SET password_hash = ${hash}, must_change_password = false, is_active = true 
    WHERE email = 'admin.mock@guildclub.com'`;
  console.log('admin.mock password updated to GuildClub@2026');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
