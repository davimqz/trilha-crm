import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_PASSWORD,
  authRequest,
  createTestContext,
  getSessionUser,
  signIn,
  toActor,
} from "../../../test/helpers/auth-context";

import { users } from "./schema";

// Pentest automatizado da superfície HTTP do Better Auth (handler real, banco real)
const context = createTestContext({ rateLimitEnabled: true });
const { auth, db, usersService } = context;

async function seedViewer() {
  const admin = toActor(
    await usersService.bootstrapAdmin({ name: "Admin", email: "admin@trilha.test", password: TEST_PASSWORD }),
  );
  return usersService.createUser(admin, {
    name: "Leitor",
    email: "viewer@trilha.test",
    role: "viewer",
    password: TEST_PASSWORD,
  });
}

describe("superfície HTTP do auth", () => {
  beforeEach(() => context.reset());
  afterAll(() => context.close());

  it("cadastro público está desativado", async () => {
    const response = await authRequest(auth, "POST", "/sign-up/email", {
      body: { name: "Intruso", email: "intruso@evil.test", password: TEST_PASSWORD },
    });
    expect(response.status).toBe(404);
    expect(await db.select().from(users).where(eq(users.email, "intruso@evil.test"))).toHaveLength(0);
  });

  it("usuário não consegue se promover via /update-user", async () => {
    const viewer = await seedViewer();
    const { cookie } = await signIn(auth, viewer.email, TEST_PASSWORD, "10.0.1.1");

    const response = await authRequest(auth, "POST", "/update-user", {
      body: { role: "admin", active: true, name: "Hacker" },
      cookie,
    });
    expect(response.status).toBe(404);
    expect((await getSessionUser(auth, cookie))?.role).toBe("viewer");
  });

  it("login inválido não revela se o e-mail existe", async () => {
    await seedViewer();
    const wrongPassword = await signIn(auth, "viewer@trilha.test", "senha-errada-123", "10.0.2.1");
    const unknownEmail = await signIn(auth, "ninguem@trilha.test", "senha-errada-123", "10.0.2.2");

    expect(wrongPassword.response.status).toBe(401);
    expect(unknownEmail.response.status).toBe(401);
    expect(await wrongPassword.response.json()).toEqual(await unknownEmail.response.json());
  });

  it("brute force: bloqueia com 429 após 5 tentativas por minuto do mesmo IP", async () => {
    await seedViewer();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await signIn(auth, "viewer@trilha.test", `errada-${attempt}-xxxxx`, "10.0.3.1")).response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);

    // Mesmo com a senha certa, o IP segue bloqueado na janela
    expect((await signIn(auth, "viewer@trilha.test", TEST_PASSWORD, "10.0.3.1")).response.status).toBe(429);
  });

  describe("CSRF", () => {
    it("login com Origin de outro site é recusado", async () => {
      await seedViewer();
      const response = await authRequest(auth, "POST", "/sign-in/email", {
        body: { email: "viewer@trilha.test", password: TEST_PASSWORD },
        origin: "https://evil.test",
        ip: "10.0.4.1",
      });
      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });

    it("login via navegação cross-site (form de outro site) é recusado", async () => {
      await seedViewer();
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "sec-fetch-site": "cross-site",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
            "x-forwarded-for": "10.0.4.2",
          },
          body: JSON.stringify({ email: "viewer@trilha.test", password: TEST_PASSWORD }),
        }),
      );
      expect(response.status).toBe(403);
    });

    // O Better Auth aceita form-urlencoded (o route handler exige JSON: ver allowed-routes.test.ts).
    // Aqui garantimos que, mesmo no handler cru, um form de outro site é barrado pelo Origin.
    it("formulário HTML de outro site (form-urlencoded + Origin) é recusado", async () => {
      await seedViewer();
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            origin: "https://evil.test",
            "x-forwarded-for": "10.0.4.3",
          },
          body: "email=viewer%40trilha.test&password=senha-de-teste-123",
        }),
      );
      expect(response.status).toBe(403);
    });

    it("ação autenticada com cookie da vítima e Origin do atacante é recusada", async () => {
      const viewer = await seedViewer();
      const { cookie } = await signIn(auth, viewer.email, TEST_PASSWORD, "10.0.4.4");

      const response = await authRequest(auth, "POST", "/sign-out", { cookie, origin: "https://evil.test" });
      expect(response.status).toBe(403);
      expect(await getSessionUser(auth, cookie)).not.toBeNull();
    });
  });

  it("cookie de sessão é HttpOnly e SameSite=Lax", async () => {
    await seedViewer();
    const response = (await signIn(auth, "viewer@trilha.test", TEST_PASSWORD, "10.0.5.1")).response;
    const sessionCookie = response.headers.getSetCookie().find((value) => value.includes("session_token"));
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
  });

  it("troca de senha exige a senha atual", async () => {
    const viewer = await seedViewer();
    const { cookie } = await signIn(auth, viewer.email, TEST_PASSWORD, "10.0.6.1");

    const wrong = await authRequest(auth, "POST", "/change-password", {
      body: { currentPassword: "nao-e-a-atual-123", newPassword: "outra-senha-segura-789" },
      cookie,
      ip: "10.0.6.1",
    });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const ok = await authRequest(auth, "POST", "/change-password", {
      body: { currentPassword: TEST_PASSWORD, newPassword: "outra-senha-segura-789", revokeOtherSessions: true },
      cookie,
      ip: "10.0.6.1",
    });
    expect(ok.status).toBe(200);
    expect((await signIn(auth, viewer.email, "outra-senha-segura-789", "10.0.6.2")).response.status).toBe(200);
  });

  it("troca de senha sem sessão é recusada", async () => {
    const response = await authRequest(auth, "POST", "/change-password", {
      body: { currentPassword: TEST_PASSWORD, newPassword: "outra-senha-segura-789" },
      ip: "10.0.7.1",
    });
    expect(response.status).toBe(401);
  });

  it("usuário desativado com a senha correta não recebe sessão", async () => {
    const viewer = await seedViewer();
    await db.update(users).set({ active: false }).where(eq(users.id, viewer.id));
    const { response } = await signIn(auth, viewer.email, TEST_PASSWORD, "10.0.8.1");
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie().filter((value) => value.includes("session_token="))).toSatisfy(
      (cookies: string[]) => cookies.every((value) => /session_token=;/.test(value)),
    );
  });
});
