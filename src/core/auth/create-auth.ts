import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import type { Database } from "@/core/db/create-database";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { authSchema, users } from "./schema";

// Segunda camada além da allowlist do route handler (ver ADR-005)
const DISABLED_PATHS = [
  "/sign-up/email",
  "/sign-in/social",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/delete-user/callback",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/verify-password",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/refresh-token",
  "/get-access-token",
  "/update-session",
];

export type CreateAuthOptions = {
  db: Database;
  secret: string;
  baseURL: string;
  rateLimitEnabled?: boolean;
  // Cabeçalho confiável com o IP do cliente (padrão do Better Auth: x-forwarded-for)
  ipAddressHeader?: string;
};

export function createAuth({ db, secret, baseURL, rateLimitEnabled = true, ipAddressHeader }: CreateAuthOptions) {
  return betterAuth({
    appName: "Trilha CRM",
    secret,
    baseURL,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    telemetry: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        // input: false impede que o cliente defina estes campos em qualquer endpoint
        role: { type: "string", required: false, defaultValue: "viewer", input: false },
        active: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Sem cookieCache: papel e status são relidos do banco a cada request
    },
    rateLimit: {
      enabled: rateLimitEnabled,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    advanced: {
      // Explícito: o Better Auth desliga a checagem de Origin/CSRF quando detecta ambiente de teste,
      // o que faria os testes não refletirem produção
      disableOriginCheck: false,
      disableCSRFCheck: false,
      ipAddress: ipAddressHeader ? { ipAddressHeaders: [ipAddressHeader] } : undefined,
      cookiePrefix: "trilha",
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      session: {
        create: {
          async before(session) {
            const [user] = await db
              .select({ active: users.active })
              .from(users)
              .where(eq(users.id, session.userId));
            if (!user?.active) {
              throw new APIError("FORBIDDEN", { message: "Acesso não permitido", code: "USER_INACTIVE" });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
