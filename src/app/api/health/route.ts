import { getDb } from "@/core/db";
import { checkDatabase } from "@/core/health/check-database";

// Resposta mínima: não expõe versão, host nem mensagens de erro
export async function GET() {
  let databaseOk = false;
  try {
    databaseOk = await checkDatabase(getDb());
  } catch (error) {
    console.error("[health] falha ao inicializar o banco", error);
  }

  return Response.json(
    { status: databaseOk ? "ok" : "error" },
    { status: databaseOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
