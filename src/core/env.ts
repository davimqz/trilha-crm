import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    // Cabeçalho com o IP real do cliente, preenchido pela hospedagem (ex.: x-nf-client-connection-ip na Netlify).
    // Sem ele, quem acessa direto poderia forjar X-Forwarded-For e fugir do limite de tentativas.
    AUTH_IP_HEADER: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{1,64}$/)
      .optional(),
  })
  .refine((env) => env.NODE_ENV !== "production" || env.AUTH_IP_HEADER, {
    message: "obrigatória em produção",
    path: ["AUTH_IP_HEADER"],
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

// Lido sob demanda para que o `next build` não exija segredos de runtime
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Lista só os nomes das variáveis inválidas, nunca os valores
    const invalidKeys = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Variáveis de ambiente inválidas: ${invalidKeys.join(", ")}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
