-- Custom migration for Prompt 34: Session Reason Threads & Session Photos

-- 1. Photo kind enum: add 'session'
ALTER TYPE "photo_kind" ADD VALUE IF NOT EXISTS 'session';

-- 2. New enums for reason threads & messages
DO $$ BEGIN
  CREATE TYPE "session_reason_thread_status" AS ENUM ('open', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "session_reason_author_role" AS ENUM ('therapist', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. session_reason_threads
CREATE TABLE IF NOT EXISTS "session_reason_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE cascade,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE cascade,
  "therapist_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "admin_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "thread_date" date NOT NULL,
  "status" "session_reason_thread_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_reason_threads_case_date_unique_idx" ON "session_reason_threads" ("case_id", "thread_date");
CREATE INDEX IF NOT EXISTS "session_reason_threads_branch_date_idx" ON "session_reason_threads" ("branch_id", "thread_date");
CREATE INDEX IF NOT EXISTS "session_reason_threads_therapist_idx" ON "session_reason_threads" ("therapist_id");
CREATE INDEX IF NOT EXISTS "session_reason_threads_case_idx" ON "session_reason_threads" ("case_id");
CREATE INDEX IF NOT EXISTS "session_reason_threads_status_idx" ON "session_reason_threads" ("status");

-- 4. session_reason_messages
CREATE TABLE IF NOT EXISTS "session_reason_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "session_reason_threads"("id") ON DELETE cascade,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE cascade,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "author_role" "session_reason_author_role" NOT NULL,
  "body" text NOT NULL,
  "original_body" text,
  "is_edited" boolean DEFAULT false NOT NULL,
  "edited_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_by_recipient_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "session_reason_messages_thread_created_idx" ON "session_reason_messages" ("thread_id", "created_at");
CREATE INDEX IF NOT EXISTS "session_reason_messages_branch_idx" ON "session_reason_messages" ("branch_id");
CREATE INDEX IF NOT EXISTS "session_reason_messages_author_idx" ON "session_reason_messages" ("author_id");

-- 5. case_photos columns & index
ALTER TABLE "case_photos" ADD COLUMN IF NOT EXISTS "session_id" uuid REFERENCES "sessions"("id") ON DELETE cascade;
ALTER TABLE "case_photos" ADD COLUMN IF NOT EXISTS "consent_obtained" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "case_photos_session_id_idx" ON "case_photos" ("session_id");

-- 6. Branch consistency triggers
CREATE OR REPLACE FUNCTION check_session_reason_thread_branch()
RETURNS TRIGGER AS $$
DECLARE
  v_case_branch uuid;
BEGIN
  SELECT branch_id INTO v_case_branch FROM cases WHERE id = NEW.case_id;
  IF v_case_branch IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'branch_id % does not match case branch_id %', NEW.branch_id, v_case_branch;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_session_reason_thread_branch ON session_reason_threads;
CREATE TRIGGER trg_check_session_reason_thread_branch
BEFORE INSERT OR UPDATE ON session_reason_threads
FOR EACH ROW EXECUTE FUNCTION check_session_reason_thread_branch();

CREATE OR REPLACE FUNCTION check_session_reason_message_branch()
RETURNS TRIGGER AS $$
DECLARE
  v_thread_branch uuid;
BEGIN
  SELECT branch_id INTO v_thread_branch FROM session_reason_threads WHERE id = NEW.thread_id;
  IF v_thread_branch IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'branch_id % does not match thread branch_id %', NEW.branch_id, v_thread_branch;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_session_reason_message_branch ON session_reason_messages;
CREATE TRIGGER trg_check_session_reason_message_branch
BEFORE INSERT OR UPDATE ON session_reason_messages
FOR EACH ROW EXECUTE FUNCTION check_session_reason_message_branch();

