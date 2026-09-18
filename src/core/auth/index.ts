import "server-only";

import { getDb } from "@/core/db";
import { getEnv } from "@/core/env";

import { createAuth, type Auth } from "./create-auth";

export type { Auth };

const globalForAuth = globalThis as unknown as { trilhaAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.trilhaAuth) {
    const env = getEnv();
    globalForAuth.trilhaAuth = createAuth({
      db: getDb(),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      rateLimitEnabled: env.NODE_ENV !== "test",
    });
  }
  return globalForAuth.trilhaAuth;
}
