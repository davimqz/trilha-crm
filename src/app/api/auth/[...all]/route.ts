import { getAuth } from "@/core/auth";
import { isAllowedAuthRequest } from "@/core/auth/allowed-routes";

async function handle(request: Request) {
  if (!isAllowedAuthRequest(request)) return new Response("Not Found", { status: 404 });
  return getAuth().handler(request);
}

export { handle as GET, handle as POST };
