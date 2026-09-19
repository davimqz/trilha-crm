CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_events_type_check" CHECK ("lead_events"."type" in ('created', 'status_changed', 'converted', 'conversion_reverted', 'client_reactivated', 'archived', 'unarchived', 'owner_changed', 'contact_updated', 'associative_status_changed'))
);
--> statement-breakpoint
CREATE TABLE "client_service_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"description" jsonb,
	"responsible_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_service_records_type_check" CHECK ("client_service_records"."type" in ('meeting', 'call', 'whatsapp', 'email', 'in_person'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"associative_status" text DEFAULT 'adimplente' NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_lead_id_unique" UNIQUE("lead_id"),
	CONSTRAINT "clients_associative_status_check" CHECK ("clients"."associative_status" in ('adimplente', 'inadimplente'))
);
--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD CONSTRAINT "client_service_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD CONSTRAINT "client_service_records_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_records" ADD CONSTRAINT "client_service_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_events_lead_id_idx" ON "lead_events" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "client_service_records_client_idx" ON "client_service_records" USING btree ("client_id","occurred_at");--> statement-breakpoint
CREATE INDEX "clients_archived_status_idx" ON "clients" USING btree ("archived_at","associative_status");--> statement-breakpoint
-- Backfill (ADR-008): leads existentes ganham o evento de criação com a data original.
-- O status inicial não era registrado antes, por isso fica nulo ("Virou lead").
INSERT INTO "lead_events" ("lead_id", "type", "to_value", "actor_id", "created_at")
SELECT "id", 'created', NULL, "created_by", "created_at" FROM "leads";--> statement-breakpoint
-- Leads já convertidos viram clientes (Adimplente), com a conversão datada na última atualização do lead
INSERT INTO "clients" ("lead_id", "associative_status", "converted_at", "updated_by", "created_at", "updated_at")
SELECT "id", 'adimplente', "updated_at", "updated_by", "updated_at", "updated_at" FROM "leads" WHERE "status" = 'converted';--> statement-breakpoint
INSERT INTO "lead_events" ("lead_id", "type", "actor_id", "created_at")
SELECT "id", 'converted', "updated_by", "updated_at" FROM "leads" WHERE "status" = 'converted';
