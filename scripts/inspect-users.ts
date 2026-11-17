import * as dotenv from 'dotenv';
dotenv.config();
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("NO DATABASE_URL");
    return;
  }
  const sql = neon(dbUrl);
  
  console.log("Searching for jahnavi...");
  const users = await sql`SELECT id, name, email, role, is_active, created_at, password_hash FROM users WHERE email ILIKE '%jahnavi%' OR name ILIKE '%jahnavi%'`;
  console.log("Jahnavi:", users);

  console.log("\nAll users in users table:");
  const allUsers = await sql`SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at ASC`;
  console.log(allUsers);
}

main().catch(console.error);
