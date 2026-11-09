import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { cases } from "../src/db/schema";

async function main() {
  const enumRows = await db.execute(sql`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'service_type'
    ORDER BY pg_enum.enumsortorder;
  `);
  console.log("service_type enum values in DB:", enumRows.rows);

  const caseServiceCounts = await db.execute(sql`
    SELECT service, count(*)::int as count
    FROM cases
    GROUP BY service
    ORDER BY count DESC;
  `);
  console.log("Current cases grouped by service in DB:", caseServiceCounts.rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
