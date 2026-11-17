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
    WHERE email = 'therapist.mock@guildclub.com'`;
  
  // ensure branch assignment
  const [therapist] = await sql`SELECT id FROM users WHERE email = 'therapist.mock@guildclub.com'`;
  const [branch] = await sql`SELECT id FROM branches LIMIT 1`;
  if (therapist && branch) {
    await sql`
      INSERT INTO user_branches (user_id, branch_id, role_in_branch)
      VALUES (${therapist.id}, ${branch.id}, 'therapist')
      ON CONFLICT DO NOTHING`;
  }
  console.log('Mock therapist password set to GuildClub@2026 and branch assigned.');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
