import { getAuth } from "@/core/auth";
import { checkAuthRequest } from "@/core/auth/allowed-routes";

async function handle(request: Request) {
  const check = checkAuthRequest(request);
  if (!check.allowed) return new Response(null, { status: check.status });
  return getAuth().handler(request);
}

export { handle as GET, handle as POST };
