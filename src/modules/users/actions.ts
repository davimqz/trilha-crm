"use server";

import { revalidatePath } from "next/cache";

import { formString, runAction, withSubmittedValues, type ActionResult } from "@/core/actions/action-result";
import { requireActor } from "@/core/auth/session";

import { getUsersService } from "./service";

const USERS_PATH = "/settings/users";

// Server Actions são endpoints públicos: sessão aqui, permissão e validação no service

export async function createUserAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    await getUsersService().createUser(actor, {
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      role: formString(formData, "role"),
      password: formString(formData, "password"),
    });
    return "Usuário criado. Envie a senha inicial por um canal seguro.";
  });
  if (result.status === "success") revalidatePath(USERS_PATH);
  return withSubmittedValues(result, formData, ["name", "email", "role"]);
}

export async function changeRoleAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    await getUsersService().changeRole(actor, {
      userId: formString(formData, "userId"),
      role: formString(formData, "role"),
    });
    return "Papel atualizado.";
  });
  if (result.status === "success") revalidatePath(USERS_PATH);
  return result;
}

export async function setActiveAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    const active = formString(formData, "active") === "true";
    await getUsersService().setActive(actor, { userId: formString(formData, "userId"), active });
    return active ? "Usuário reativado." : "Usuário desativado e desconectado.";
  });
  if (result.status === "success") revalidatePath(USERS_PATH);
  return result;
}

export async function resetPasswordAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  return runAction(async () => {
    await getUsersService().resetPassword(actor, {
      userId: formString(formData, "userId"),
      password: formString(formData, "password"),
    });
    return "Senha redefinida. O usuário foi desconectado.";
  });
}
