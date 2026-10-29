import * as dotenv from "dotenv";
dotenv.config();

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const users = await sql`
    SELECT id, email, name, role, is_active, created_at
    FROM users
    ORDER BY created_at ASC
  `;
  console.log(`Total users in database: ${users.length}\n`);
  console.table(users);
}

main().catch(console.error);

