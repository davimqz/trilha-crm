import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL não definida. Rode `pnpm db:up` e configure o .env.");
}
