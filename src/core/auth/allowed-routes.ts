// Allowlist dos endpoints do Better Auth expostos por HTTP (ADR-005).
// Comparação exata do pathname cru: variações ("/x/", "//x", "%2F") são rejeitadas.
const AUTH_BASE_PATH = "/api/auth";

const ALLOWED_AUTH_ROUTES: Readonly<Record<string, readonly string[]>> = {
  GET: ["/get-session"],
  POST: ["/sign-in/email", "/sign-out", "/change-password"],
};

export function isAllowedAuthRequest(request: Request): boolean {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return false;

  const path = pathname.slice(AUTH_BASE_PATH.length);
  return ALLOWED_AUTH_ROUTES[request.method]?.includes(path) ?? false;
}
