// Allowlist dos endpoints do Better Auth expostos por HTTP (ADR-005).
// Comparação exata do pathname cru: variações ("/x/", "//x", "%2F") são rejeitadas.
const AUTH_BASE_PATH = "/api/auth";

const ALLOWED_AUTH_ROUTES: Readonly<Record<string, readonly string[]>> = {
  GET: ["/get-session"],
  POST: ["/sign-in/email", "/sign-out", "/change-password"],
};

export type AuthRequestCheck = { allowed: true } | { allowed: false; status: 404 | 415 };

export function checkAuthRequest(request: Request): AuthRequestCheck {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return { allowed: false, status: 404 };

  const path = pathname.slice(AUTH_BASE_PATH.length);
  if (!ALLOWED_AUTH_ROUTES[request.method]?.includes(path)) return { allowed: false, status: 404 };

  // O Better Auth aceita form-urlencoded; exigir JSON impede envio por formulário HTML de outro site
  if (request.method === "POST") {
    const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mediaType !== "application/json") return { allowed: false, status: 415 };
  }

  return { allowed: true };
}
