import "server-only";

import { getDb } from "@/core/db";
import { getEnv } from "@/core/env";

import { createAuth, type Auth } from "./create-auth";
import { createAuthHttpHandler } from "./http-handler";
import { createLoginThrottle } from "./login-throttle";

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
      ipAddressHeader: env.AUTH_IP_HEADER,
    });
  }
  return globalForAuth.trilhaAuth;
}

const globalForHandler = globalThis as unknown as { trilhaAuthHandler?: (request: Request) => Promise<Response> };

export function getAuthHttpHandler(): (request: Request) => Promise<Response> {
  globalForHandler.trilhaAuthHandler ??= createAuthHttpHandler(getAuth(), createLoginThrottle(getDb()));
  return globalForHandler.trilhaAuthHandler;
}
