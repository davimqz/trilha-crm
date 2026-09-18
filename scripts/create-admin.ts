// Cria o primeiro administrador. Só funciona enquanto não houver admin ativo.
// Uso: ADMIN_NAME="Nome" ADMIN_EMAIL="voce@empresa.com" pnpm auth:create-admin
// Sem ADMIN_PASSWORD, uma senha forte é gerada e exibida uma única vez.
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { createAuth } from "@/core/auth/create-auth";
import { createDatabase } from "@/core/db/create-database";
import { DomainError } from "@/core/errors";
import { getEnv } from "@/core/env";
import { createUsersService } from "@/modules/users/service";

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim();
  if (!name || !email) {
    console.error('Defina ADMIN_NAME e ADMIN_EMAIL. Ex.: ADMIN_NAME="Ana" ADMIN_EMAIL="ana@empresa.com" pnpm auth:create-admin');
    process.exit(1);
  }

  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");

  const env = getEnv();
  const { db, close } = createDatabase(env.DATABASE_URL);
  const auth = createAuth({ db, secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });

  try {
    const admin = await createUsersService({ db, auth }).bootstrapAdmin({ name, email, password });
    console.log(`Administrador criado: ${admin.name} <${admin.email}>`);
    if (generated) {
      console.log(`Senha gerada (exibida só agora): ${password}`);
      console.log("Entre no CRM e troque a senha em “Alterar minha senha”.");
    }
  } catch (error) {
    if (error instanceof DomainError) {
      console.error(error.message);
      process.exitCode = 1;
    } else if (error instanceof Error && error.name === "ZodError") {
      console.error("Dados inválidos:", (error as { issues?: { message: string }[] }).issues?.map((issue) => issue.message).join(" "));
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    await close();
  }
}

void main();
