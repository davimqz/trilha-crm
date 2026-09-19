import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_BASE_URL, TEST_PASSWORD, createTestContext, toActor } from "../../../test/helpers/auth-context";

import { createAuthHttpHandler } from "./http-handler";
import { LOGIN_MAX_ATTEMPTS, createLoginThrottle, loginThrottleKey } from "./login-throttle";

// Limite por IP desligado aqui: o foco é o limite por conta, que vale mesmo trocando de IP
const context = createTestContext();
const { auth, db, usersService } = context;
const throttle = createLoginThrottle(db);
const handle = createAuthHttpHandler(auth, throttle);

let ipCounter = 0;

function signInRequest(email: string, password: string) {
  ipCounter += 1;
  return handle(
    new Request(`${TEST_BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        origin: TEST_BASE_URL,
        "content-type": "application/json",
        // Cada tentativa de um IP diferente (ataque distribuído)
        "x-forwarded-for": `10.20.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
}

async function seedUser() {
  const admin = await usersService.bootstrapAdmin({ name: "Admin", email: "admin@trilha.test", password: TEST_PASSWORD });
  return admin;
}

describe("limite de tentativas de login por conta", () => {
  beforeEach(() => context.reset());
  afterAll(() => context.close());

  it(`bloqueia a conta após ${LOGIN_MAX_ATTEMPTS} tentativas, mesmo vindas de IPs diferentes e com a senha certa`, async () => {
    const user = await seedUser();
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt++) {
      expect((await signInRequest(user.email, "senha-errada-123")).status).toBe(401);
    }

    const blocked = await signInRequest(user.email, TEST_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect(blocked.headers.getSetCookie()).toHaveLength(0);
  });

  it("e-mail em maiúsculas/espaços conta para a mesma conta", async () => {
    const user = await seedUser();
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt++) {
      await signInRequest(attempt % 2 ? ` ${user.email.toUpperCase()} ` : user.email, "senha-errada-123");
    }
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(429);
  });

  it("login com sucesso zera o contador; outras contas não são afetadas", async () => {
    const user = await seedUser();
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS - 1; attempt++) await signInRequest(user.email, "senha-errada-123");
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(200);
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS - 1; attempt++) await signInRequest(user.email, "senha-errada-123");
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(200);

    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS + 1; attempt++) await signInRequest("ninguem@trilha.test", "x-senha-errada");
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(200);
  });

  it("não revela se o e-mail existe: conta inexistente também é bloqueada igual", async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt++) {
      expect((await signInRequest("ninguem@trilha.test", "senha-errada-123")).status).toBe(401);
    }
    expect((await signInRequest("ninguem@trilha.test", "senha-errada-123")).status).toBe(429);
  });

  it("tentativas em paralelo não furam o limite", async () => {
    const user = await seedUser();
    const responses = await Promise.all(
      Array.from({ length: LOGIN_MAX_ATTEMPTS * 2 }, () => signInRequest(user.email, "senha-errada-123")),
    );
    expect(responses.filter((response) => response.status === 401)).toHaveLength(LOGIN_MAX_ATTEMPTS);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(LOGIN_MAX_ATTEMPTS);
  });

  it("a janela expira e libera a conta; o e-mail não é guardado em texto", async () => {
    const user = await seedUser();
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt++) await signInRequest(user.email, "senha-errada-123");
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(429);

    const rows = await db.execute<{ key: string }>(sql`select key from login_attempts`);
    expect(rows.map((row) => row.key)).toEqual([loginThrottleKey(user.email)]);
    expect(JSON.stringify(rows)).not.toContain("@");

    await db.execute(sql`update login_attempts set window_started_at = now() - interval '16 minutes'`);
    expect((await signInRequest(user.email, TEST_PASSWORD)).status).toBe(200);
  });

  it("rotas fora da allowlist continuam 404 pelo handler", async () => {
    const admin = toActor(await seedUser());
    expect(admin.role).toBe("admin");
    const response = await handle(
      new Request(`${TEST_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { origin: TEST_BASE_URL, "content-type": "application/json" },
        body: JSON.stringify({ email: "x@y.z", password: TEST_PASSWORD, name: "X" }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
