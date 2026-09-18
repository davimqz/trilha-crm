import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentActor } from "@/core/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Trilha CRM" };

export default async function LoginPage() {
  if (await getCurrentActor()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">Trilha CRM</h1>
          </CardTitle>
          <CardDescription>Entre com o e-mail e a senha fornecidos pelo administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
