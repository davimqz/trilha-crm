import { sql } from "drizzle-orm";

import { createAuth, type Auth } from "@/core/auth/create-auth";
import { createDatabase } from "@/core/db/create-database";
import type { Actor } from "@/core/rbac/authorization";
import { createUsersService, type UserSummary } from "@/modules/users/service";

export const TEST_BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "senha-de-teste-123";

export function createTestContext({ rateLimitEnabled = false } = {}) {
  const { db, close } = createDatabase(process.env.TEST_DATABASE_URL!);
  const auth = createAuth({
    db,
    secret: "segredo-de-teste-com-mais-de-32-caracteres",
    baseURL: TEST_BASE_URL,
    rateLimitEnabled,
  });
  const usersService = createUsersService({ db, auth });

  return {
    db,
    auth,
    usersService,
    close,
    async reset() {
      await db.execute(sql`truncate table users, verifications, rate_limits cascade`);
    },
  };
}

export function toActor(user: UserSummary): Actor {
  return { userId: user.id, name: user.name, email: user.email, role: user.role };
}

type AuthRequestOptions = { body?: unknown; cookie?: string; ip?: string; origin?: string };

export function authRequest(auth: Auth, method: string, path: string, options: AuthRequestOptions = {}) {
  const headers = new Headers({ origin: options.origin ?? TEST_BASE_URL });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  headers.set("x-forwarded-for", options.ip ?? "10.0.0.1");

  return auth.handler(
    new Request(`${TEST_BASE_URL}/api/auth${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

export async function signIn(auth: Auth, email: string, password: string, ip?: string) {
  const response = await authRequest(auth, "POST", "/sign-in/email", { body: { email, password }, ip });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { response, cookie };
}

export async function getSessionUser(auth: Auth, cookie: string) {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  return session?.user ?? null;
}
