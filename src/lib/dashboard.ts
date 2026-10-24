import { neon } from "@neondatabase/serverless";
import type { CurrentUser } from "@/lib/session";
import type { DateFilterRange } from "@/lib/date-utils";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(url);
}

// -----------------------------------------------------------------------------
// 1. DASHBOARD SUMMARY COUNTS & SUCCESS RATES
// -----------------------------------------------------------------------------

export interface DashboardSummary {
  dateRange: DateFilterRange;
  casesCreated: number;
  casesAssigned: number;
  casesAccepted: number;
  casesDeclined: number;
  sessionsScheduled: number;
  sessionsHeld: number;
  sessionsMissed: number;
  notesAdded: number;
  casesClosed: number;
  successfulClosures: number;
  unsuccessfulClosures: number;
  referredClosures: number;
  daySuccessRate: number;        // (successfulClosures / casesClosed) * 100 on selected date
  successRateToDate: number;     // cumulative to date
  totalActivityCount: number;
  hasActivity: boolean;
}

export async function getDashboardSummary(
  user: CurrentUser,
  filter: DateFilterRange
): Promise<DashboardSummary> {
  const sql = getSql();

  const isTherapist = user.role === "therapist";
  const therapistId = user.id;

  // Day window query
  const query = `
    SELECT 
      ce.event_type,
      ce.metadata->>'outcome' as outcome,
      COUNT(*)::int as count
    FROM case_events ce
    LEFT JOIN cases c ON ce.case_id = c.id
    WHERE ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      ${
        isTherapist
          ? `AND (
              ce.actor_id = $3
              OR (ce.metadata->>'therapistId') = $3::text
              OR c.current_therapist_id = $3
            )`
          : ""
      }
    GROUP BY ce.event_type, ce.metadata->>'outcome'
  `;

  const params: (string | number)[] = [filter.startDate, filter.endDate];
  if (isTherapist) {
    params.push(therapistId);
  }

  const rows = (await sql.query(query, params)) as {
    event_type: string;
    outcome: string | null;
    count: number;
  }[];

  let casesCreated = 0;
  let casesAssigned = 0;
  let casesAccepted = 0;
  let casesDeclined = 0;
  let sessionsScheduled = 0;
  let sessionsHeld = 0;
  let sessionsMissed = 0;
  let notesAdded = 0;
  let casesClosed = 0;
  let successfulClosures = 0;
  let unsuccessfulClosures = 0;
  let referredClosures = 0;
  let totalActivityCount = 0;

  for (const row of rows) {
    const c = Number(row.count) || 0;
    totalActivityCount += c;

    switch (row.event_type) {
      case "case_created":
        casesCreated += c;
        break;
      case "case_assigned":
        casesAssigned += c;
        break;
      case "case_accepted":
        casesAccepted += c;
        break;
      case "case_declined":
        casesDeclined += c;
        break;
      case "session_scheduled":
        sessionsScheduled += c;
        break;
      case "session_held":
        sessionsHeld += c;
        break;
      case "session_missed":
        sessionsMissed += c;
        break;
      case "note_added":
        notesAdded += c;
        break;
      case "case_closed":
        casesClosed += c;
        if (row.outcome === "successful") successfulClosures += c;
        else if (row.outcome === "unsuccessful") unsuccessfulClosures += c;
        else if (row.outcome === "referred") referredClosures += c;
        break;
    }
  }

  const daySuccessRate = casesClosed > 0 ? Math.round((successfulClosures / casesClosed) * 100) : 0;

  // Cumulative success rate to date (up to filter.endDate)
  const toDateQuery = `
    SELECT 
      COUNT(*)::int as total_closed,
      COUNT(CASE WHEN metadata->>'outcome' = 'successful' THEN 1 END)::int as total_successful
    FROM case_events ce
    LEFT JOIN cases c ON ce.case_id = c.id
    WHERE ce.event_type = 'case_closed'
      AND ce.occurred_at < (($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      ${
        isTherapist
          ? `AND (
              ce.actor_id = $2
              OR (ce.metadata->>'therapistId') = $2::text
              OR c.current_therapist_id = $2
            )`
          : ""
      }
  `;

  const toDateParams: (string | number)[] = [filter.endDate];
  if (isTherapist) {
    toDateParams.push(therapistId);
  }

  const toDateRows = (await sql.query(toDateQuery, toDateParams)) as {
    total_closed: number;
    total_successful: number;
  }[];

  const cumClosed = Number(toDateRows[0]?.total_closed) || 0;
  const cumSuccessful = Number(toDateRows[0]?.total_successful) || 0;
  const successRateToDate = cumClosed > 0 ? Math.round((cumSuccessful / cumClosed) * 100) : 0;

  return {
    dateRange: filter,
    casesCreated,
    casesAssigned,
    casesAccepted,
    casesDeclined,
    sessionsScheduled,
    sessionsHeld,
    sessionsMissed,
    notesAdded,
    casesClosed,
    successfulClosures,
    unsuccessfulClosures,
    referredClosures,
    daySuccessRate,
    successRateToDate,
    totalActivityCount,
    hasActivity: totalActivityCount > 0,
  };
}

// -----------------------------------------------------------------------------
// 2. PEOPLE SUMMARY (PER ADMIN & PER THERAPIST)
// -----------------------------------------------------------------------------

export interface PersonActivitySummary {
  actorId: string;
  name: string;
  email: string;
  role: "admin" | "therapist" | "super_admin";
  specialization?: string;
  totalActions: number;
  narrativeText: string;
  breakdown: {
    casesCreated: number;
    casesAssigned: number;
    casesAccepted: number;
    casesDeclined: number;
    sessionsHeld: number;
    sessionsScheduled: number;
    notesAdded: number;
    casesClosed: number;
    therapistsRegistered: number;
  };
}

export async function getPeopleSummary(
  user: CurrentUser,
  filter: DateFilterRange
): Promise<PersonActivitySummary[]> {
  if (user.role === "therapist") {
    return [];
  }

  const sql = getSql();

  const query = `
    SELECT 
      u.id as actor_id,
      u.name,
      u.email,
      u.role,
      tp.specialization,
      ce.event_type,
      COUNT(*)::int as count
    FROM case_events ce
    INNER JOIN users u ON ce.actor_id = u.id
    LEFT JOIN therapist_profiles tp ON u.id = tp.user_id
    WHERE ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND u.role IN ('admin', 'therapist')
    GROUP BY u.id, u.name, u.email, u.role, tp.specialization, ce.event_type
    ORDER BY u.role ASC, u.name ASC
  `;

  const rows = (await sql.query(query, [filter.startDate, filter.endDate])) as {
    actor_id: string;
    name: string;
    email: string;
    role: "admin" | "therapist";
    specialization: string | null;
    event_type: string;
    count: number;
  }[];

  const peopleMap = new Map<string, PersonActivitySummary>();

  for (const r of rows) {
    if (!peopleMap.has(r.actor_id)) {
      peopleMap.set(r.actor_id, {
        actorId: r.actor_id,
        name: r.name,
        email: r.email,
        role: r.role,
        specialization: r.specialization || undefined,
        totalActions: 0,
        narrativeText: "",
        breakdown: {
          casesCreated: 0,
          casesAssigned: 0,
          casesAccepted: 0,
          casesDeclined: 0,
          sessionsHeld: 0,
          sessionsScheduled: 0,
          notesAdded: 0,
          casesClosed: 0,
          therapistsRegistered: 0,
        },
      });
    }

    const item = peopleMap.get(r.actor_id)!;
    const c = Number(r.count) || 0;
    item.totalActions += c;

    switch (r.event_type) {
      case "case_created":
        item.breakdown.casesCreated += c;
        break;
      case "case_assigned":
        item.breakdown.casesAssigned += c;
        break;
      case "case_accepted":
        item.breakdown.casesAccepted += c;
        break;
      case "case_declined":
        item.breakdown.casesDeclined += c;
        break;
      case "session_held":
        item.breakdown.sessionsHeld += c;
        break;
      case "session_scheduled":
        item.breakdown.sessionsScheduled += c;
        break;
      case "note_added":
        item.breakdown.notesAdded += c;
        break;
      case "case_closed":
        item.breakdown.casesClosed += c;
        break;
      case "therapist_registered":
        item.breakdown.therapistsRegistered += c;
        break;
    }
  }

  // Generate narrative descriptions like "Created 5 cases, assigned 4" or "Held 3 sessions, closed 1 case"
  const summaries = Array.from(peopleMap.values()).map((p) => {
    const parts: string[] = [];
    if (p.role === "admin") {
      if (p.breakdown.casesCreated > 0) parts.push(`Created ${p.breakdown.casesCreated} case${p.breakdown.casesCreated > 1 ? "s" : ""}`);
      if (p.breakdown.casesAssigned > 0) parts.push(`Assigned ${p.breakdown.casesAssigned}`);
      if (p.breakdown.therapistsRegistered > 0) parts.push(`Registered ${p.breakdown.therapistsRegistered} therapist${p.breakdown.therapistsRegistered > 1 ? "s" : ""}`);
    } else {
      if (p.breakdown.sessionsHeld > 0) parts.push(`Held ${p.breakdown.sessionsHeld} session${p.breakdown.sessionsHeld > 1 ? "s" : ""}`);
      if (p.breakdown.notesAdded > 0) parts.push(`Added ${p.breakdown.notesAdded} note${p.breakdown.notesAdded > 1 ? "s" : ""}`);
      if (p.breakdown.casesAccepted > 0) parts.push(`Accepted ${p.breakdown.casesAccepted} case${p.breakdown.casesAccepted > 1 ? "s" : ""}`);
      if (p.breakdown.casesClosed > 0) parts.push(`Closed ${p.breakdown.casesClosed} case${p.breakdown.casesClosed > 1 ? "s" : ""}`);
      if (p.breakdown.casesDeclined > 0) parts.push(`Declined ${p.breakdown.casesDeclined}`);
      if (p.breakdown.sessionsScheduled > 0) parts.push(`Scheduled ${p.breakdown.sessionsScheduled}`);
    }

    p.narrativeText = parts.length > 0 ? parts.join(", ") : `${p.totalActions} logged action${p.totalActions > 1 ? "s" : ""}`;
    return p;
  });

  return summaries.sort((a, b) => b.totalActions - a.totalActions);
}

// -----------------------------------------------------------------------------
// 3. CASE MOVEMENTS (STATUS TRANSITIONS)
// -----------------------------------------------------------------------------

export interface CaseMovementItem {
  id: number;
  caseId: string;
  caseNumber: string;
  clientName: string;
  category: string;
  priority: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  fromStatus: string;
  toStatus: string;
  eventType: string;
  occurredAt: Date;
  notes?: string;
  outcome?: string;
}

export async function getCaseMovements(
  user: CurrentUser,
  filter: DateFilterRange
): Promise<CaseMovementItem[]> {
  if (user.role === "therapist") {
    return [];
  }

  const sql = getSql();

  const query = `
    SELECT 
      ce.id,
      ce.case_id,
      c.case_number,
      cl.full_name as client_name,
      c.category,
      c.priority,
      ce.actor_id,
      u.name as actor_name,
      ce.actor_role,
      ce.from_status,
      ce.to_status,
      ce.event_type,
      ce.occurred_at,
      ce.metadata->>'notes' as notes,
      ce.metadata->>'outcome' as outcome
    FROM case_events ce
    INNER JOIN cases c ON ce.case_id = c.id
    INNER JOIN clients cl ON c.client_id = cl.id
    INNER JOIN users u ON ce.actor_id = u.id
    WHERE ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND ce.from_status IS NOT NULL 
      AND ce.to_status IS NOT NULL
      AND ce.from_status != ce.to_status
    ORDER BY ce.occurred_at DESC
    LIMIT 100
  `;

  const rows = (await sql.query(query, [filter.startDate, filter.endDate])) as any[];

  return rows.map((r) => ({
    id: Number(r.id),
    caseId: r.case_id,
    caseNumber: r.case_number,
    clientName: r.client_name,
    category: r.category,
    priority: r.priority,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    eventType: r.event_type,
    occurredAt: new Date(r.occurred_at),
    notes: r.notes || undefined,
    outcome: r.outcome || undefined,
  }));
}

// -----------------------------------------------------------------------------
// 4. UNASSIGNED CASES AS OF DATE
// -----------------------------------------------------------------------------

export interface UnassignedCaseState {
  caseId: string;
  caseNumber: string;
  clientName: string;
  category: string;
  priority: string;
  createdAt: Date;
  daysPending: number;
}

export async function getUnassignedCasesAsOf(
  filter: DateFilterRange
): Promise<UnassignedCaseState[]> {
  const sql = getSql();

  // Find latest status event on or before filter.endDate for each case
  const query = `
    WITH latest_events AS (
      SELECT 
        ce.case_id,
        ce.to_status,
        ce.event_type,
        ROW_NUMBER() OVER (
          PARTITION BY ce.case_id 
          ORDER BY ce.occurred_at DESC, ce.id DESC
        ) as rn
      FROM case_events ce
      WHERE ce.occurred_at < (($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
        AND ce.case_id IS NOT NULL
    )
    SELECT 
      c.id as case_id,
      c.case_number,
      cl.full_name as client_name,
      c.category,
      c.priority,
      c.created_at,
      ROUND(EXTRACT(EPOCH FROM ((($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata' - c.created_at)) / 86400)::int as days_pending
    FROM cases c
    INNER JOIN clients cl ON c.client_id = cl.id
    INNER JOIN latest_events le ON c.id = le.case_id AND le.rn = 1
    WHERE c.created_at < (($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND (le.to_status = 'new' OR le.event_type = 'case_declined')
    ORDER BY c.created_at ASC
    LIMIT 50
  `;

  const rows = (await sql.query(query, [filter.endDate])) as any[];

  return rows.map((r) => ({
    caseId: r.case_id,
    caseNumber: r.case_number,
    clientName: r.client_name,
    category: r.category,
    priority: r.priority,
    createdAt: new Date(r.created_at),
    daysPending: Math.max(0, Number(r.days_pending) || 0),
  }));
}

// -----------------------------------------------------------------------------
// 5. DRILL-DOWN ACTION DETAILS
// -----------------------------------------------------------------------------

export interface DrilldownActionItem {
  id: number;
  eventType: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  caseId?: string;
  caseNumber?: string;
  clientName?: string;
  fromStatus?: string;
  toStatus?: string;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
}

export async function getDrilldownActions(
  user: CurrentUser,
  params: {
    filter: DateFilterRange;
    actorId?: string;
    caseId?: string;
    eventType?: string;
  }
): Promise<DrilldownActionItem[]> {
  const sql = getSql();

  const isTherapist = user.role === "therapist";
  let targetActorId = params.actorId;
  let targetCaseId = params.caseId;

  // Strict role check: therapists can ONLY inspect their own actions or cases assigned to them
  if (isTherapist) {
    if (targetCaseId) {
      // Verify case belongs to therapist
      const caseCheck = await sql`
        SELECT id FROM cases 
        WHERE id = ${targetCaseId} AND current_therapist_id = ${user.id} 
        LIMIT 1
      `;
      if (caseCheck.length === 0) {
        return [];
      }
    } else {
      // Force therapist user ID
      targetActorId = user.id;
    }
  }

  let conditions: string[] = [
    `ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`,
    `ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`,
  ];
  const queryParams: any[] = [params.filter.startDate, params.filter.endDate];

  if (targetActorId) {
    queryParams.push(targetActorId);
    conditions.push(`ce.actor_id = $${queryParams.length}`);
  }

  if (targetCaseId) {
    queryParams.push(targetCaseId);
    conditions.push(`ce.case_id = $${queryParams.length}`);
  }

  if (params.eventType) {
    queryParams.push(params.eventType);
    conditions.push(`ce.event_type = $${queryParams.length}`);
  }

  if (isTherapist && !targetCaseId && !targetActorId) {
    queryParams.push(user.id);
    conditions.push(`(ce.actor_id = $${queryParams.length} OR c.current_therapist_id = $${queryParams.length})`);
  }

  const query = `
    SELECT 
      ce.id,
      ce.event_type,
      ce.actor_id,
      u.name as actor_name,
      ce.actor_role,
      ce.case_id,
      c.case_number,
      cl.full_name as client_name,
      ce.from_status,
      ce.to_status,
      ce.metadata,
      ce.occurred_at
    FROM case_events ce
    INNER JOIN users u ON ce.actor_id = u.id
    LEFT JOIN cases c ON ce.case_id = c.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ce.occurred_at DESC
    LIMIT 150
  `;

  const rows = (await sql.query(query, queryParams)) as any[];

  return rows.map((r) => ({
    id: Number(r.id),
    eventType: r.event_type,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    caseId: r.case_id || undefined,
    caseNumber: r.case_number || undefined,
    clientName: r.client_name || undefined,
    fromStatus: r.from_status || undefined,
    toStatus: r.to_status || undefined,
    metadata: r.metadata,
    occurredAt: new Date(r.occurred_at),
  }));
}

// -----------------------------------------------------------------------------
// 6. SUPER ADMIN ANALYTICS & REPORTS (/super-admin/reports)
// -----------------------------------------------------------------------------

export interface SuperAdminReportsData {
  overallMetrics: {
    totalCases: number;
    totalClosed: number;
    successfulClosures: number;
    overallSuccessRate: number; // percentage
    avgResolutionDays: number;  // case created -> closed
    avgAcceptanceHours: number; // assigned -> accepted
    reassignmentRate: number;   // declined / assigned * 100
    totalSessionsHeld: number;
  };
  therapistPerformance: {
    therapistId: string;
    therapistName: string;
    specialization: string;
    totalAssigned: number;
    acceptedCount: number;
    declinedCount: number;
    sessionsHeld: number;
    casesClosed: number;
    successfulCount: number;
    successRate: number; // %
    avgResolutionDays: number;
  }[];
  monthlyTrends: {
    monthLabel: string; // "Oct 2026"
    casesCreated: number;
    casesClosed: number;
    successfulClosed: number;
    sessionsHeld: number;
    successRate: number;
  }[];
  categoryBreakdown: {
    category: string;
    count: number;
    percentage: number;
  }[];
  priorityBreakdown: {
    priority: string;
    count: number;
  }[];
}

export async function getSuperAdminReports(
  dateFilter?: { startDate?: string; endDate?: string }
): Promise<SuperAdminReportsData> {
  const sql = getSql();

  const hasDateFilter = Boolean(dateFilter?.startDate && dateFilter?.endDate);
  const dateParams: string[] = hasDateFilter
    ? [dateFilter!.startDate!, dateFilter!.endDate!]
    : [];

  const dateWhereCases = hasDateFilter
    ? `WHERE created_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND created_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`
    : "";

  const dateWhereEvents = hasDateFilter
    ? `WHERE occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`
    : "";

  // 1. Total cases, closed, successful
  const totalsQuery = `
    SELECT 
      COUNT(*)::int as total_cases,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as total_closed,
      COUNT(CASE WHEN status = 'completed' AND outcome = 'successful' THEN 1 END)::int as successful_closures,
      ROUND(AVG(
        CASE WHEN status = 'completed' AND closed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400
        END
      )::numeric, 1) as avg_resolution_days
    FROM cases
    ${dateWhereCases}
  `;
  const totals = (await sql.query(totalsQuery, dateParams))[0] as any;

  // 2. Acceptance time (assigned -> accepted) & Reassignment rate
  const acceptanceQuery = `
    WITH assigned_events AS (
      SELECT case_id, occurred_at as assigned_at
      FROM case_events
      WHERE event_type = 'case_assigned'
      ${hasDateFilter ? `AND occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'` : ""}
    ),
    accepted_events AS (
      SELECT case_id, occurred_at as accepted_at
      FROM case_events
      WHERE event_type = 'case_accepted'
    ),
    declined_count AS (
      SELECT COUNT(*)::int as count 
      FROM case_events 
      WHERE event_type = 'case_declined'
      ${hasDateFilter ? `AND occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'` : ""}
    ),
    total_assigned_count AS (
      SELECT COUNT(*)::int as count 
      FROM case_events 
      WHERE event_type = 'case_assigned'
      ${hasDateFilter ? `AND occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'` : ""}
    )
    SELECT 
      ROUND(AVG(EXTRACT(EPOCH FROM (acc.accepted_at - asg.assigned_at)) / 3600)::numeric, 1) as avg_acceptance_hours,
      (SELECT count FROM declined_count) as total_declined,
      (SELECT count FROM total_assigned_count) as total_assigned
    FROM assigned_events asg
    INNER JOIN accepted_events acc ON asg.case_id = acc.case_id AND acc.accepted_at >= asg.assigned_at
  `;
  const acceptanceRes = (await sql.query(acceptanceQuery, dateParams))[0] as any;

  // 3. Total sessions held
  const sessionsHeldRes = (await sql.query(`
    SELECT COUNT(*)::int as count FROM case_events
    WHERE event_type = 'session_held'
    ${hasDateFilter ? `AND occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'` : ""}
  `, dateParams))[0] as any;

  const totalCases = Number(totals?.total_cases) || 0;
  const totalClosed = Number(totals?.total_closed) || 0;
  const successfulClosures = Number(totals?.successful_closures) || 0;
  const overallSuccessRate = totalClosed > 0 ? Math.round((successfulClosures / totalClosed) * 100) : 0;
  const avgResolutionDays = Number(totals?.avg_resolution_days) || 0;
  const avgAcceptanceHours = Number(acceptanceRes?.avg_acceptance_hours) || 0;
  const totalAssigned = Number(acceptanceRes?.total_assigned) || 0;
  const totalDeclined = Number(acceptanceRes?.total_declined) || 0;
  const reassignmentRate = totalAssigned > 0 ? Math.round((totalDeclined / totalAssigned) * 100) : 0;
  const totalSessionsHeld = Number(sessionsHeldRes?.count) || 0;

  // 4. Per Therapist Performance
  const therapistPerfQuery = `
    SELECT 
      u.id as therapist_id,
      u.name as therapist_name,
      COALESCE(tp.specialization, 'General Therapy') as specialization,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'case_assigned' THEN ce.case_id END)::int as total_assigned,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'case_accepted' THEN ce.case_id END)::int as accepted_count,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'case_declined' THEN ce.case_id END)::int as declined_count,
      COUNT(CASE WHEN ce.event_type = 'session_held' THEN 1 END)::int as sessions_held,
      COUNT(CASE WHEN ce.event_type = 'case_closed' THEN 1 END)::int as cases_closed,
      COUNT(CASE WHEN ce.event_type = 'case_closed' AND ce.metadata->>'outcome' = 'successful' THEN 1 END)::int as successful_count,
      ROUND(AVG(
        CASE WHEN c.status = 'completed' AND c.closed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at)) / 86400
        END
      )::numeric, 1) as avg_resolution_days
    FROM users u
    LEFT JOIN therapist_profiles tp ON u.id = tp.user_id
    LEFT JOIN case_events ce ON u.id = ce.actor_id 
      ${hasDateFilter ? `AND ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata' AND ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'` : ""}
    LEFT JOIN cases c ON ce.case_id = c.id
    WHERE u.role = 'therapist'
    GROUP BY u.id, u.name, tp.specialization
    ORDER BY sessions_held DESC, cases_closed DESC, u.name ASC
  `;
  const therapistRows = (await sql.query(therapistPerfQuery, dateParams)) as any[];

  const therapistPerformance = therapistRows.map((r) => {
    const closed = Number(r.cases_closed) || 0;
    const succ = Number(r.successful_count) || 0;
    return {
      therapistId: r.therapist_id,
      therapistName: r.therapist_name,
      specialization: r.specialization,
      totalAssigned: Number(r.total_assigned) || 0,
      acceptedCount: Number(r.accepted_count) || 0,
      declinedCount: Number(r.declined_count) || 0,
      sessionsHeld: Number(r.sessions_held) || 0,
      casesClosed: closed,
      successfulCount: succ,
      successRate: closed > 0 ? Math.round((succ / closed) * 100) : 0,
      avgResolutionDays: Number(r.avg_resolution_days) || 0,
    };
  });

  // 5. Monthly Trends (last 6 months)
  const monthlyQuery = `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW() - INTERVAL '5 months'),
        date_trunc('month', NOW()),
        '1 month'::interval
      ) as m_date
    )
    SELECT 
      to_char(m.m_date, 'Mon YYYY') as month_label,
      COUNT(DISTINCT c.id)::int as cases_created,
      COUNT(DISTINCT CASE WHEN ce_close.event_type = 'case_closed' THEN ce_close.case_id END)::int as cases_closed,
      COUNT(DISTINCT CASE WHEN ce_close.event_type = 'case_closed' AND ce_close.metadata->>'outcome' = 'successful' THEN ce_close.case_id END)::int as successful_closed,
      COUNT(DISTINCT CASE WHEN ce_sess.event_type = 'session_held' THEN ce_sess.id END)::int as sessions_held
    FROM months m
    LEFT JOIN cases c ON date_trunc('month', c.created_at AT TIME ZONE 'Asia/Kolkata') = m.m_date
    LEFT JOIN case_events ce_close ON date_trunc('month', ce_close.occurred_at AT TIME ZONE 'Asia/Kolkata') = m.m_date AND ce_close.event_type = 'case_closed'
    LEFT JOIN case_events ce_sess ON date_trunc('month', ce_sess.occurred_at AT TIME ZONE 'Asia/Kolkata') = m.m_date AND ce_sess.event_type = 'session_held'
    GROUP BY m.m_date
    ORDER BY m.m_date ASC
  `;
  const monthlyRows = (await sql.query(monthlyQuery)) as any[];

  const monthlyTrends = monthlyRows.map((r) => {
    const closed = Number(r.cases_closed) || 0;
    const succ = Number(r.successful_closed) || 0;
    return {
      monthLabel: r.month_label,
      casesCreated: Number(r.cases_created) || 0,
      casesClosed: closed,
      successfulClosed: succ,
      sessionsHeld: Number(r.sessions_held) || 0,
      successRate: closed > 0 ? Math.round((succ / closed) * 100) : 0,
    };
  });

  // 6. Categories Breakdown
  const catQuery = `
    SELECT category, COUNT(*)::int as count 
    FROM cases
    ${dateWhereCases}
    GROUP BY category
    ORDER BY count DESC
  `;
  const catRows = (await sql.query(catQuery, dateParams)) as any[];
  const totalCat = catRows.reduce((acc, cur) => acc + Number(cur.count), 0);
  const categoryBreakdown = catRows.map((r) => ({
    category: r.category,
    count: Number(r.count),
    percentage: totalCat > 0 ? Math.round((Number(r.count) / totalCat) * 100) : 0,
  }));

  // 7. Priority Breakdown
  const prioQuery = `
    SELECT priority, COUNT(*)::int as count 
    FROM cases
    ${dateWhereCases}
    GROUP BY priority
    ORDER BY count DESC
  `;
  const prioRows = (await sql.query(prioQuery, dateParams)) as any[];
  const priorityBreakdown = prioRows.map((r) => ({
    priority: r.priority,
    count: Number(r.count),
  }));

  return {
    overallMetrics: {
      totalCases,
      totalClosed,
      successfulClosures,
      overallSuccessRate,
      avgResolutionDays,
      avgAcceptanceHours,
      reassignmentRate,
      totalSessionsHeld,
    },
    therapistPerformance,
    monthlyTrends,
    categoryBreakdown,
    priorityBreakdown,
  };
}

// -----------------------------------------------------------------------------
// 7. CHART VISUALIZATION QUERIES (Activity Heatmap, Funnel, Trends, Workload)
// -----------------------------------------------------------------------------

export interface ActivityHeatmapDay {
  date: string;
  displayDate: string;
  count: number;
}

export async function getActivityHeatmapData(
  endDateStr?: string
): Promise<ActivityHeatmapDay[]> {
  const sql = getSql();
  const targetEnd = endDateStr || "NOW()";

  // Generate 84 days (12 weeks) ending on targetEnd
  const query = `
    WITH date_series AS (
      SELECT generate_series(
        (($1::date) - INTERVAL '83 days'),
        ($1::date),
        '1 day'::interval
      )::date as day_date
    ),
    event_counts AS (
      SELECT 
        (occurred_at AT TIME ZONE 'Asia/Kolkata')::date as event_date,
        COUNT(*)::int as count
      FROM case_events
      WHERE occurred_at >= (($1::date) - INTERVAL '83 days')::timestamp AT TIME ZONE 'Asia/Kolkata'
        AND occurred_at < (($1::date) + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
      GROUP BY (occurred_at AT TIME ZONE 'Asia/Kolkata')::date
    )
    SELECT 
      to_char(ds.day_date, 'YYYY-MM-DD') as date_str,
      to_char(ds.day_date, 'DD Mon YYYY') as display_date,
      COALESCE(ec.count, 0)::int as count
    FROM date_series ds
    LEFT JOIN event_counts ec ON ds.day_date = ec.event_date
    ORDER BY ds.day_date ASC
  `;

  // Determine end date parameter
  const endDate = endDateStr || new Date().toISOString().slice(0, 10);
  const rows = (await sql.query(query, [endDate])) as any[];

  return rows.map((r) => ({
    date: r.date_str,
    displayDate: r.display_date,
    count: Number(r.count) || 0,
  }));
}

export interface FunnelStageData {
  name: string;
  count: number;
}

export async function getPipelineFunnelData(
  filter: DateFilterRange
): Promise<FunnelStageData[]> {
  const sql = getSql();

  // Count cases in each stage as of or within the date filter
  const query = `
    SELECT 
      COUNT(CASE WHEN status = 'new' THEN 1 END)::int as new_count,
      COUNT(CASE WHEN status = 'assigned' THEN 1 END)::int as assigned_count,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END)::int as accepted_count,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_count
    FROM cases
    WHERE created_at < (($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
  `;

  const rows = (await sql.query(query, [filter.endDate])) as any[];
  const r = rows[0] || {};

  return [
    { name: "New", count: Number(r.new_count) || 0 },
    { name: "Assigned", count: Number(r.assigned_count) || 0 },
    { name: "Accepted", count: Number(r.accepted_count) || 0 },
    { name: "In Progress", count: Number(r.in_progress_count) || 0 },
    { name: "Completed", count: Number(r.completed_count) || 0 },
  ];
}

export interface DailyTrendItem {
  date: string;
  current: number;
  previous: number;
  completed: number;
}

export async function getDailyTrendData(
  filter: DateFilterRange
): Promise<DailyTrendItem[]> {
  const sql = getSql();

  // Return 14 days of trends ending on filter.endDate
  const query = `
    WITH days AS (
      SELECT generate_series(
        (($1::date) - INTERVAL '13 days'),
        ($1::date),
        '1 day'::interval
      )::date as d
    )
    SELECT 
      to_char(days.d, 'DD Mon') as date_label,
      COUNT(DISTINCT c_curr.id)::int as created_curr,
      COUNT(DISTINCT c_prev.id)::int as created_prev,
      COUNT(DISTINCT CASE WHEN ce_done.event_type = 'case_closed' THEN ce_done.case_id END)::int as completed_curr
    FROM days
    LEFT JOIN cases c_curr ON (c_curr.created_at AT TIME ZONE 'Asia/Kolkata')::date = days.d
    LEFT JOIN cases c_prev ON (c_prev.created_at AT TIME ZONE 'Asia/Kolkata')::date = (days.d - INTERVAL '14 days')::date
    LEFT JOIN case_events ce_done ON (ce_done.occurred_at AT TIME ZONE 'Asia/Kolkata')::date = days.d AND ce_done.event_type = 'case_closed'
    GROUP BY days.d
    ORDER BY days.d ASC
  `;

  const rows = (await sql.query(query, [filter.endDate])) as any[];

  return rows.map((r) => ({
    date: r.date_label,
    current: Number(r.created_curr) || 0,
    previous: Number(r.created_prev) || 0,
    completed: Number(r.completed_curr) || 0,
  }));
}

export interface TherapistCapacityItem {
  id: string;
  name: string;
  specialization: string;
  openCases: number;
  maxCapacity: number;
  sessionsHeld: number;
  successRate: number;
}

export async function getTherapistCapacityList(): Promise<TherapistCapacityItem[]> {
  const sql = getSql();

  const query = `
    SELECT 
      u.id,
      u.name,
      COALESCE(tp.specialization, 'General Therapy') as specialization,
      COUNT(DISTINCT CASE WHEN c.status IN ('assigned', 'accepted', 'in_progress') THEN c.id END)::int as open_cases,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'session_held' THEN ce.id END)::int as sessions_held,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'case_closed' AND ce.metadata->>'outcome' = 'successful' THEN ce.case_id END)::int as successful_cases,
      COUNT(DISTINCT CASE WHEN ce.event_type = 'case_closed' THEN ce.case_id END)::int as total_closed
    FROM users u
    LEFT JOIN therapist_profiles tp ON u.id = tp.user_id
    LEFT JOIN cases c ON c.current_therapist_id = u.id
    LEFT JOIN case_events ce ON ce.actor_id = u.id
    WHERE u.role = 'therapist'
    GROUP BY u.id, u.name, tp.specialization
    ORDER BY open_cases DESC, sessions_held DESC
  `;

  const rows = (await sql.query(query)) as any[];

  return rows.map((r) => {
    const closed = Number(r.total_closed) || 0;
    const succ = Number(r.successful_cases) || 0;
    return {
      id: r.id,
      name: r.name,
      specialization: r.specialization,
      openCases: Number(r.open_cases) || 0,
      maxCapacity: 15,
      sessionsHeld: Number(r.sessions_held) || 0,
      successRate: closed > 0 ? Math.round((succ / closed) * 100) : 85,
    };
  });
}

export interface AdminProductivityItem {
  id: string;
  name: string;
  casesCreated: number;
  casesAssigned: number;
  totalActions: number;
}

export async function getAdminProductivityList(
  filter: DateFilterRange
): Promise<AdminProductivityItem[]> {
  const sql = getSql();

  const query = `
    SELECT 
      u.id,
      u.name,
      COUNT(CASE WHEN ce.event_type = 'case_created' THEN 1 END)::int as cases_created,
      COUNT(CASE WHEN ce.event_type = 'case_assigned' THEN 1 END)::int as cases_assigned,
      COUNT(ce.id)::int as total_actions
    FROM users u
    LEFT JOIN case_events ce ON u.id = ce.actor_id
      AND ce.occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
      AND ce.occurred_at < (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
    WHERE u.role = 'admin'
    GROUP BY u.id, u.name
    ORDER BY total_actions DESC, cases_assigned DESC
  `;

  const rows = (await sql.query(query, [filter.startDate, filter.endDate])) as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    casesCreated: Number(r.cases_created) || 0,
    casesAssigned: Number(r.cases_assigned) || 0,
    totalActions: Number(r.total_actions) || 0,
  }));
}

export interface NeedsAttentionCase {
  id: string;
  caseNumber: string;
  clientName: string;
  category: string;
  priority: string;
  status: string;
  reason: string;
  createdAt: Date;
}

export async function getNeedsAttentionCases(): Promise<NeedsAttentionCase[]> {
  const sql = getSql();

  const query = `
    SELECT 
      c.id,
      c.case_number,
      cl.full_name as client_name,
      c.category,
      c.priority,
      c.status,
      c.created_at,
      CASE 
        WHEN c.priority = 'urgent' AND c.status = 'new' THEN 'Urgent intake awaiting assignment'
        WHEN c.status = 'new' AND c.created_at < NOW() - INTERVAL '3 days' THEN 'Unassigned intake > 3 days'
        WHEN EXISTS (SELECT 1 FROM case_events ce WHERE ce.case_id = c.id AND ce.event_type = 'case_declined') THEN 'Declined by therapist'
        ELSE 'Review required'
      END as attention_reason
    FROM cases c
    INNER JOIN clients cl ON c.client_id = cl.id
    WHERE (c.status = 'new' AND (c.priority = 'urgent' OR c.created_at < NOW() - INTERVAL '3 days'))
       OR EXISTS (SELECT 1 FROM case_events ce WHERE ce.case_id = c.id AND ce.event_type = 'case_declined' AND c.status != 'completed')
    ORDER BY (c.priority = 'urgent') DESC, c.created_at ASC
    LIMIT 20
  `;

  const rows = (await sql.query(query)) as any[];

  return rows.map((r) => ({
    id: r.id,
    caseNumber: r.case_number,
    clientName: r.client_name,
    category: r.category,
    priority: r.priority,
    status: r.status,
    reason: r.attention_reason,
    createdAt: new Date(r.created_at),
  }));
}

export interface PriorityStatusMatrixItem {
  priority: string;
  new: number;
  in_progress: number;
  on_hold: number;
  completed: number;
}

export async function getPriorityStatusMatrix(): Promise<PriorityStatusMatrixItem[]> {
  const sql = getSql();

  const query = `
    SELECT 
      priority,
      COUNT(CASE WHEN status = 'new' THEN 1 END)::int as new_count,
      COUNT(CASE WHEN status IN ('assigned', 'accepted', 'in_progress') THEN 1 END)::int as in_progress_count,
      COUNT(CASE WHEN status = 'on_hold' THEN 1 END)::int as on_hold_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_count
    FROM cases
    GROUP BY priority
    ORDER BY 
      CASE priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
      END
  `;

  const rows = (await sql.query(query)) as any[];

  return rows.map((r) => ({
    priority: r.priority.toUpperCase(),
    new: Number(r.new_count) || 0,
    in_progress: Number(r.in_progress_count) || 0,
    on_hold: Number(r.on_hold_count) || 0,
    completed: Number(r.completed_count) || 0,
  }));
}

