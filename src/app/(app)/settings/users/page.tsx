import type { Metadata } from "next";

import { AccessDenied } from "@/components/access-denied";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/core/auth/session";
import { can } from "@/modules/authorization";
import { CreateUserForm } from "@/modules/users/components/create-user-form";
import { UsersTable } from "@/modules/users/components/users-table";
import { getUsersService } from "@/modules/users/service";

export const metadata: Metadata = { title: "Usuários · Trilha CRM" };

export default async function UsersPage() {
  const actor = await requireActor();
  if (!can(actor, "users:read")) return <AccessDenied />;

  const users = await getUsersService().listUsers(actor);
  const canManage = can(actor, "users:manage");

  return (
    <section className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-sm text-muted-foreground">Quem acessa o CRM e com qual papel.</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Novo usuário</CardTitle>
            <CardDescription>Não há cadastro público: defina uma senha inicial e envie por um canal seguro.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} currentUserId={actor.userId} />
        </CardContent>
      </Card>
    </section>
  );
}
