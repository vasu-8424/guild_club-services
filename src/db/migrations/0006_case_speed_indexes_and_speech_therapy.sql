-- Migration 0006: Fast case open indexes and speech_therapy enum value

-- 1. Enum value for Speech Therapy
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'speech_therapy';

-- 2. Composite and missing indexes for fast case lookups
CREATE INDEX IF NOT EXISTS cases_therapist_status_idx ON cases(current_therapist_id, status);
CREATE INDEX IF NOT EXISTS sessions_case_date_idx ON sessions(case_id, session_date);
CREATE INDEX IF NOT EXISTS case_photos_case_kind_idx ON case_photos(case_id, kind);
CREATE INDEX IF NOT EXISTS progress_reports_case_id_idx ON progress_reports(case_id);
CREATE INDEX IF NOT EXISTS case_notes_case_id_idx ON case_notes(case_id);

