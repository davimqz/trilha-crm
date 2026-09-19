import { sql } from "drizzle-orm";
import { check, customType, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Imports relativos: o drizzle-kit não resolve o alias "@/"
import { users } from "../../core/auth/schema";

import { LEAD_EVENT_TYPES, LEAD_STATUSES } from "./constants";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// LEAD_STATUSES é constante do código (nunca entrada do usuário), por isso sql.raw é seguro
const statusList = sql.raw(LEAD_STATUSES.map((status) => `'${status}'`).join(", "));

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    // Só dígitos: DDD + número
    phone: text("phone").notNull(),
    status: text("status").notNull().default("prospect"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("leads_status_check", sql`${table.status} in (${statusList})`),
    index("leads_status_idx").on(table.status),
    index("leads_owner_id_idx").on(table.ownerId),
    index("leads_archived_at_idx").on(table.archivedAt),
  ],
);

export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    // JSON do ProseMirror validado por schema estrito (ADR-007)
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_notes_lead_id_idx").on(table.leadId, table.createdAt)],
);

export const leadAttachments = pgTable(
  "lead_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    // Tipo detectado pelo conteúdo (ex.: "pdf"); o mimeType é derivado dele, nunca do cliente
    kind: text("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_attachments_lead_id_idx").on(table.leadId)],
);

// Conteúdo separado dos metadados: listagens nunca carregam os bytes (ADR-006)
export const leadAttachmentContents = pgTable("lead_attachment_contents", {
  attachmentId: uuid("attachment_id")
    .primaryKey()
    .references(() => leadAttachments.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
});

const eventTypeList = sql.raw(LEAD_EVENT_TYPES.map((type) => `'${type}'`).join(", "));

// Linha do tempo (ADR-008): gravado na mesma transação de cada ação sobre o lead/cliente
export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // Valores em texto no momento do evento (status, nomes): o histórico não muda se o usuário for renomeado
    fromValue: text("from_value"),
    toValue: text("to_value"),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("lead_events_type_check", sql`${table.type} in (${eventTypeList})`),
    index("lead_events_lead_id_idx").on(table.leadId, table.createdAt),
  ],
);
