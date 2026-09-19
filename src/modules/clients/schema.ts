import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Imports relativos: o drizzle-kit não resolve o alias "@/"
import { users } from "../../core/auth/schema";
import { leads } from "../leads/schema";

import { ASSOCIATIVE_STATUSES, SERVICE_RECORD_TYPES } from "./constants";

// Constantes do código (nunca entrada do usuário): sql.raw é seguro aqui
const statusList = sql.raw(ASSOCIATIVE_STATUSES.map((status) => `'${status}'`).join(", "));
const serviceTypeList = sql.raw(SERVICE_RECORD_TYPES.map((type) => `'${type}'`).join(", "));

// Cliente = extensão do lead convertido (ADR-008). Nome, e-mail, telefone e responsável ficam no lead.
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sem cascade: um lead que virou cliente não pode ser excluído (bloqueado também no service)
    leadId: uuid("lead_id")
      .notNull()
      .unique()
      .references(() => leads.id),
    associativeStatus: text("associative_status").notNull().default("adimplente"),
    convertedAt: timestamp("converted_at", { withTimezone: true }).notNull().defaultNow(),
    // Arquivado quando a conversão é desfeita (lead sai de "Convertido")
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("clients_associative_status_check", sql`${table.associativeStatus} in (${statusList})`),
    index("clients_archived_status_idx").on(table.archivedAt, table.associativeStatus),
  ],
);

export const clientServiceRecords = pgTable(
  "client_service_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    subject: text("subject").notNull(),
    // Mesmo formato seguro das anotações (JSON validado, ADR-007); opcional
    description: jsonb("description"),
    responsibleId: uuid("responsible_id")
      .notNull()
      .references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("client_service_records_type_check", sql`${table.type} in (${serviceTypeList})`),
    index("client_service_records_client_idx").on(table.clientId, table.occurredAt),
  ],
);
