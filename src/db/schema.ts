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
  "active",
]);

export const caseOutcomeEnum = pgEnum("case_outcome", [
  "successful",
  "unsuccessful",
  "referred",
  "improved",
  "partially_improved",
  "no_change",
]);

export const serviceTypeEnum = pgEnum("service_type", [
  "physiotherapy",
  "swallow_therapy",
  "vitalstim_therapy",
]);

export const loginLocationStatusEnum = pgEnum("login_location_status", [
  "captured",
  "denied",
  "unavailable",
]);

export const photoKindEnum = pgEnum("photo_kind", ["joining", "present"]);

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
  "deferred",
  "delivered",
  "bounced",
  "complained",
]);

export const reportTypeEnum = pgEnum("report_type", [
  "update",
  "final",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "submitted",
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
    emailUndeliverable: boolean("email_undeliverable").default(false).notNull(),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    sessionVersion: integer("session_version").default(1).notNull(),
    temporaryPasswordPrompt: boolean("temporary_password_prompt").default(false).notNull(),
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
// 3.5. BRANCHES
// -----------------------------------------------------------------------------

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// 3.6. ROOMS
// -----------------------------------------------------------------------------

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomNo: text("room_no").notNull(),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branches.id),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("rooms_branch_room_no_unique_idx").on(
      table.branchId,
      sql`lower(trim("room_no"))`
    ),
  ]
);

// -----------------------------------------------------------------------------
// 4. CASES
// -----------------------------------------------------------------------------

export const cases = pgTable(
  "cases",
  {
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
    patientId: text("patient_id").unique(), // Format: GCP-0001
    service: text("service"), // 'physiotherapy' | 'swallow_therapy' | 'vitalstim_therapy'
    problem: text("problem"),
    presentCondition: text("present_condition"),
    presentConditionAtClose: text("present_condition_at_close"),
    closingNotes: text("closing_notes"),
    startDate: date("start_date"),
    roomNo: text("room_no"),
    roomId: uuid("room_id").references((): AnyPgColumn => rooms.id),
    branchId: uuid("branch_id").references((): AnyPgColumn => branches.id),
    sex: text("sex"), // 'male' | 'female' | 'other'
    consentObtained: boolean("consent_obtained").default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("one_open_case_per_room")
      .on(table.roomId)
      .where(sql`"status" <> 'completed' AND "room_id" IS NOT NULL`),
  ]
);

// -----------------------------------------------------------------------------
// 4.5. CASE PHOTOS
// -----------------------------------------------------------------------------

export const casePhotos = pgTable(
  "case_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: photoKindEnum("kind").notNull(), // 'joining' | 'present'
    fileKey: text("file_key").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("case_photos_case_id_idx").on(table.caseId),
    index("case_photos_kind_idx").on(table.kind),
  ]
);

// -----------------------------------------------------------------------------
// 4.6. LOGIN RECORDS
// -----------------------------------------------------------------------------

export const loginRecords = pgTable(
  "login_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    loggedInAt: timestamp("logged_in_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    latitude: text("latitude"),
    longitude: text("longitude"),
    accuracyMeters: integer("accuracy_meters"),
    locationStatus: loginLocationStatusEnum("location_status")
      .default("unavailable")
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    loggedOutAt: timestamp("logged_out_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("login_records_user_id_idx").on(table.userId),
    index("login_records_logged_in_at_idx").on(table.loggedInAt),
  ]
);

// -----------------------------------------------------------------------------
// 5. SESSIONS
// -----------------------------------------------------------------------------

export const sessions = pgTable(
  "sessions",
  {
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
    sessionDate: date("session_date"),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }),
    photoKey: text("photo_key"),
    inTimeAt: timestamp("in_time_at", { withTimezone: true, mode: "date" }),
    inTimePhotoKey: text("in_time_photo_key"),
    outTimeAt: timestamp("out_time_at", { withTimezone: true, mode: "date" }),
    outTimePhotoKey: text("out_time_photo_key"),
    workDone: text("work_done"),
    patientSignatureKey: text("patient_signature_key"),
    photoConsent: boolean("photo_consent").default(true),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("sessions_case_date_unique_idx")
      .on(table.caseId, table.sessionDate)
      .where(sql`"session_date" IS NOT NULL`),
  ]
);

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
  providerMessageId: text("provider_message_id"),
  priority: integer("priority").default(5).notNull(),
  deferredUntil: timestamp("deferred_until", { withTimezone: true, mode: "date" }),
  emailUndeliverable: boolean("email_undeliverable").default(false).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// Alias for delivery rows
export const notificationDeliveries = emailQueue;

// -----------------------------------------------------------------------------
// 9. IN-APP NOTIFICATIONS
// -----------------------------------------------------------------------------

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // admin_account_created | account_created | case_closed | session_completed_group | ...
    title: text("title").notNull(),
    body: text("body").notNull(),
    priority: text("priority").default("normal").notNull(), // low | normal | high | urgent
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    caseId: uuid("case_id").references((): AnyPgColumn => cases.id, { onDelete: "set null" }),
    groupedCount: integer("grouped_count").default(1).notNull(),
    lastGroupedAt: timestamp("last_grouped_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    data: jsonb("data").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("in_app_notifications_user_read_idx").on(table.userId, table.isRead),
    index("in_app_notifications_created_idx").on(table.createdAt),
    index("in_app_notifications_user_type_idx").on(table.userId, table.type),
  ]
);

// -----------------------------------------------------------------------------
// 9.5. ADMIN NOTES
// -----------------------------------------------------------------------------

export const adminNotes = pgTable(
  "admin_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references((): AnyPgColumn => users.id),
    toUserId: uuid("to_user_id")
      .notNull()
      .references((): AnyPgColumn => users.id),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("admin_notes_to_user_id_idx").on(table.toUserId),
    index("admin_notes_created_at_idx").on(table.createdAt),
    index("admin_notes_from_user_id_idx").on(table.fromUserId),
  ]
);

// -----------------------------------------------------------------------------
// 10. PROGRESS REPORTS & VERSIONS
// -----------------------------------------------------------------------------

export const progressReports = pgTable(
  "progress_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references((): AnyPgColumn => cases.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references((): AnyPgColumn => users.id),
    reportType: reportTypeEnum("report_type").notNull(),
    status: reportStatusEnum("status").default("draft").notNull(),
    reportDate: date("report_date").notNull(),
    currentCondition: text("current_condition").notNull(),
    progressText: text("progress_text").notNull(),
    treatmentPlan: text("treatment_plan"),
    remarks: text("remarks"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("progress_reports_case_id_idx").on(table.caseId),
    index("progress_reports_author_id_idx").on(table.authorId),
    index("progress_reports_created_at_idx").on(table.createdAt),
    uniqueIndex("progress_reports_case_unique_final_idx")
      .on(table.caseId)
      .where(sql`"report_type" = 'final'`),
  ]
);

export const progressReportVersions = pgTable(
  "progress_report_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references((): AnyPgColumn => progressReports.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    snapshot: jsonb("snapshot")
      .$type<{
        currentCondition: string;
        progressText: string;
        treatmentPlan?: string | null;
        remarks?: string | null;
      }>()
      .notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    editorId: uuid("editor_id")
      .notNull()
      .references((): AnyPgColumn => users.id),
  },
  (table) => [
    index("progress_report_versions_report_id_idx").on(table.reportId),
    uniqueIndex("progress_report_versions_report_version_idx").on(
      table.reportId,
      table.versionNo
    ),
  ]
);

// Alias
export const notifications = inAppNotifications;

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
  progressReports: many(progressReports),
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
  branch: one(branches, {
    fields: [cases.branchId],
    references: [branches.id],
  }),
  room: one(rooms, {
    fields: [cases.roomId],
    references: [rooms.id],
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
  photos: many(casePhotos),
  progressReports: many(progressReports),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  branch: one(branches, {
    fields: [rooms.branchId],
    references: [branches.id],
  }),
  creator: one(users, {
    fields: [rooms.createdBy],
    references: [users.id],
  }),
  cases: many(cases),
}));

export const adminNotesRelations = relations(adminNotes, ({ one }) => ({
  fromUser: one(users, {
    fields: [adminNotes.fromUserId],
    references: [users.id],
    relationName: "admin_notes_sent",
  }),
  toUser: one(users, {
    fields: [adminNotes.toUserId],
    references: [users.id],
    relationName: "admin_notes_received",
  }),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  cases: many(cases),
  rooms: many(rooms),
}));

export const casePhotosRelations = relations(casePhotos, ({ one }) => ({
  case: one(cases, {
    fields: [casePhotos.caseId],
    references: [cases.id],
  }),
  uploader: one(users, {
    fields: [casePhotos.uploadedBy],
    references: [users.id],
  }),
}));

export const loginRecordsRelations = relations(loginRecords, ({ one }) => ({
  user: one(users, {
    fields: [loginRecords.userId],
    references: [users.id],
  }),
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

export const inAppNotificationsRelations = relations(
  inAppNotifications,
  ({ one }) => ({
    user: one(users, {
      fields: [inAppNotifications.userId],
      references: [users.id],
    }),
    case: one(cases, {
      fields: [inAppNotifications.caseId],
      references: [cases.id],
    }),
  })
);

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type NewInAppNotification = typeof inAppNotifications.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type ServiceType = (typeof serviceTypeEnum.enumValues)[number];
export type LoginLocationStatus = (typeof loginLocationStatusEnum.enumValues)[number];
export type PhotoKind = (typeof photoKindEnum.enumValues)[number];

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

export type CasePhoto = typeof casePhotos.$inferSelect;
export type NewCasePhoto = typeof casePhotos.$inferInsert;

export type LoginRecord = typeof loginRecords.$inferSelect;
export type NewLoginRecord = typeof loginRecords.$inferInsert;

export const progressReportsRelations = relations(
  progressReports,
  ({ one, many }) => ({
    case: one(cases, {
      fields: [progressReports.caseId],
      references: [cases.id],
    }),
    author: one(users, {
      fields: [progressReports.authorId],
      references: [users.id],
    }),
    versions: many(progressReportVersions),
  })
);

export const progressReportVersionsRelations = relations(
  progressReportVersions,
  ({ one }) => ({
    report: one(progressReports, {
      fields: [progressReportVersions.reportId],
      references: [progressReports.id],
    }),
    editor: one(users, {
      fields: [progressReportVersions.editorId],
      references: [users.id],
    }),
  })
);

export type ReportType = (typeof reportTypeEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type ProgressReport = typeof progressReports.$inferSelect;
export type NewProgressReport = typeof progressReports.$inferInsert;
export type ProgressReportVersion = typeof progressReportVersions.$inferSelect;
export type NewProgressReportVersion = typeof progressReportVersions.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type AdminNote = typeof adminNotes.$inferSelect;
export type NewAdminNote = typeof adminNotes.$inferInsert;


