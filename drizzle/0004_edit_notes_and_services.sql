ALTER TABLE "lead_events" DROP CONSTRAINT "lead_events_type_check";--> statement-breakpoint
ALTER TABLE "lead_notes" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD CONSTRAINT "client_service_records_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_type_check" CHECK ("lead_events"."type" in ('created', 'status_changed', 'converted', 'conversion_reverted', 'client_reactivated', 'archived', 'unarchived', 'owner_changed', 'contact_updated', 'associative_status_changed', 'note_edited', 'note_deleted', 'service_record_edited', 'service_record_deleted'));