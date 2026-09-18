import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "@/core/db/create-database";

import { checkDatabase } from "./check-database";

describe("checkDatabase", () => {
  const healthy = createDatabase(process.env.TEST_DATABASE_URL!);
  // Porta 1 em localhost: conexão recusada imediatamente
  const unreachable = createDatabase("postgres://trilha:x@127.0.0.1:1/nope");

  afterAll(async () => {
    await healthy.close();
    await unreachable.close();
  });

  it("retorna true quando o banco responde", async () => {
    await expect(checkDatabase(healthy.db)).resolves.toBe(true);
  });

  it("retorna false quando o banco está inacessível, sem lançar erro", async () => {
    await expect(checkDatabase(unreachable.db, 3000)).resolves.toBe(false);
  });
});
