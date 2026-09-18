import type { Metadata } from "next";

import { requireActor } from "@/core/auth/session";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Alterar minha senha · Trilha CRM" };

export default async function ChangePasswordPage() {
  await requireActor();

  return (
    <section className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Alterar minha senha</h1>
        <p className="text-sm text-muted-foreground">Ao trocar a senha, as sessões em outros dispositivos são encerradas.</p>
      </div>
      <ChangePasswordForm />
    </section>
  );
}
