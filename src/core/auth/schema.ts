import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ROLES } from "../rbac/roles";

// Tabelas exigidas pelo Better Auth (ver ADR-005). Nomes de propriedade seguem o modelo do Better Auth;
// colunas em snake_case. `role` e `active` são campos adicionais nossos.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Menor privilégio por padrão; o CHECK abaixo restringe aos ROLES
    role: text("role").notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  // ROLES é uma constante do código (nunca entrada do usuário), por isso sql.raw é seguro aqui
  (table) => [check("users_role_check", sql`${table.role} in (${sql.raw(ROLES.map((role) => `'${role}'`).join(", "))})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Tentativas de login por conta (complementa o limite por IP do Better Auth). A chave é o SHA-256 do e-mail normalizado.
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
});

export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  rateLimit: rateLimits,
};
