"use server";

import { revalidatePath } from "next/cache";

import { formString, runAction, withSubmittedValues, type ActionResult } from "@/core/actions/action-result";
import { requireActor } from "@/core/auth/session";

import { getClientsService } from "./service";

// Não existe action de criação: cliente só nasce da conversão de um lead (ADR-008).
// Sessão aqui; permissão, posse e validação no service.

function revalidate() {
  revalidatePath("/clients");
  // Nome/e-mail/telefone/responsável são do lead
  revalidatePath("/leads");
}

export async function updateClientAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const ownerId = formString(formData, "ownerId");
  const result = await runAction(async () => {
    await getClientsService().updateClient(actor, {
      clientId: formString(formData, "clientId"),
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone"),
      associativeStatus: formString(formData, "associativeStatus"),
      ...(ownerId ? { ownerId } : {}),
    });
    return "Alterações salvas.";
  });
  if (result.status === "success") revalidate();
  return withSubmittedValues(result, formData, ["name", "email", "phone", "associativeStatus", "ownerId"]);
}

export async function addServiceRecordAction(input: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    await getClientsService().addServiceRecord(actor, input);
    return "Atendimento registrado.";
  });
  if (result.status === "success") revalidatePath("/clients");
  return result;
}

export async function updateServiceRecordAction(input: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    await getClientsService().updateServiceRecord(actor, input);
    return "Atendimento atualizado.";
  });
  if (result.status === "success") revalidatePath("/clients");
  return result;
}

export async function deleteServiceRecordAction(clientId: unknown, recordId: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await runAction(async () => {
    await getClientsService().deleteServiceRecord(actor, { clientId, recordId });
    return "Atendimento excluído.";
  });
  if (result.status === "success") revalidatePath("/clients");
  return result;
}
