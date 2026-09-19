import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations usam a conexão direta (sem pooler): o PgBouncer do Neon em modo transação não suporta SET/advisory locks de sessão
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/core/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
