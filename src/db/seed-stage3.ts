import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { APP_TIMEZONE, getTodayIST, getDaysAgoIST } from "../lib/date-utils";

dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to seed Stage 3 demo data.");
  process.exit(1);
}

// Safety guard: refuse to run when NODE_ENV is production or when targeting production DB
if (process.env.NODE_ENV === "production" || (connectionString.includes("/neondb?") && !process.env.ALLOW_PROD_SEED)) {
  console.error("🛑 CRITICAL SAFETY GUARD: Stage 3 demo seeding is refused in production or against the production branch.");
  process.exit(1);
}

const sql = neon(connectionString);

async function seedStage3() {
  console.log("🌱 Starting Stage 3 demo data seeding (500+ events across 30 days)...");

  // 1. Get existing Admin and Therapist users
  const adminRows = await sql`
    SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 3
  `;
  const therapistRows = await sql`
    SELECT id, name, email FROM users WHERE role = 'therapist' LIMIT 5
  `;
  const superAdminRows = await sql`
    SELECT id, name, email FROM users WHERE role = 'super_admin' LIMIT 1
  `;

  if (adminRows.length === 0 || therapistRows.length === 0) {
    console.error("Missing seed users. Please run npm run db:seed first.");
    process.exit(1);
  }

  const superAdmin = superAdminRows[0] || adminRows[0];
  const admin = adminRows[0];
  const therapists = therapistRows;

  // 2. Insert 25 realistic clients if not already present
  console.log("Creating demo clients...");
  const clientNames = [
    ["Aarav Sharma", 28, "Male", "+91 9811100101", "aarav.sharma@example.com"],
    ["Ananya Iyer", 34, "Female", "+91 9811100102", "ananya.iyer@example.com"],
    ["Rohan Verma", 22, "Male", "+91 9811100103", "rohan.verma@example.com"],
    ["Sneha Kulkarni", 41, "Female", "+91 9811100104", "sneha.k@example.com"],
    ["Vikramaditya Rao", 39, "Male", "+91 9811100105", "vikram.rao@example.com"],
    ["Pooja Nair", 29, "Female", "+91 9811100106", "pooja.nair@example.com"],
    ["Karan Mehra", 45, "Male", "+91 9811100107", "karan.mehra@example.com"],
    ["Diya Sengupta", 26, "Female", "+91 9811100108", "diya.s@example.com"],
    ["Aditya Joshi", 31, "Male", "+91 9811100109", "aditya.j@example.com"],
    ["Tanvi Deshmukh", 33, "Female", "+91 9811100110", "tanvi.d@example.com"],
    ["Ishaan Patel", 24, "Male", "+91 9811100111", "ishaan.p@example.com"],
    ["Meera Nambiar", 37, "Female", "+91 9811100112", "meera.n@example.com"],
    ["Arjun Singhania", 48, "Male", "+91 9811100113", "arjun.s@example.com"],
    ["Kavya Reddy", 30, "Female", "+91 9811100114", "kavya.r@example.com"],
    ["Nikhil Kapoor", 36, "Male", "+91 9811100115", "nikhil.k@example.com"],
    ["Rhea Bhattacharya", 27, "Female", "+91 9811100116", "rhea.b@example.com"],
    ["Siddharth Bose", 42, "Male", "+91 9811100117", "sid.bose@example.com"],
    ["Zoya Merchant", 32, "Female", "+91 9811100118", "zoya.m@example.com"],
    ["Devendra Roy", 50, "Male", "+91 9811100119", "dev.roy@example.com"],
    ["Ayesha Khan", 23, "Female", "+91 9811100120", "ayesha.k@example.com"],
  ];

  const clientIds: string[] = [];
  for (const [name, age, gender, phone, email] of clientNames) {
    const res = await sql`
      INSERT INTO clients (full_name, age, gender, phone, email)
      VALUES (${name}, ${age}, ${gender}, ${phone}, ${email})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (res.length > 0) {
      clientIds.push(res[0].id);
    }
  }

  // If already seeded, fetch existing clients
  if (clientIds.length < 15) {
    const existing = await sql`SELECT id FROM clients LIMIT 25`;
    for (const r of existing) {
      if (!clientIds.includes(r.id)) clientIds.push(r.id);
    }
  }

  console.log(`Available clients: ${clientIds.length}`);

  // 3. Create cases across different days in the past 30 days
  const categories = [
    "Cognitive Behavioral Therapy (CBT)",
    "Trauma & PTSD Recovery",
    "Anxiety & Depression",
    "Family & Relationship Counseling",
    "Adolescent Behavioral Care",
    "Occupational Stress Management",
  ];
  const priorities = ["low", "medium", "high", "urgent"] as const;

  const currentYear = new Date().getFullYear();
  let baseSequence = 5000;

  console.log("Generating 30 demo cases...");
  const caseIds: { id: string; number: string; therapistId: string; createdDate: Date }[] = [];

  for (let i = 0; i < 30; i++) {
    const seq = baseSequence + i;
    const caseNumber = `GCS-${currentYear}-${String(seq).padStart(4, "0")}`;
    const clientId = clientIds[i % clientIds.length];
    const category = categories[i % categories.length];
    const priority = priorities[i % priorities.length];
    const therapist = therapists[i % therapists.length];

    // Distribute case creation 1 to 28 days ago
    const daysAgo = 28 - (i % 28);
    const caseDate = new Date();
    caseDate.setDate(caseDate.getDate() - daysAgo);
    caseDate.setHours(10 + (i % 8), (i * 7) % 60, 0, 0);

    const inserted = await sql`
      INSERT INTO cases (case_number, client_id, category, priority, description, status, created_by, current_therapist_id, created_at)
      VALUES (${caseNumber}, ${clientId}, ${category}, ${priority}, 'Clinical intake trajectory for demo analytics and testing.', 'accepted', ${admin.id}, ${therapist.id}, ${caseDate})
      ON CONFLICT (case_number) DO NOTHING
      RETURNING id, case_number
    `;

    if (inserted.length > 0) {
      caseIds.push({
        id: inserted[0].id,
        number: inserted[0].case_number,
        therapistId: therapist.id,
        createdDate: caseDate,
      });
    } else {
      const existing = await sql`SELECT id, case_number FROM cases WHERE case_number = ${caseNumber}`;
      if (existing.length > 0) {
        caseIds.push({
          id: existing[0].id,
          number: existing[0].case_number,
          therapistId: therapist.id,
          createdDate: caseDate,
        });
      }
    }
  }

  console.log(`Cases available for event simulation: ${caseIds.length}`);

  // 4. Generate 500+ case_events across past 30 days
  console.log("Generating 500+ case_events distributed across 30 days...");
  let eventCounter = 0;

  // Track cases we close
  const closedCases = new Set<string>();

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    // Generate 15-20 events per day
    const eventsToday = 16 + (dayOffset % 6);

    for (let e = 0; e < eventsToday; e++) {
      const caseItem = caseIds[(dayOffset * 3 + e) % caseIds.length];
      const therapist = therapists[(e + dayOffset) % therapists.length];

      // Construct timestamp on that day in IST
      // Test hour spread across day: 09:00 to 20:00
      const eventTime = new Date();
      eventTime.setDate(eventTime.getDate() - dayOffset);
      eventTime.setHours(9 + (e % 11), (e * 13) % 60, (e * 23) % 60, 0);

      // Determine event type cyclically
      const eventPick = (e + dayOffset * 2) % 9;

      let eventType = "session_held";
      let actorId = therapist.id;
      let actorRole = "therapist";
      let fromStatus: string | null = null;
      let toStatus: string | null = null;
      let metadata: any = {};

      switch (eventPick) {
        case 0:
          eventType = "case_created";
          actorId = admin.id;
          actorRole = "admin";
          fromStatus = null;
          toStatus = "new";
          metadata = { clientName: "Client Intake", priority: "medium" };
          break;
        case 1:
          eventType = "case_assigned";
          actorId = admin.id;
          actorRole = "admin";
          fromStatus = "new";
          toStatus = "assigned";
          metadata = { therapistId: therapist.id, notes: "Routed to therapist" };
          break;
        case 2:
          eventType = "case_accepted";
          actorId = therapist.id;
          actorRole = "therapist";
          fromStatus = "assigned";
          toStatus = "accepted";
          metadata = { notes: "Accepted into active caseload" };
          break;
        case 3:
          eventType = "session_scheduled";
          actorId = therapist.id;
          actorRole = "therapist";
          metadata = { durationMinutes: 50, notes: "Follow-up CBT module" };
          break;
        case 4:
          eventType = "session_held";
          actorId = therapist.id;
          actorRole = "therapist";
          metadata = { durationMinutes: 50, attendance: "attended", notes: "Review of behavioral targets" };
          break;
        case 5:
          eventType = "note_added";
          actorId = therapist.id;
          actorRole = "therapist";
          metadata = { noteSnippet: "Client showed measurable reduction in somatic symptoms.", isPrivate: false };
          break;
        case 6:
          eventType = "status_changed";
          actorId = therapist.id;
          actorRole = "therapist";
          fromStatus = "accepted";
          toStatus = "in_progress";
          metadata = { reason: "Routine treatment progression" };
          break;
        case 7:
          eventType = "session_missed";
          actorId = therapist.id;
          actorRole = "therapist";
          metadata = { reason: "Client rescheduled due to illness" };
          break;
        case 8:
          eventType = "case_closed";
          actorId = therapist.id;
          actorRole = "therapist";
          fromStatus = "in_progress";
          toStatus = "completed";
          const outcome = (e % 3 === 0) ? "successful" : (e % 3 === 1) ? "referred" : "unsuccessful";
          metadata = { outcome, closingNotes: "Discharge assessment finalized." };
          closedCases.add(caseItem.id);
          break;
      }

      await sql`
        INSERT INTO case_events (event_type, actor_id, actor_role, case_id, from_status, to_status, metadata, occurred_at)
        VALUES (${eventType}, ${actorId}, ${actorRole}, ${caseItem.id}, ${fromStatus}, ${toStatus}, ${JSON.stringify(metadata)}, ${eventTime})
      `;
      eventCounter++;
    }
  }

  // 5. TEST NEAR-MIDNIGHT IST EVENTS (Boundary Verification)
  console.log("Seeding near-midnight IST boundary test events...");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDateStr = yesterday.toISOString().slice(0, 10);

  // Near midnight 1: 23:58:00 IST on target date (UTC 18:28:00)
  // In IST, 23:58 is UTC - 5:30 -> 18:28 UTC
  const lateIST = new Date(`${targetDateStr}T18:28:00.000Z`); // 23:58:00 IST on target date

  // Near midnight 2: 00:03:00 IST next day (UTC 18:33:00)
  const earlyNextIST = new Date(`${targetDateStr}T18:33:00.000Z`); // 00:03:00 IST on next day

  const testCase = caseIds[0];
  await sql`
    INSERT INTO case_events (event_type, actor_id, actor_role, case_id, metadata, occurred_at)
    VALUES ('session_held', ${therapists[0].id}, 'therapist', ${testCase.id}, ${JSON.stringify({ notes: "Midnight Boundary Test - 23:58 IST" })}, ${lateIST})
  `;
  eventCounter++;

  await sql`
    INSERT INTO case_events (event_type, actor_id, actor_role, case_id, metadata, occurred_at)
    VALUES ('session_held', ${therapists[0].id}, 'therapist', ${testCase.id}, ${JSON.stringify({ notes: "Midnight Boundary Test - 00:03 IST Next Day" })}, ${earlyNextIST})
  `;
  eventCounter++;

  console.log(`✅ Stage 3 seeding complete! Total events inserted: ${eventCounter}`);
}

seedStage3().catch((err) => {
  console.error("Stage 3 seeding failed:", err);
  process.exit(1);
});
