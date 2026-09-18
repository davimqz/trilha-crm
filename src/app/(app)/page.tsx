import { requireActor } from "@/core/auth/session";
import { ROLE_LABELS } from "@/core/rbac/roles";

export default async function HomePage() {
  const actor = await requireActor();

  return (
    <section className="grid gap-2">
      <h1 className="text-2xl font-semibold">Olá, {actor.name}</h1>
      <p className="text-muted-foreground">
        Você está conectado como <strong>{ROLE_LABELS[actor.role]}</strong>. Os módulos de Leads e Clientes chegam
        nas próximas entregas.
      </p>
    </section>
  );
}
