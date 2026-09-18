import { chromium, expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { accounts, users } from "../src/core/auth/schema";
import { createDatabase } from "../src/core/db/create-database";

import { E2E_BASE_URL, E2E_PASSWORD, E2E_USERS, storageStatePath } from "./fixtures";

// Seed direto no banco de TESTE + login real pela UI para gerar a sessão de cada papel.
// São 2 logins aqui; o rate limit (5/min) comporta os demais testes.
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
  } finally {
    await close();
  }

  const browser = await chromium.launch();
  for (const role of ["admin", "viewer"] as const) {
    const page = await browser.newPage({ baseURL: E2E_BASE_URL });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_USERS[role].email);
    await page.getByLabel("Senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: `Olá, ${E2E_USERS[role].name}` })).toBeVisible();
    await page.context().storageState({ path: storageStatePath(role) });
    await page.close();
  }
  await browser.close();
}
