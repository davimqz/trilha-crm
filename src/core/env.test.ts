import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getEnv", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("aceita uma configuração válida", async () => {
    const { getEnv } = await import("./env");
    expect(getEnv().DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
  });

  it("rejeita protocolo diferente de postgres", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://u:p@localhost/db");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("rejeita segredo de auth curto", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "curto");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("não expõe o valor da variável na mensagem de erro", async () => {
    vi.stubEnv("DATABASE_URL", "not-a-url-secret-value");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(expect.objectContaining({ message: expect.not.stringContaining("secret") }));
  });
});
