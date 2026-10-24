CREATE TABLE "therapist_room_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" uuid NOT NULL,
	"assigned_date" date NOT NULL,
	"room_no" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "in_time_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "in_time_photo_key" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "out_time_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "out_time_photo_key" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "work_done" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "patient_signature_key" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "photo_consent" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapist_room_assignments" ADD CONSTRAINT "therapist_room_assignments_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist_room_assignments" ADD CONSTRAINT "therapist_room_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "therapist_room_date_unique_idx" ON "therapist_room_assignments" USING btree ("therapist_id","assigned_date");