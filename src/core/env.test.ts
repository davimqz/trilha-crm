import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("aceita uma DATABASE_URL postgres válida", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
    const { getEnv } = await import("./env");
    expect(getEnv().DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
  });

  it("rejeita protocolo diferente de postgres", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://u:p@localhost/db");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("não expõe o valor da variável na mensagem de erro", async () => {
    vi.stubEnv("DATABASE_URL", "not-a-url-secret-value");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(expect.objectContaining({ message: expect.not.stringContaining("secret") }));
  });
});
