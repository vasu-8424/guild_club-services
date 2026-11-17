import * as dotenv from 'dotenv';
dotenv.config();
import { neon } from '@neondatabase/serverless';

async function checkRooms() {
  const sql = neon(process.env.DATABASE_URL!);
  const branchList = await sql`SELECT id, name FROM branches`;
  console.log('Branches:', branchList);
  const roomList = await sql`SELECT id, branch_id, room_no, is_active FROM rooms`;
  console.log('Rooms:', roomList);
  process.exit(0);
}
checkRooms().catch((e) => {
  console.error(e);
  process.exit(1);
});
