import "server-only";

import { getEnv } from "@/core/env";

import { createDatabase, type Database } from "./create-database";

export type { Database };

// Reaproveita a conexão entre recargas do dev server
const globalForDb = globalThis as unknown as { trilhaDb?: Database };

export function getDb(): Database {
  if (!globalForDb.trilhaDb) {
    globalForDb.trilhaDb = createDatabase(getEnv().DATABASE_URL).db;
  }
  return globalForDb.trilhaDb;
}
