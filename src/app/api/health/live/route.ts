// Liveness sem banco: monitores externos de uptime usam esta rota para não acordar o Neon
// (o banco hiberna após 5 min sem uso e o plano gratuito tem cota de horas de computação)
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
