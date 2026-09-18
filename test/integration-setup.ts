import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll } from "vitest";

import { createDatabase } from "@/core/db/create-database";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL não definida. Rode `pnpm db:up` e configure o .env.");
}

beforeAll(async () => {
  const { db, close } = createDatabase(process.env.TEST_DATABASE_URL!);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await close();
});
