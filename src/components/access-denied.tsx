export function AccessDenied() {
  return (
    <section className="grid gap-2" role="alert">
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
    </section>
  );
}
