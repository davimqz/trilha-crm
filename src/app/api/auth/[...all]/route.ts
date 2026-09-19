import { getAuthHttpHandler } from "@/core/auth";

function handle(request: Request) {
  return getAuthHttpHandler()(request);
}

export { handle as GET, handle as POST };
