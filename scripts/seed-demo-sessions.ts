import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL is not defined in .env");
  process.exit(1);
}

// Strict safety check: refuse to run in production
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || (dbUrl.includes("/neondb?") && !process.env.ALLOW_PROD_SEED)) {
  console.error("❌ Refusing to run demo seed script in production or against the production database!");
  process.exit(1);
}

const sql = neon(dbUrl);

export async function seedDemoSessions(targetEmail?: string) {
  const therapistEmail = targetEmail || process.argv[2] || "veeravasu944@gmail.com";
  console.log(`🌱 Seeding demo session board for therapist: ${therapistEmail}`);

  // 1. Locate therapist user
  const users = await sql`
    SELECT id, name, email, role
    FROM users
    WHERE email = ${therapistEmail} OR name ILIKE '%Veera%Vasu%'
    LIMIT 1
  `;

  if (users.length === 0) {
    console.error(`❌ Therapist not found for email '${therapistEmail}'. Available therapists:`);
    const allTherapists = await sql`
      SELECT id, name, email FROM users WHERE role = 'therapist'
    `;
    console.table(allTherapists);
    process.exit(1);
  }

  const therapist = users[0];
  console.log(`✅ Therapist found: ${therapist.name} (${therapist.id})`);

  // Ensure therapist_profiles exists
  await sql`
    INSERT INTO therapist_profiles (user_id, specialization, experience_years, max_open_cases)
    VALUES (${therapist.id}, 'Cognitive Behavioral Therapy (CBT)', 5, 12)
    ON CONFLICT (user_id) DO NOTHING
  `;

  // 2. Compute today's date in IST (Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayIST = formatter.format(new Date()); // YYYY-MM-DD
  console.log(`📅 Target IST Date: ${todayIST}`);

  // 3. Assign Room for Today: "Room 204"
  const roomNo = "Room 204";
  await sql`
    INSERT INTO therapist_room_assignments (therapist_id, assigned_date, room_no, created_by, created_at)
    VALUES (${therapist.id}, ${todayIST}, ${roomNo}, ${therapist.id}, NOW())
    ON CONFLICT (therapist_id, assigned_date) 
    DO UPDATE SET room_no = ${roomNo}
  `;
  console.log(`✅ Assigned room '${roomNo}' for date ${todayIST}`);

  // 4. Create or reuse Demo Client
  const clientPhone = "+91 9820012345";
  const existingClients = await sql`
    SELECT id, full_name, age FROM clients WHERE phone = ${clientPhone} LIMIT 1
  `;

  let clientId: string;
  if (existingClients.length > 0) {
    clientId = existingClients[0].id;
    console.log(`✅ Using existing demo client: ${existingClients[0].full_name} (${clientId})`);
  } else {
    const [newClient] = await sql`
      INSERT INTO clients (full_name, age, gender, phone, email)
      VALUES ('Aarav Sharma', 29, 'Male', ${clientPhone}, 'aarav.sharma.demo@guildclub.com')
      RETURNING id, full_name
    `;
    clientId = newClient.id;
    console.log(`✅ Created demo client: ${newClient.full_name} (${clientId})`);
  }

  // 5. Create or reuse Demo Case in 'accepted' status
  const caseNumber = "GCS-2026-DEMO1";
  const existingCases = await sql`
    SELECT id, case_number, status, current_therapist_id
    FROM cases
    WHERE case_number = ${caseNumber}
    LIMIT 1
  `;

  let caseId: string;
  if (existingCases.length > 0) {
    caseId = existingCases[0].id;
    await sql`
      UPDATE cases
      SET current_therapist_id = ${therapist.id}, status = 'accepted'
      WHERE id = ${caseId}
    `;
    console.log(`✅ Reusing existing case ${caseNumber} (${caseId}) in accepted status`);
  } else {
    const [newCase] = await sql`
      INSERT INTO cases (
        case_number, client_id, category, priority, status, description,
        current_therapist_id, created_by
      )
      VALUES (
        ${caseNumber}, ${clientId}, 'Psychotherapy', 'medium', 'accepted',
        'Demonstration clinical case for session board verification.',
        ${therapist.id}, ${therapist.id}
      )
      RETURNING id
    `;
    caseId = newCase.id;
    console.log(`✅ Created demo case ${caseNumber} (${caseId})`);
  }

  // 6. Generate 10 sessions today at 30-min intervals starting from 09:00 IST
  // 3 completed, 7 pending
  const sessionSlots = [
    { hour: 9, min: 0, status: "held" },
    { hour: 9, min: 30, status: "held" },
    { hour: 10, min: 0, status: "held" },
    { hour: 10, min: 30, status: "scheduled" },
    { hour: 11, min: 0, status: "scheduled" },
    { hour: 11, min: 30, status: "scheduled" },
    { hour: 12, min: 0, status: "scheduled" },
    { hour: 12, min: 30, status: "scheduled" },
    { hour: 13, min: 0, status: "scheduled" },
    { hour: 13, min: 30, status: "scheduled" },
  ];

  console.log(`⏳ Seeding 10 sessions for ${todayIST} (3 completed, 7 pending)...`);

  for (const slot of sessionSlots) {
    // Construct exact ISO timestamp in IST: YYYY-MM-DDTHH:mm:00+05:30
    const hh = String(slot.hour).padStart(2, "0");
    const mm = String(slot.min).padStart(2, "0");
    const scheduledAtStr = `${todayIST}T${hh}:${mm}:00+05:30`;

    // Check if session already exists for this case + therapist + scheduledAt
    const existingSession = await sql`
      SELECT id FROM sessions
      WHERE case_id = ${caseId}
        AND therapist_id = ${therapist.id}
        AND scheduled_at = ${scheduledAtStr}::timestamptz
      LIMIT 1
    `;

    const isCompleted = slot.status === "held";
    const inTimeAt = isCompleted ? `${todayIST}T${hh}:${String(slot.min + 2).padStart(2, "0")}:00+05:30` : null;
    const outTimeAt = isCompleted ? `${todayIST}T${hh}:${String(slot.min + 25).padStart(2, "0")}:00+05:30` : null;
    const completedAt = isCompleted ? `${todayIST}T${hh}:${String(slot.min + 26).padStart(2, "0")}:00+05:30` : null;
    const inPhotoKey = isCompleted ? "demo/in-time-demo.jpg" : null;
    const outPhotoKey = isCompleted ? "demo/out-time-demo.jpg" : null;
    const workDone = isCompleted
      ? "Reviewed mindfulness exercises and cognitive restructuring interventions. Patient engaged in self-reflection."
      : null;
    const sigKey = isCompleted ? "demo/patient-sig-demo.png" : null;

    if (existingSession.length > 0) {
      await sql`
        UPDATE sessions
        SET status = ${slot.status},
            in_time_at = ${inTimeAt ? sql`${inTimeAt}::timestamptz` : null},
            in_time_photo_key = ${inPhotoKey},
            out_time_at = ${outTimeAt ? sql`${outTimeAt}::timestamptz` : null},
            out_time_photo_key = ${outPhotoKey},
            work_done = ${workDone},
            patient_signature_key = ${sigKey},
            photo_consent = true,
            completed_at = ${completedAt ? sql`${completedAt}::timestamptz` : null}
        WHERE id = ${existingSession[0].id}
      `;
    } else {
      await sql`
        INSERT INTO sessions (
          case_id, therapist_id, scheduled_at, status, notes,
          in_time_at, in_time_photo_key, out_time_at, out_time_photo_key,
          work_done, patient_signature_key, photo_consent, completed_at
        )
        VALUES (
          ${caseId}, ${therapist.id}, ${scheduledAtStr}::timestamptz, ${slot.status},
          'Demo therapy appointment',
          ${inTimeAt ? sql`${inTimeAt}::timestamptz` : null},
          ${inPhotoKey},
          ${outTimeAt ? sql`${outTimeAt}::timestamptz` : null},
          ${outPhotoKey},
          ${workDone},
          ${sigKey},
          true,
          ${completedAt ? sql`${completedAt}::timestamptz` : null}
        )
      `;
    }
  }

  console.log("🎉 Demo sessions successfully seeded!");
  console.log(`- Therapist: ${therapist.name} (${therapist.email})`);
  console.log(`- Room: ${roomNo}`);
  console.log(`- Sessions: 10 total (3 completed / green, 7 pending / red)`);
}

// Run directly if invoked from CLI
if (require.main === module) {
  seedDemoSessions().catch((err) => {
    console.error("Fatal error running seed-demo-sessions:", err);
    process.exit(1);
  });
}
