import { checkAuthRequest } from "./allowed-routes";
import type { Auth } from "./create-auth";
import { LOGIN_WINDOW_SECONDS, type LoginThrottle } from "./login-throttle";

const SIGN_IN_PATH = "/api/auth/sign-in/email";

async function emailFromBody(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.clone().json();
    if (body && typeof body === "object" && "email" in body && typeof body.email === "string") {
      const email = body.email.trim();
      return email.length > 0 && email.length <= 320 ? email : null;
    }
  } catch {
    // Corpo inválido: o Better Auth responde 400
  }
  return null;
}

// Handler HTTP do auth: allowlist (ADR-005) + limite de tentativas por conta no login
export function createAuthHttpHandler(auth: Auth, throttle: LoginThrottle) {
  return async function handle(request: Request): Promise<Response> {
    const check = checkAuthRequest(request);
    if (!check.allowed) return new Response(null, { status: check.status });

    if (request.method !== "POST" || new URL(request.url).pathname !== SIGN_IN_PATH) {
      return auth.handler(request);
    }

    const email = await emailFromBody(request);
    if (!email) return auth.handler(request);

    // Mesma resposta para e-mail existente ou não: o bloqueio não revela contas
    if (!(await throttle.reserve(email))) {
      return Response.json(
        { code: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas para esta conta. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(LOGIN_WINDOW_SECONDS), "Cache-Control": "no-store" } },
      );
    }

    const response = await auth.handler(request);
    if (response.ok) await throttle.clear(email);
    return response;
  };
}
