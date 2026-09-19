import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import type { Database } from "@/core/db/create-database";

// Limite por conta: complementa o limite por IP (5/min) contra ataques distribuídos em vários IPs.
// Conta tentativas (não só falhas) de forma atômica, então requisições em paralelo não furam o limite.
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;

export function loginThrottleKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function createLoginThrottle(db: Database) {
  const window = sql`make_interval(secs => ${LOGIN_WINDOW_SECONDS})`;

  return {
    // Registra a tentativa; retorna false quando a conta passou do limite na janela atual
    async reserve(email: string): Promise<boolean> {
      const rows = await db.execute<{ attempts: number }>(sql`
        insert into login_attempts (key, attempts, window_started_at)
        values (${loginThrottleKey(email)}, 1, now())
        on conflict (key) do update set
          attempts = case when login_attempts.window_started_at <= now() - ${window} then 1 else login_attempts.attempts + 1 end,
          window_started_at = case when login_attempts.window_started_at <= now() - ${window} then now() else login_attempts.window_started_at end
        returning attempts
      `);
      // Limpeza oportunista: a tabela só guarda janelas recentes
      await db.execute(sql`delete from login_attempts where window_started_at < now() - interval '1 day'`);
      return Number(rows[0]?.attempts) <= LOGIN_MAX_ATTEMPTS;
    },

    async clear(email: string): Promise<void> {
      await db.execute(sql`delete from login_attempts where key = ${loginThrottleKey(email)}`);
    },
  };
}
