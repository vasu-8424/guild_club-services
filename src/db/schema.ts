import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigserial,
  jsonb,
  timestamp,
  date,
  pgEnum,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// ENUMS
// -----------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "therapist",
]);

export const casePriorityEnum = pgEnum("case_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const caseStatusEnum = pgEnum("case_status", [
  "new",
  "assigned",
  "accepted",
  "in_progress",
  "on_hold",
  "completed",
]);

export const caseOutcomeEnum = pgEnum("case_outcome", [
  "successful",
  "unsuccessful",
  "referred",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "held",
  "missed",
  "cancelled",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "pending",
  "sent",
  "failed",
]);

// -----------------------------------------------------------------------------
// 1. USERS
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    sessionVersion: integer("session_version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_active_unique_idx")
      .on(table.email)
      .where(sql`"deleted_at" IS NULL`),
  ]
);

// -----------------------------------------------------------------------------
// 2. THERAPIST PROFILES
// -----------------------------------------------------------------------------

export const therapistProfiles = pgTable("therapist_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  specialization: text("specialization").notNull(),
  experienceYears: integer("experience_years").default(0).notNull(),
  maxOpenCases: integer("max_open_cases").default(10).notNull(),
});

// -----------------------------------------------------------------------------
// 3. CLIENTS
// -----------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// 4. CASES
// -----------------------------------------------------------------------------

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseNumber: text("case_number").notNull().unique(), // Format: GCS-YYYY-0001
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  category: text("category").notNull(),
  priority: casePriorityEnum("priority").notNull(),
  description: text("description").notNull(),
  status: caseStatusEnum("status").default("new").notNull(),
  outcome: caseOutcomeEnum("outcome"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  currentTherapistId: uuid("current_therapist_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
});

// -----------------------------------------------------------------------------
// 5. SESSIONS
// -----------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  therapistId: uuid("therapist_id")
    .notNull()
    .references(() => users.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }).notNull(),
  status: sessionStatusEnum("status").default("scheduled").notNull(),
  notes: text("notes"),
  inTimeAt: timestamp("in_time_at", { withTimezone: true, mode: "date" }),
  inTimePhotoKey: text("in_time_photo_key"),
  outTimeAt: timestamp("out_time_at", { withTimezone: true, mode: "date" }),
  outTimePhotoKey: text("out_time_photo_key"),
  workDone: text("work_done"),
  patientSignatureKey: text("patient_signature_key"),
  photoConsent: boolean("photo_consent").default(true),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

// -----------------------------------------------------------------------------
// 6. THERAPIST ROOM ASSIGNMENTS
// -----------------------------------------------------------------------------

export const therapistRoomAssignments = pgTable(
  "therapist_room_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedDate: date("assigned_date").notNull(),
    roomNo: text("room_no").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("therapist_room_date_unique_idx").on(
      table.therapistId,
      table.assignedDate
    ),
  ]
);

// -----------------------------------------------------------------------------
// 6. CASE NOTES
// -----------------------------------------------------------------------------

export const caseNotes = pgTable("case_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// 7. CASE EVENTS
// -----------------------------------------------------------------------------

export const caseEvents = pgTable(
  "case_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventType: text("event_type").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    actorRole: text("actor_role").notNull(),
    caseId: uuid("case_id").references(() => cases.id),
    targetUserId: uuid("target_user_id").references(() => users.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("case_events_occurred_at_idx").on(table.occurredAt),
    index("case_events_actor_occurred_idx").on(table.actorId, table.occurredAt),
    index("case_events_case_occurred_idx").on(table.caseId, table.occurredAt),
    index("case_events_event_type_occurred_idx").on(table.eventType, table.occurredAt),
    index("case_events_to_status_occurred_idx").on(table.toStatus, table.occurredAt),
  ]
);

// -----------------------------------------------------------------------------
// 8. EMAIL QUEUE
// -----------------------------------------------------------------------------

export const emailQueue = pgTable("email_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  template: text("template").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: emailStatusEnum("status").default("pending").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// RELATIONS
// -----------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  therapistProfile: one(therapistProfiles, {
    fields: [users.id],
    references: [therapistProfiles.userId],
  }),
  createdUsers: many(users, { relationName: "created_by_user" }),
  creator: one(users, {
    fields: [users.createdBy],
    references: [users.id],
    relationName: "created_by_user",
  }),
  createdCases: many(cases, { relationName: "case_creator" }),
  assignedCases: many(cases, { relationName: "case_therapist" }),
  sessions: many(sessions),
  caseNotes: many(caseNotes),
  events: many(caseEvents),
  roomAssignments: many(therapistRoomAssignments, {
    relationName: "room_assigned_therapist",
  }),
  createdRoomAssignments: many(therapistRoomAssignments, {
    relationName: "room_assigned_creator",
  }),
}));

export const therapistRoomAssignmentsRelations = relations(
  therapistRoomAssignments,
  ({ one }) => ({
    therapist: one(users, {
      fields: [therapistRoomAssignments.therapistId],
      references: [users.id],
      relationName: "room_assigned_therapist",
    }),
    creator: one(users, {
      fields: [therapistRoomAssignments.createdBy],
      references: [users.id],
      relationName: "room_assigned_creator",
    }),
  })
);

export const therapistProfilesRelations = relations(
  therapistProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [therapistProfiles.userId],
      references: [users.id],
    }),
  })
);

export const clientsRelations = relations(clients, ({ many }) => ({
  cases: many(cases),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  client: one(clients, {
    fields: [cases.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [cases.createdBy],
    references: [users.id],
    relationName: "case_creator",
  }),
  currentTherapist: one(users, {
    fields: [cases.currentTherapistId],
    references: [users.id],
    relationName: "case_therapist",
  }),
  sessions: many(sessions),
  notes: many(caseNotes),
  events: many(caseEvents),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  case: one(cases, {
    fields: [sessions.caseId],
    references: [cases.id],
  }),
  therapist: one(users, {
    fields: [sessions.therapistId],
    references: [users.id],
  }),
}));

export const caseNotesRelations = relations(caseNotes, ({ one }) => ({
  case: one(cases, {
    fields: [caseNotes.caseId],
    references: [cases.id],
  }),
  author: one(users, {
    fields: [caseNotes.authorId],
    references: [users.id],
  }),
}));

export const caseEventsRelations = relations(caseEvents, ({ one }) => ({
  actor: one(users, {
    fields: [caseEvents.actorId],
    references: [users.id],
  }),
  case: one(cases, {
    fields: [caseEvents.caseId],
    references: [cases.id],
  }),
  targetUser: one(users, {
    fields: [caseEvents.targetUserId],
    references: [users.id],
  }),
}));

// -----------------------------------------------------------------------------
// TYPE EXPORTS
// -----------------------------------------------------------------------------

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type CasePriority = (typeof casePriorityEnum.enumValues)[number];
export type CaseStatus = (typeof caseStatusEnum.enumValues)[number];
export type CaseOutcome = (typeof caseOutcomeEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type TherapistProfile = typeof therapistProfiles.$inferSelect;
export type NewTherapistProfile = typeof therapistProfiles.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type CaseNote = typeof caseNotes.$inferSelect;
export type NewCaseNote = typeof caseNotes.$inferInsert;

export type CaseEvent = typeof caseEvents.$inferSelect;
export type NewCaseEvent = typeof caseEvents.$inferInsert;

export type TherapistRoomAssignment = typeof therapistRoomAssignments.$inferSelect;
export type NewTherapistRoomAssignment = typeof therapistRoomAssignments.$inferInsert;

export type EmailQueueItem = typeof emailQueue.$inferSelect;
export type NewEmailQueueItem = typeof emailQueue.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
