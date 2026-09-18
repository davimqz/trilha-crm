import { request } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { accounts, users } from "../src/core/auth/schema";
import { createDatabase } from "../src/core/db/create-database";
import { leads } from "../src/modules/leads/schema";

import { ADMIN_LEAD, E2E_BASE_URL, E2E_PASSWORD, E2E_USERS, storageStatePath, type SessionRole } from "./fixtures";

// Seed direto no banco de TESTE + sessões por papel via endpoint real de login.
export default async function globalSetup() {
  const { db, close } = createDatabase(process.env.TEST_DATABASE_URL!);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.execute(sql`truncate table users, verifications, rate_limits cascade`);

    const passwordHash = await hashPassword(E2E_PASSWORD);
    for (const user of Object.values(E2E_USERS)) {
      const [created] = await db
        .insert(users)
        .values({ name: user.name, email: user.email, role: user.role })
        .returning({ id: users.id });
      await db
        .insert(accounts)
        .values({ accountId: created.id, providerId: "credential", userId: created.id, password: passwordHash });
    }

    const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, E2E_USERS.admin.email));
    await db.insert(leads).values({ ...ADMIN_LEAD, status: "prospect", ownerId: admin.id, createdBy: admin.id, updatedBy: admin.id });
  } finally {
    await close();
  }

  // Cada papel "vem" de um IP distinto para não consumir o limite de 5 logins/min do IP real,
  // que fica reservado aos testes de login pela UI (auth.spec.ts)
  const roles: SessionRole[] = ["admin", "viewer", "sales"];
  for (const [index, role] of roles.entries()) {
    const context = await request.newContext({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { origin: E2E_BASE_URL, "x-forwarded-for": `10.99.0.${index + 1}` },
    });
    const response = await context.post("/api/auth/sign-in/email", {
      data: { email: E2E_USERS[role].email, password: E2E_PASSWORD },
    });
    if (!response.ok()) throw new Error(`Login de ${role} no setup falhou: ${response.status()}`);
    await context.storageState({ path: storageStatePath(role) });
    await context.dispose();
  }
}
