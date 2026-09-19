import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDatabase(url: string) {
  // idle_timeout fecha conexões ociosas: em serverless a instância fica congelada entre requisições
  const client = postgres(url, { max: 10, connect_timeout: 10, idle_timeout: 20 });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

export type Database = ReturnType<typeof createDatabase>["db"];

// Transação do Drizzle: usada por helpers que precisam participar da transação de outro service
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
